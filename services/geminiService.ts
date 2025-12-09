// @ts-nocheck
declare var process: any;

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights, ObjectionType, SequenceDay, RoleplayProfile, RoleplayMessage, ChatAnalysis, SearchFilters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper ROBUSTO para limpar JSON (Versão Blindada v2)
const extractJson = (text: string): any => {
  try {
    // 1. Tenta encontrar blocos de código explícitos
    const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]);
    }
    
    // 2. Tenta encontrar o array JSON bruto no texto
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonCandidate = text.substring(firstBracket, lastBracket + 1);
        return JSON.parse(jsonCandidate);
    }

    // 3. Fallback: Tenta parsear o texto todo
    return JSON.parse(text);
  } catch (e) {
    console.error("Falha crítica ao processar JSON da IA. Texto recebido:", text);
    return []; // Retorna array vazio para não quebrar a app
  }
};

const cleanPhone = (phone: string): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return null;
  return cleaned;
};

// Calcula Temperatura do Lead
const calculateLeadScore = (lead: any): LeadScore => {
    if (!lead.website || lead.website === "Não encontrado" || lead.website === "" || lead.website === "Sem Site") {
        return 'hot';
    }
    if (lead.instagram) {
        return 'warm';
    }
    return 'cold';
};

/**
 * BUSCADOR DE LEADS COM LÓGICA DE RETRY (LOOP)
 * Garante que a quantidade solicitada seja atingida acumulando resultados.
 */
