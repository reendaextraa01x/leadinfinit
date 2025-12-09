// @ts-nocheck
declare var process: any;

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights, ObjectionType, SequenceDay, RoleplayProfile, RoleplayMessage, ChatAnalysis, SearchFilters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper ROBUSTO para limpar JSON
const extractJson = (text: string): any => {
  try {
    const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]);
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Falha crítica ao processar JSON da IA. Texto recebido:", text);
    return null;
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

export const generateLeads = async (
  niche: string, 
  location: string, 
  size: BusinessSize,
  count: number,
  existingNames: string[],
  serviceContext?: ServiceContext,
  filters?: SearchFilters,
  customInstruction?: string
): Promise<{ leads: Lead[], sources: GroundingSource[] }> => {
  
  let serviceStrategy = "";
  if (serviceContext && serviceContext.serviceName) {
    serviceStrategy = `
    >>> MODO CAÇADOR ATIVADO: FILTRO DE ALTA QUALIDADE <<<
    O USUÁRIO VENDE: "${serviceContext.serviceName}"
    DESCRIÇÃO DA OFERTA: "${serviceContext.description}"
    PÚBLICO ALVO: "${serviceContext.targetAudience || 'Geral'}"
    
    SUA MISSÃO: Usar o Google Search para encontrar empresas reais com UMA DOR ESPECÍFICA que este serviço resolve.
    Exemplos do que buscar:
    - Se vende SITES -> Busque empresas SEM SITE, com sites QUEBRADOS ou FEIOS/ANTIGOS.
    - Se vende TRÁFEGO -> Busque empresas invisíveis no Google ou com pouco engajamento.
    - Se vende REDES SOCIAIS -> Busque empresas com Instagram abandonado ou fotos ruins.
    
    NÃO liste empresas aleatórias. Liste empresas que são "Vendas Fáceis" (Easy Wins).
    `;
  } else {
    serviceStrategy = `
    >>> MODO CAÇADOR ATIVADO <<<
    Encontre empresas reais que pareçam precisar de Modernização Digital (Sem site, marca antiga, poucas avaliações).
    `;
  }

  let advancedFilters = "";
  if (filters) {
      if (filters.websiteRule === 'must_have') advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter um website ativo.\n";
      if (filters.websiteRule === 'must_not_have') advancedFilters += "- OBRIGATÓRIO: O lead NÃO PODE ter website (ou deve estar quebrado/404).\n";
      if (filters.mustHaveInstagram) advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter perfil no Instagram.\n";
      if (filters.mobileOnly) advancedFilters += "- OBRIGATÓRIO: Priorize números de celular/WhatsApp ((XX) 9...).\n";
  }

  let laserScope = "";
  if (customInstruction) {
      laserScope = `
      >>> ORDEM PRIORITÁRIA (MIRA LASER - CRÍTICO) <<<
      O usuário definiu uma regra específica de busca. SIGA ISSO ACIMA DE TUDO:
      "${customInstruction}"
      `;
  }

  const requestCount = Math.ceil(count * 1.5);

  const prompt = `
    ATUE COMO UM SISTEMA DE INTELIGÊNCIA DE VENDAS DE ELITE (Focado no Brasil).
    USE A FERRAMENTA DE BUSCA DO GOOGLE AGORA.
    
    ALVO:
    - Nicho: "${niche}"
    - Localização: "${location}"
    - Porte: ${size} (Pequeno=Local/Iniciante, Médio=Estabelecido, Grande=Líder de Mercado/Famoso)
    
    ${serviceStrategy}
    
    ${advancedFilters}

    ${laserScope}
    
    REQUISITOS OBRIGATÓRIOS:
    1. ENCONTRE ${requestCount} LEADS REAIS (Empresas que existem).
    2. *** REGRA DO TELEFONE ***: Você DEVE encontrar um número válido (Preferência Celular/WhatsApp). Se não tiver telefone, NÃO INCLUA.
    3. EXCLUA estes nomes já existentes: ${existingNames.join(", ")}.
    4. IDIOMA: TODA A SAÍDA DEVE SER EM PORTUGUÊS DO BRASIL (PT-BR).
       - Traduza "No Website" para "Sem Site".
       - Traduza "Not Found" para "Não encontrado".
    
    PARA CADA LEAD, IDENTIFIQUE:
    - "painPoints": Lista de problemas detectados (Ex: ["Sem Site", "Avaliação Baixa", "Instagram Inativo"]). EM PORTUGUÊS.
    - "matchReason": Uma frase curta e persuasiva do porquê esse lead vai comprar. EM PORTUGUÊS.
    - "qualityTier": Classifique o poder de compra: 'opportunity' (Pequeno/Iniciante), 'high-ticket' (Estabelecido/Rico), 'urgent' (Com problemas críticos).

    IMPORTANTE: RETORNE APENAS O ARRAY JSON. NÃO ESCREVA NADA ANTES NEM DEPOIS.
    [
      {
        "name": "Nome do Negócio",
        "phone": "(XX) 9XXXX-XXXX",
        "instagram": "https://instagram.com/...",
        "website": "URL ou 'Sem Site'",
        "description": "Breve descrição do negócio em PT-BR.",
        "painPoints": ["Sem Site", "Nota Baixa no Google"],
        "matchReason": "Alvo ideal pois tem muito fluxo mas presença digital zero.",
        "qualityTier": "high-ticket"
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

    let sources: GroundingSource[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      sources = response.candidates[0].groundingMetadata.groundingChunks
        .map((chunk: any) => chunk.web)
        .filter((web: any) => web && web.uri && web.title)
        .map((web: any) => ({ title: web.title, uri: web.uri }));
    }

    if (!Array.isArray(rawLeads)) {
      return { leads: [], sources: [] };
    }

    const leads: Lead[] = rawLeads
      .map((item: any, index: number) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || "Desconhecido",
        phone: item.phone || "Não encontrado",
        instagram: (item.instagram === "Not Found" || !item.instagram || item.instagram === "Não encontrado") ? null : item.instagram,
        description: item.description || "Sem descrição disponível.",
        website: (item.website === "Not Found" || !item.website || item.website === "Sem Site" || item.website === "Não encontrado") ? undefined : item.website,
        painPoints: Array.isArray(item.painPoints) ? item.painPoints : [],
        matchReason: item.matchReason || "Oportunidade de modernização digital.",
        confidenceScore: 1,
        status: 'new' as LeadStatus,
        score: calculateLeadScore(item),
        qualityTier: item.qualityTier || 'opportunity'
      }))
      .filter((lead) => {
        const isNotFound = lead.phone === "Não encontrado" || lead.phone === "Not Found";
        const clean = cleanPhone(lead.phone);
        return !isNotFound && clean !== null;
      });

    return { leads, sources };

  } catch (error) {
    console.error("Erro na busca Gemini:", error);
    return { leads: [], sources: [] }; 
  }
};

export const generateTacticalPrompts = async (serviceContext: ServiceContext): Promise<string[]> => {
    // Fallback inteligente se não houver serviço configurado
    if (!serviceContext.serviceName) return [
        "Apenas empresas com avaliação menor que 4.0 no Google Maps",
        "Negócios locais que não possuem site oficial nos resultados",
        "Restaurantes com Instagram ativo mas sem link de pedidos na bio"
    ];

    const prompt = `
        ATUE COMO UM ESPECIALISTA EM GOOGLE DORKING E PESQUISA AVANÇADA.
        
        SERVIÇO DO USUÁRIO: "${serviceContext.serviceName}"
        DESCRIÇÃO: "${serviceContext.description}"
        
        MISSÃO: Crie 3 instruções de "Mira Laser" (Filtros de Busca) para encontrar o cliente PERFEITO que tem a dor que esse serviço resolve.
        
        REGRAS:
        1. As ideias devem ser ordens diretas para a IA de busca.
        2. Foco em "Problemas Visíveis" (Ex: Sem site, reviews ruins, site lento).
        3. ORDENE PELA MELHOR E MAIS LUCRATIVA IDEIA PRIMEIRO.
        
        SAÍDA ESPERADA (JSON ARRAY DE STRINGS):
        ["Apenas clínicas de estética que não têm site e usam Linktree", "Empresas de engenharia com sites que não abrem no celular", "Advogados com menos de 10 avaliações no Google"]
        
        IDIOMA: PORTUGUÊS DO BRASIL.
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
        // Usa o extrator robusto para evitar quebras
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

/**
 * CONSULTORIA ESTRATÉGICA (LOGIC-LOCK V2: COERÊNCIA TOTAL)
 * Agora, a função é estritamente lógica e não usa aleatoriedade para evitar alucinações.
 */
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
        temperature: 0.5 // Baixa temperatura para garantir lógica e consistência, sem "viagens"
      }
    });
    
    const text = response.text || "";
    const json = extractJson(text);
    
    // Validação de segurança para garantir que o fallback não seja estático
    if (!json || !json.recommendedNiche) throw new Error("Falha na geração");

    return json;

  } catch (error) {
    // Fallback Dinâmico (Usa os dados do usuário para não parecer quebrado)
    return {
      recommendedNiche: targetAudience || "Empresas de Alto Padrão",
      suggestedTicket: 2000,
      reasoning: `Seu serviço de ${serviceName} tem alto valor agregado para ${targetAudience || "o mercado"}, pois resolve dores diretas de faturamento.`,
      potential: "Alta demanda reprimida neste setor."
    };
  }
};

/**
 * OFERTA IRRESISTÍVEL (AGORA COM VARIAÇÃO DE FRAMEWORKS PODEROSOS E PERSONALIZAÇÃO DE NOME)
 */
export const generateKillerDifferential = async (serviceName: string, description: string, targetAudience: string = "Clientes"): Promise<string> => {
    // ROLETA DE FRAMEWORKS DE COPYWRITING DE ELITE
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
        // Fallback dinâmico em vez de estático
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