export const generateLeads = async (
  niche: string, 
  location: string, 
  size: BusinessSize,
  targetCount: number, // Quantos o usuário quer (ex: 20)
  existingNames: string[],
  serviceContext?: ServiceContext,
  filters?: SearchFilters,
  customInstruction?: string
): Promise<{ leads: Lead[], sources: GroundingSource[] }> => {
  
  let allLeads: Lead[] = [];
  let allSources: GroundingSource[] = [];
  let attempts = 0;
  const maxAttempts = 3; // Limite de segurança para não ficar em loop infinito
  
  // Lista negra temporária para esta sessão de busca
  let currentSessionNames = [...existingNames];

  // O Loop continua enquanto não tivermos leads suficientes E não estourarmos as tentativas
  while (allLeads.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const leadsNeeded = targetCount - allLeads.length;
      
      // Pedimos sempre o triplo do que falta para garantir que o filtro de telefone não zere a lista
      // Mas limitamos o pedido máximo por vez para não estourar tokens da IA
      const requestBatchSize = Math.min(Math.max(leadsNeeded * 3, 10), 30);

      console.log(`[Busca] Tentativa ${attempts}: Precisamos de ${leadsNeeded}, pedindo ${requestBatchSize}...`);

      let serviceStrategy = "";
      if (serviceContext && serviceContext.serviceName) {
        serviceStrategy = `
        CONTEXTO DO USUÁRIO (VENDEDOR):
        - Vende: "${serviceContext.serviceName}"
        - Alvo: "${serviceContext.targetAudience || 'Geral'}"
        - Objetivo: Encontrar empresas que PRECISAM desse serviço.
        `;
      }
    
      let advancedFilters = "";
      if (filters) {
          if (filters.websiteRule === 'must_have') advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter um website ativo listado.\n";
          if (filters.websiteRule === 'must_not_have') advancedFilters += "- OBRIGATÓRIO: O lead NÃO PODE ter website (ou deve estar quebrado/404).\n";
          if (filters.mustHaveInstagram) advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter perfil no Instagram.\n";
          if (filters.mobileOnly) advancedFilters += "- PREFERÊNCIA: Priorize números de celular/WhatsApp ((XX) 9...).\n";
      }
    
      const prompt = `
        ATUE COMO UM EXTRACTOR DE DADOS DE NEGÓCIOS DE ELITE (Modo Hunter V3).
        
        SUA MISSÃO: Realizar uma busca profunda no Google para encontrar leads qualificados.
        
        PARÂMETROS DE BUSCA:
        - Termo Principal: "${niche}"
        - Localização: "${location}"
        - Modificadores de Busca: "WhatsApp", "Contato", "Telefone", "Instagram"
        
        ${serviceStrategy}
        ${advancedFilters}
        ${customInstruction ? `ORDEM ESPECIAL (PRIORIDADE MÁXIMA): ${customInstruction}` : ""}
        
        REGRAS DE EXTRAÇÃO (CRÍTICO):
        1. VOCÊ DEVE EXTRAIR ${requestBatchSize} NOVOS CANDIDATOS NESTA RODADA.
        2. *** FILTRO DE TELEFONE ***: É INACEITÁVEL retornar um lead sem telefone.
           - Busque no Google Maps, Rodapé de Sites, Bios de Instagram.
           - Se não achar o telefone, DESCARTE O LEAD e busque outro.
        3. IGNORAR ESTES NOMES (JÁ LISTADOS): ${currentSessionNames.join(", ")}.
        4. IDIOMA: PORTUGUÊS (PT-BR).
    
        ESTRUTURA DE RESPOSTA (JSON ARRAY PURO):
        [
          {
            "name": "Nome da Empresa",
            "phone": "(XX) 9XXXX-XXXX", 
            "instagram": "Link ou 'Não encontrado'",
            "website": "Link ou 'Sem Site'",
            "description": "O que eles fazem e qual o estado digital deles (ex: Site ruim, Sem insta).",
            "painPoints": ["Sem Site", "Pouca Avaliação"],
            "matchReason": "Motivo da escolha.",
            "qualityTier": "high-ticket" | "opportunity" | "urgent"
          }
        ]
      `;
    
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.7, 
          },
        });
    
        const text = response.text || "";
        const rawLeads = extractJson(text);
    
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const newSources = response.candidates[0].groundingMetadata.groundingChunks
            .map((chunk: any) => chunk.web)
            .filter((web: any) => web && web.uri && web.title)
            .map((web: any) => ({ title: web.title, uri: web.uri }));
            allSources = [...allSources, ...newSources];
        }
    
        if (Array.isArray(rawLeads)) {
            // Processamento e Filtragem Rigorosa
            const validLeadsInBatch: Lead[] = rawLeads
              .map((item: any, index: number) => ({
                id: `${Date.now()}-${attempts}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                name: item.name || "Desconhecido",
                phone: item.phone || "Não encontrado",
                instagram: (item.instagram === "Not Found" || !item.instagram || item.instagram === "Não encontrado") ? null : item.instagram,
                description: item.description || "Sem descrição disponível.",
                website: (item.website === "Not Found" || !item.website || item.website === "Sem Site" || item.website === "Não encontrado") ? undefined : item.website,
                painPoints: Array.isArray(item.painPoints) ? item.painPoints : [],
                matchReason: item.matchReason || "Lead compatível com o nicho.",
                confidenceScore: 1,
                status: 'new' as LeadStatus,
                score: calculateLeadScore(item),
                qualityTier: item.qualityTier || 'opportunity'
              }))
              .filter((lead) => {
                // Filtro 1: Telefone Válido
                const isNotFound = lead.phone === "Não encontrado" || lead.phone === "Not Found" || !lead.phone;
                const clean = cleanPhone(lead.phone);
                if (isNotFound || !clean) return false;

                // Filtro 2: Duplicidade (Nome ou Telefone já existente nesta sessão)
                const isDuplicate = currentSessionNames.some(existingName => 
                    existingName.toLowerCase() === lead.name.toLowerCase() ||
                    lead.phone.includes(existingName) // Verifica grosseira se telefone já foi usado como chave
                );
                
                return !isDuplicate;
              });

            // Adiciona os válidos à lista principal
            allLeads = [...allLeads, ...validLeadsInBatch];
            
            // Atualiza a lista negra para a próxima iteração
            validLeadsInBatch.forEach(l => currentSessionNames.push(l.name));
            
            // Se já temos o suficiente, paramos o loop
            if (allLeads.length >= targetCount) break;
        }
    
      } catch (error) {
        console.error(`Erro na tentativa ${attempts}:`, error);
        // Continua para a próxima tentativa se der erro
      }
  }

  // Retorna o que conseguimos (mesmo se for um pouco menos ou mais que o target)
  // Limitamos ao targetCount para não poluir a tela se vier demais
  return { leads: allLeads.slice(0, targetCount), sources: allSources };
};

export const generateTacticalPrompts = async (serviceContext: ServiceContext): Promise<string[]> => {
    if (!serviceContext.serviceName) return [
        "Apenas empresas com avaliação menor que 4.0 no Google Maps",
        "Negócios locais que não possuem site oficial nos resultados",
        "Restaurantes com Instagram ativo mas sem link de pedidos na bio"
    ];

    const prompt = `
        ATUE COMO UM ESPECIALISTA EM PESQUISA DE MERCADO.
        SERVIÇO: "${serviceContext.serviceName}"
        DESCRIÇÃO: "${serviceContext.description}"
        
        Gere 3 instruções de busca (filtros) para encontrar clientes ideais.
        SAÍDA JSON ARRAY: ["Ideia 1", "Ideia 2", "Ideia 3"]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                temperature: 0.8 
            }
        });
        
        const text = response.text || "[]";
        const json = extractJson(text);
        
        return Array.isArray(json) ? json : [
             "Apenas empresas com site quebrado ou fora do ar",
             "Negócios com muitas reclamações recentes",
             "Empresas invisíveis na primeira página do Google"
        ];
    } catch (e) {
        console.error("Erro ao gerar prompts táticos:", e);
        return [
             "Apenas empresas com site quebrado ou fora do ar",
             "Negócios com muitas reclamações recentes",
             "Empresas invisíveis na primeira página do Google"
        ];
    }
}

export const generateMarketingCopy = async (
  lead: Lead, 
  serviceContext: ServiceContext
): Promise<string> => {
  if (!serviceContext.serviceName) return `Olá ${lead.name}, tudo bem?`;

  const strategies = [
    "O CLIENTE OCULTO (Finja que tentou comprar mas teve problema)",
    "DINHEIRO PERDIDO (Aponte agressivamente onde estão perdendo vendas)",
    "INVEJA DO CONCORRENTE (Mencione que o concorrente está fazendo melhor)",
    "QUEBRA DE PADRÃO (Comece com uma pergunta estranha e específica)",
    "ISCA DE EGO (Elogie muito, depois bata no único ponto fraco)"
  ];
  const selectedStrategy = strategies[Math.floor(Math.random() * strategies.length)];

  const prompt = `
    ATUE COMO UM COPYWRITER DE RESPOSTA DIRETA DE ELITE.
    ESTRATÉGIA: ${selectedStrategy}

    Recebedor: ${lead.name} (${lead.description})
    Problema: ${lead.painPoints?.join(", ")}
    Meu Serviço: ${serviceContext.serviceName}
    
    REGRAS:
    1. IDIOMA: PORTUGUÊS DO BRASIL. Informal.
    2. SEM "Assunto:".
    3. EXTREMAMENTE PERSUASIVO.
    
    SAÍDA APENAS O TEXTO DA MENSAGEM.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { temperature: 1.5 }
    });
    return response.text?.trim() || "";
  } catch (error) {
    return `Fala ${lead.name}, vi aqui que vocês estão sem site. Bora resolver?`;
  }
};

export const generateLeadAudit = async (lead: Lead, serviceContext: ServiceContext): Promise<string> => {
    const prompt = `
        ATUE COMO UM CONSULTOR SÊNIOR.
        ALVO: ${lead.name}.
        SERVIÇO: ${serviceContext.serviceName}
        
        TAREFA: 3 PROBLEMAS REAIS e VISÍVEIS (Google/Insta/Site).
        NÃO INVENTE ERROS TÉCNICOS.
        IDIOMA: PORTUGUÊS DO BRASIL.
        
        FORMATO:
        1. ❌ [Erro]
        2. ❌ [Erro]
        3. ❌ [Erro]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "1. ❌ Presença digital inconsistente.\n2. ❌ Falta de canais de conversão.\n3. ❌ Posicionamento abaixo dos concorrentes.";
    }
}

export const generateServiceInsights = async (serviceName: string, description: string, targetAudience: string = ""): Promise<ServiceInsights> => {
  const audienceInstruction = targetAudience 
      ? `O usuário definiu EXPLICITAMENTE o público alvo: "${targetAudience}". Você é OBRIGADO a sugerir uma estratégia DENTRO deste público (ex: um sub-nicho premium de ${targetAudience}). É PROIBIDO SUGERIR OUTRO SETOR.`
      : "O usuário não definiu público. Analise o serviço e encontre o setor que paga mais caro por isso.";

  const prompt = `
    ATUE COMO UM ESTRATEGISTA DE NEGÓCIOS LÓGICO E ANALÍTICO.
    
    DADOS DE ENTRADA:
    1. SERVIÇO VENDIDO: "${serviceName}"
    2. COMO ELE É ENTREGUE: "${description}"
    3. RESTRIÇÃO DE PÚBLICO: ${audienceInstruction}

    SUA TAREFA:
    Conectar o SERVIÇO ao MELHOR COMPRADOR POSSÍVEL de forma lógica.
    
    PERGUNTAS QUE VOCÊ DEVE RESPONDER NO JSON:
    - recommendedNiche: Qual o sub-nicho específico (dentro da restrição) que tem a dor mais aguda e dinheiro para pagar? (Ex: Não diga "Médicos", diga "Cirurgiões Plásticos").
    - suggestedTicket: Qual o valor justo (em Reais) para cobrar desse nicho específico, considerando o impacto financeiro que o serviço gera?
    - reasoning: Explique a lógica. "O serviço X resolve a dor Y do nicho Z, o que gera lucro W, por isso eles pagam."
    - potential: Qual o tamanho da oportunidade?
    
    SAÍDA JSON (ESTRITAMENTE COERENTE):
    {
      "recommendedNiche": "Texto",
      "suggestedTicket": 1500,
      "reasoning": "Texto Lógico",
      "potential": "Texto"
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.5 
      }
    });
    
    const text = response.text || "";
    const json = extractJson(text);
    
    if (!json || !json.recommendedNiche) throw new Error("Falha na geração");

    return json;

  } catch (error) {
    return {
      recommendedNiche: targetAudience || "Empresas de Alto Padrão",
      suggestedTicket: 2000,
      reasoning: `Seu serviço de ${serviceName} tem alto valor agregado para ${targetAudience || "o mercado"}, pois resolve dores diretas de faturamento.`,
      potential: "Alta demanda reprimida neste setor."
    };
  }
};

export const generateKillerDifferential = async (serviceName: string, description: string, targetAudience: string = "Clientes"): Promise<string> => {
    const frameworks = [
        "GARANTIA DE RISCO REVERSO (Eu assumo o risco financeiro)",
        "MECANISMO ÚNICO (Nome proprietário científico + Método novo)",
        "OFERTA MAFIOSA (Irrecusável pela lógica financeira)",
        "ANTI-AGÊNCIA (Nós odiamos o modelo padrão, fazemos o oposto)",
        "A PROMESSA DE VELOCIDADE (Resultado rápido ou multa)",
        "IDENTIDADE E STATUS (Venda para o Ego do cliente)",
        "DOR AGUDA (Foco total em resolver um pesadelo agora)"
    ];
    
    const selectedFramework = frameworks[Math.floor(Math.random() * frameworks.length)];

    const prompt = `
      ATUE COMO O MELHOR COPYWRITER DO MUNDO (Alex Hormozi Mode).
      
      FRAMEWORK ESCOLHIDO PARA ESTA VERSÃO: ${selectedFramework}.

      DADOS DO USUÁRIO:
      - SERVIÇO: "${serviceName}"
      - PÚBLICO ALVO: "${targetAudience}"
      - CONTEXTO TÉCNICO: "${description}"

      SUA MISSÃO: Criar uma oferta ÚNICA e EXCLUSIVA para este público específico.
      
      REGRAS OBRIGATÓRIAS:
      1. CITE O NOME DO PÚBLICO ALVO (${targetAudience}) explicitamente no texto.
      2. CRIE UM NOME PARA O MÉTODO (Ex: Protocolo X, Sistema Y). Não use o nome genérico do serviço.
      3. CRIE UMA GARANTIA ESPECÍFICA (Ex: "Devolvo R$ 500", "Trabalho de graça").
      4. NUNCA use o texto genérico "Sistema de Aquisição Automática" a menos que faça sentido.
      5. SEJA ESPECÍFICO SOBRE O SERVIÇO: Se é site, fale de site. Se é tráfego, fale de leads.

      SAÍDA (Texto curto e impactante, máx 3 linhas):
    `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 1.1 } 
        });
        const text = response.text?.trim();
        if (!text || text.length < 10) throw new Error("Resposta curta demais");
        return text;
    } catch (e) {
        const audience = targetAudience || "seus clientes";
        const service = serviceName || "serviço";
        return `Implemento o Método ${service.split(' ')[0]}-Turbo para ${audience}. Se não dobrar seus resultados em 30 dias, eu devolvo 100% do investimento e pago R$ 200 do meu bolso.`;
    }
};

export const handleObjection = async (leadName: string, objectionType: ObjectionType, serviceContext: ServiceContext): Promise<string> => {
    const prompt = `
        ATUE COMO UM NEGOCIADOR DO FBI.
        OBJEÇÃO: ${objectionType}
        SERVIÇO: ${serviceContext.serviceName}
        
        Gere uma resposta curta para WhatsApp que DESARME o cliente sem ser chato.
        IDIOMA: PT-BR.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text?.trim() || "";
    } catch (e) { return "Entendo. O que te impede agora?"; }
};

export const calculateInactionCost = async (lead: Lead, serviceContext: ServiceContext): Promise<string> => {
    const prompt = `
        CALCULE O PREJUÍZO (CUSTO DA INAÇÃO).
        CLIENTE: ${lead.name}
        SERVIÇO: ${serviceContext.serviceName}
        Gere um texto curto com números assustadores (mas realistas) sobre quanto ele perde por não contratar.
        IDIOMA: PT-BR.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text?.trim() || "";
    } catch (e) { return "Você está perdendo clientes diariamente."; }
};

export const generateNeuroSequence = async (serviceContext: ServiceContext): Promise<SequenceDay[]> => {
    const prompt = `
      CRIE UMA SEQUÊNCIA DE FOLLOW-UP DE 5 DIAS (Cadência de Vendas).
      SERVIÇO: ${serviceContext.serviceName}
      FORMATO JSON ARRAY: [{ "day": "Dia 1", "trigger": "Motivo", "message": "Texto Zap", "explanation": "Por quê" }]
      IDIOMA: PT-BR.
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text || "[]");
    } catch (e) { return []; }
};

export const runRoleplayTurn = async (profile: RoleplayProfile, chatHistory: RoleplayMessage[], serviceContext: ServiceContext): Promise<RoleplayMessage> => {
    const prompt = `
      ROLEPLAY DE VENDAS.
      CLIENTE: ${profile}. SERVIÇO: ${serviceContext.serviceName}.
      HISTÓRICO: ${JSON.stringify(chatHistory)}
      SAÍDA JSON: { "text": "Resposta Cliente", "feedback": "Dica Coach", "score": 0-10, "betterResponse": "Melhor Resposta" }
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return { sender: 'ai', ...JSON.parse(response.text || "{}") };
    } catch (e) { return { sender: 'ai', text: "Erro.", feedback: "Erro.", score: 0 }; }
};

export const analyzeChatHistory = async (chatText: string, serviceContext: ServiceContext): Promise<ChatAnalysis> => {
    const prompt = `
        ANÁLISE DE CHAT REAL.
        SERVIÇO: ${serviceContext.serviceName}
        CHAT: ${chatText.substring(0, 3000)}
        SAÍDA JSON: { "score": 0-100, "sentiment": "neutral", "hiddenIntent": "Texto", "nextMove": "Texto", "tip": "Texto" }
    `;
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text || "{}");
    } catch (e) { return { score: 0, sentiment: 'neutral', hiddenIntent: "Erro", nextMove: "Erro", tip: "Erro" }; }
};