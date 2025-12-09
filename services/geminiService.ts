
// @ts-nocheck
declare var process: any;

import { GoogleGenAI, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights, ObjectionType, SequenceDay, RoleplayProfile, RoleplayMessage, ChatAnalysis, SearchFilters } from "../types";

// FALLBACK API KEY (SEGURANÇA EXTREMA)
// Se a variável de ambiente falhar, usamos esta chave hardcoded para garantir que o app não quebre.
const FALLBACK_KEY = "AIzaSyBYm1j6yzneb_kkl0RZJfwpfG2CRz8qUew";
const apiKey = process.env.API_KEY || FALLBACK_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey });

// Configuração de Segurança para liberar o "Modo Hunter"
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper ROBUSTO para limpar JSON (Versão Blindada v4)
const extractJson = (text: string): any => {
  try {
    if (!text) return [];

    // 1. Tenta encontrar blocos de código JSON
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      try { return JSON.parse(jsonBlockMatch[1]); } catch (e) { /* continua */ }
    }
    
    // 2. Tenta encontrar o array [ ... ] ou objeto { ... } no texto bruto
    const firstBracket = text.indexOf('[');
    const firstBrace = text.indexOf('{');
    const lastBracket = text.lastIndexOf(']');
    const lastBrace = text.lastIndexOf('}');
    
    // Prioriza Array se ambos existirem, mas tenta o que vier primeiro/por último logicamente
    if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonCandidate = text.substring(firstBracket, lastBracket + 1);
        try { return JSON.parse(jsonCandidate); } catch (e) { /* continua */ }
    }
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        const jsonCandidate = text.substring(firstBrace, lastBrace + 1);
        try { return JSON.parse(jsonCandidate); } catch (e) { /* continua */ }
    }

    // 3. Última tentativa: Se falhar, tenta limpar caracteres inválidos comuns
    const cleanedText = text.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
    return JSON.parse(cleanedText);
  } catch (e) {
    console.warn("Falha ao extrair JSON:", e);
    return []; 
  }
};

const cleanPhone = (phone: string): string | null => {
  if (!phone) return null;
  // Remove tudo que não é dígito
  const cleaned = phone.replace(/\D/g, '');
  
  // Aceita números fixos (10 dígitos) e celulares (11 dígitos) do Brasil
  // Aceita também formatos internacionais se tiverem pelo menos 8 dígitos
  if (cleaned.length < 8) return null;
  
  return cleaned;
};

// Calcula Temperatura do Lead
const calculateLeadScore = (lead: any): LeadScore => {
    if (!lead.website || lead.website === "Não encontrado" || lead.website === "" || lead.website === "Sem Site") {
        return 'hot';
    }
    if (lead.instagram && lead.instagram !== "Não encontrado") {
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
  const maxAttempts = 5; // Limite de tentativas para não ficar infinito
  
  // Lista negra temporária para esta sessão de busca
  let currentSessionNames = [...existingNames];

  // Estratégias de busca rotativas para forçar resultados diferentes
  // A ordem importa: começa com o mais específico para contatos
  const searchQueries = [
      `${niche} em ${location} whatsapp telefone contato`,
      `lista empresas ${niche} ${location} telefone`,
      `${niche} ${location} instagram site`,
      `melhores ${niche} em ${location}`,
      `empresas de ${niche} ${location} endereço`
  ];

  while (allLeads.length < targetCount && attempts < maxAttempts) {
      // Se acabarem as queries, repete a última ou usa uma genérica
      const currentQuery = searchQueries[attempts] || `${niche} ${location} negócios`;
      attempts++;
      
      const leadsNeeded = targetCount - allLeads.length;
      // Pedimos SEMPRE um lote grande para a IA ter de onde filtrar e tentar preencher em 1 ou 2 loops
      const requestBatchSize = 25; 

      console.log(`[Busca] Tentativa ${attempts}/${maxAttempts}: Query="${currentQuery}". Leads atuais: ${allLeads.length}/${targetCount}`);

      let serviceStrategy = "";
      if (serviceContext && serviceContext.serviceName) {
        serviceStrategy = `
        CONTEXTO DE VENDA:
        - O usuário vende: "${serviceContext.serviceName}"
        - Busque empresas que precisem disso (Ex: se vende sites, priorize quem não tem site).
        `;
      }
    
      // Instruções de filtro para o Prompt (Soft Filter)
      let promptFilters = "";
      if (filters) {
          if (filters.websiteRule === 'must_have') promptFilters += "- Retorne APENAS empresas que possuem site visível.\n";
          if (filters.websiteRule === 'must_not_have') promptFilters += "- Retorne APENAS empresas SEM site ou com site ruim.\n";
          if (filters.mustHaveInstagram) promptFilters += "- Retorne APENAS empresas com Instagram ativo detectável.\n";
      }

      // IMPORTANTE: O prompt abaixo foi desenhado para evitar que a IA se recuse a dar dados.
      // Usamos "Dados Públicos" e "Diretório" para passar pelos filtros de segurança.
      const prompt = `
        VOCÊ É UM EXTRATOR DE DADOS DE DIRETÓRIOS PÚBLICOS DE NEGÓCIOS (Google Maps).
        SUA TAREFA É APENAS FORMATAR DADOS JÁ PÚBLICOS EM JSON.

        BUSCA: "${currentQuery}"
        
        ${serviceStrategy}
        ${promptFilters}
        ${customInstruction ? `FILTRO ESPECIAL DO USUÁRIO (MIRA LASER): ${customInstruction}` : ""}
        
        INSTRUÇÕES DE EXTRAÇÃO:
        1. Liste ${requestBatchSize} empresas REAIS encontradas nesta busca.
        2. EXTRAIA O TELEFONE/WHATSAPP PÚBLICO. Se não estiver óbvio, procure no snippet.
        3. Se não encontrar o telefone exato, mas a empresa existir, coloque "Não encontrado" (não invente).
        4. IGNORE estes nomes já listados: ${currentSessionNames.join(", ")}.
        5. IDIOMA: PORTUGUÊS (PT-BR).
    
        FORMATO OBRIGATÓRIO DE SAÍDA (JSON ARRAY PURO):
        [
          {
            "name": "Nome da Empresa",
            "phone": "(XX) XXXX-XXXX", 
            "instagram": "@usuario ou link",
            "website": "URL ou 'Sem Site'",
            "description": "Breve descrição do estado digital da empresa.",
            "painPoints": ["Sem Site", "Avaliação Baixa", "Instagram Inativo"],
            "matchReason": "Motivo curto do porquê é um bom lead.",
            "qualityTier": "high-ticket" | "opportunity" | "urgent"
          }
        ]
        
        NÃO ESCREVA NADA ALÉM DO JSON.
      `;
    
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.5, // Baixa criatividade para focar em dados reais
            safetySettings: safetySettings,
          },
        });
    
        const text = response.text || "";
        const rawLeads = extractJson(text);
    
        // Captura fontes (Grounding)
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const newSources = response.candidates[0].groundingMetadata.groundingChunks
            .map((chunk: any) => chunk.web)
            .filter((web: any) => web && web.uri && web.title)
            .map((web: any) => ({ title: web.title, uri: web.uri }));
            allSources = [...allSources, ...newSources];
        }
    
        if (Array.isArray(rawLeads) && rawLeads.length > 0) {
            const validLeadsInBatch: Lead[] = rawLeads
              .map((item: any, index: number) => ({
                id: `${Date.now()}-${attempts}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                name: item.name || "Desconhecido",
                phone: item.phone || "Não encontrado",
                instagram: (item.instagram === "Not Found" || !item.instagram || item.instagram === "Não encontrado") ? null : item.instagram,
                description: item.description || "Oportunidade de negócio detectada.",
                website: (item.website === "Not Found" || !item.website || item.website === "Sem Site" || item.website === "Não encontrado") ? undefined : item.website,
                painPoints: Array.isArray(item.painPoints) ? item.painPoints : ["Presença Digital Fraca"],
                matchReason: item.matchReason || "Lead compatível com seu serviço.",
                confidenceScore: 1,
                status: 'new' as LeadStatus,
                score: calculateLeadScore(item),
                qualityTier: item.qualityTier || 'opportunity'
              }))
              .filter((lead) => {
                // Filtro de Duplicidade
                const isDuplicate = currentSessionNames.some(existingName => 
                    existingName.toLowerCase() === lead.name.toLowerCase()
                );
                if (isDuplicate) return false;

                // FILTRO DE SEGURANÇA (Telefone Obrigatório)
                if (!lead.phone || lead.phone === "Não encontrado") return false;

                // Filtro "Mobile Only" (Apenas Celular)
                if (filters?.mobileOnly) {
                   const clean = cleanPhone(lead.phone);
                   // Se não tem número limpo ou é curto (fixo s/ DDD as vezes vem errado, ou números curtos estranhos)
                   // No Brasil: Celulares tem 11 dígitos, Fixos 10. 
                   // Vamos garantir pelo menos 8 dígitos para não descartar internacionais,
                   // mas para BR, Mobile geralmente começa com 9 na posição correta.
                   // Para simplicidade e robustez, filtramos apenas lixo muito curto.
                   if (!clean || clean.length < 8) return false;
                }

                return true;
              });

            if (validLeadsInBatch.length > 0) {
                allLeads = [...allLeads, ...validLeadsInBatch];
                validLeadsInBatch.forEach(l => currentSessionNames.push(l.name));
            }
        }
    
      } catch (error: any) {
        console.error(`Erro na tentativa ${attempts}:`, error);
        
        // Se for erro de permissão (403/401), aborta para não travar o loop
        if (error.toString().includes('403') || error.toString().includes('401') || error.message?.includes('API key')) {
             throw new Error("Chave de API inválida ou bloqueada pelo Google. Verifique o Vercel.");
        }

        // Não para o loop, tenta a próxima query
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
  }

  // Se após todas as tentativas não tivermos leads suficientes, retornamos o que temos.
  // O App.tsx vai lidar com a mensagem de erro se o array estiver vazio.
  return { leads: allLeads.slice(0, targetCount), sources: allSources };
};

export const generateTacticalPrompts = async (serviceContext: ServiceContext): Promise<string[]> => {
    if (!serviceContext.serviceName) return [
        "Apenas empresas com avaliação menor que 4.0 no Google Maps",
        "Negócios locais que não possuem site oficial nos resultados",
        "Restaurantes com Instagram ativo mas sem link de pedidos na bio"
    ];

    const prompt = `
        ATUE COMO UM ESPECIALISTA EM PESQUISA DE MERCADO (GOOGLE DORKING).
        SERVIÇO: "${serviceContext.serviceName}"
        DESCRIÇÃO: "${serviceContext.description}"
        
        Gere 3 instruções de busca (filtros) para encontrar clientes ideais no Google Maps.
        
        REGRAS:
        - Devem ser comandos diretos de filtro.
        - Devem focar em "Dores" que o serviço resolve.
        - IDIOMA: PT-BR
        
        SAÍDA JSON ARRAY: ["Ideia 1", "Ideia 2", "Ideia 3"]
        NÃO ESCREVA NADA ALÉM DO JSON.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { 
                temperature: 0.8,
                safetySettings: safetySettings 
            }
        });
        const json = extractJson(response.text || "[]");
        return Array.isArray(json) ? json : [
             "Apenas empresas com site quebrado ou fora do ar",
             "Negócios com muitas reclamações recentes",
             "Empresas invisíveis na primeira página do Google"
        ];
    } catch (e) {
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
      config: { temperature: 1.5, safetySettings: safetySettings }
    });
    return response.text?.trim() || "";
  } catch (error) {
    return `Fala ${lead.name}, vi aqui que vocês estão sem site. Bora resolver?`;
  }
};

/**
 * GERAÇÃO DE COPY EM LOTE (OTIMIZAÇÃO DE VELOCIDADE)
 * Processa múltiplos leads em uma única chamada de API.
 */
export const generateMarketingCopyBatch = async (
    leads: Lead[], 
    serviceContext: ServiceContext
  ): Promise<Record<string, string>> => {
    if (!serviceContext.serviceName || leads.length === 0) return {};
  
    // Minificar os dados enviados para economizar tokens
    const minifiedLeads = leads.map(l => ({
        id: l.id,
        name: l.name,
        desc: l.description,
        pains: l.painPoints
    }));
  
    const prompt = `
      ATUE COMO UM COPYWRITER DE RESPOSTA DIRETA DE ELITE.
      
      CONTEXTO DO MEU SERVIÇO:
      - Nome: ${serviceContext.serviceName}
      - Público: ${serviceContext.targetAudience}
      - Oferta: ${serviceContext.description}
  
      TAREFA:
      Gere uma mensagem de abordagem fria (Cold DM) curta e persuasiva para cada um dos leads abaixo.
      Use estratégias variadas (Ego, Dor, Curiosidade) para cada um.
      
      LEADS:
      ${JSON.stringify(minifiedLeads)}
  
      REGRAS:
      1. IDIOMA: PORTUGUÊS DO BRASIL. Informal e direto.
      2. MÁXIMO 2-3 frases por mensagem.
      3. RETORNE APENAS UM JSON ONDE A CHAVE É O ID DO LEAD E O VALOR É A MENSAGEM.
      
      SAÍDA JSON EXATA:
      {
        "id_do_lead_1": "Mensagem...",
        "id_do_lead_2": "Mensagem..."
      }
    `;
  
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            temperature: 1.2, 
            safetySettings: safetySettings 
        }
      });
      const result = extractJson(response.text || "{}");
      return result;
    } catch (error) {
      console.error("Erro em batch copy:", error);
      // Fallback: retorna vazio, o UI vai lidar ou tentar individual
      return {};
    }
  };

export const generateLeadAudit = async (lead: Lead, serviceContext: ServiceContext): Promise<string> => {
    const prompt = `
        ATUE COMO UM AUDITOR DIGITAL IMPLACÁVEL (Direto e Objetivo).
        ANALISE: ${lead.name} (${lead.website || "Sem Site"}, ${lead.instagram || "Sem Insta"}).
        SERVIÇO VENDIDO: ${serviceContext.serviceName}
        
        IDENTIFIQUE 3 FALHAS CRÍTICAS E VISÍVEIS QUE ESTÃO FAZENDO ELES PERDEREM DINHEIRO AGORA.
        
        REGRAS DE OURO:
        1. SEJA CURTO: Máximo de 1 frase por ponto.
        2. SEJA OBJETIVO: Nada de "sugiro melhorar". Diga "O link não funciona".
        3. FOQUE NO LUCRO: Mostre que o erro custa clientes.
        4. IDIOMA: Português do Brasil.
        
        FORMATO OBRIGATÓRIO:
        1. ❌ [Falha Técnica/Visual] -> [Consequência Financeira]
        2. ❌ [Falha] -> [Consequência]
        3. ❌ [Falha] -> [Consequência]
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 0.6, safetySettings: safetySettings }
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "1. ❌ Sem Site Otimizado -> Perda de credibilidade e vendas.\n2. ❌ Google Meu Negócio incompleto -> Invisível no mapa.\n3. ❌ Sem canais de conversão -> Clientes desistem de comprar.";
    }
}

export const generateServiceInsights = async (serviceName: string, description: string, targetAudience: string = ""): Promise<ServiceInsights> => {
  const audienceInstruction = targetAudience 
      ? `O usuário definiu EXPLICITAMENTE o público: "${targetAudience}". Você DEVE sugerir um nicho DENTRO deste público. Ex: Se ele disse "Médicos", sugira "Cirurgiões Plásticos". NÃO MUDE O SETOR.`
      : "O usuário não definiu público. Encontre o setor que paga mais caro por este serviço.";

  const prompt = `
    ATUE COMO UM ESTRATEGISTA DE NEGÓCIOS SÊNIOR (Lógica Pura).
    
    DADOS:
    1. SERVIÇO: "${serviceName}"
    2. DESCRIÇÃO: "${description}"
    3. RESTRIÇÃO: ${audienceInstruction}

    TAREFA: Conecte o serviço ao comprador ideal usando lógica financeira.
    
    PERGUNTAS PARA O JSON:
    - recommendedNiche: O sub-nicho específico com mais dinheiro. (Ex: "Imobiliárias de Alto Padrão", não só "Imobiliárias").
    - suggestedTicket: Valor justo (em R$) baseado no ROI que o serviço gera.
    - reasoning: A lógica de Venda. "O serviço X resolve a dor Y, gerando Z de lucro."
    - potential: Tamanho da oportunidade.
    
    SAÍDA JSON (SEM TEXTO EXTRA):
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
        temperature: 0.4, // Baixa temperatura para lógica
        safetySettings: safetySettings
      }
    });
    
    const json = extractJson(response.text || "");
    if (!json || !json.recommendedNiche) throw new Error("Falha na geração");
    return json;

  } catch (error) {
    return {
      recommendedNiche: targetAudience || "Empresas de Alto Padrão",
      suggestedTicket: 2000,
      reasoning: `Seu serviço de ${serviceName} tem alto valor para ${targetAudience || "o mercado"} pois ataca diretamente a conversão de vendas.`,
      potential: "Alta demanda reprimida."
    };
  }
};

export const generateKillerDifferential = async (serviceName: string, description: string, targetAudience: string = "Clientes"): Promise<string> => {
    const frameworks = [
        "RISCO REVERSO (Devolvo o dinheiro + Multa)",
        "MECANISMO ÚNICO (Nome proprietário do método)",
        "OFERTA MAFIOSA (Irrecusável pela lógica)",
        "ANTI-AGÊNCIA (Nós odiamos o padrão)",
        "VELOCIDADE EXTREMA (Resultado em X dias)",
        "STATUS E ELITE (Apenas para quem fatura X)",
        "DOR AGUDA (Resolvo seu pesadelo hoje)"
    ];
    
    // Seleção aleatória para garantir variação
    const selectedFramework = frameworks[Math.floor(Math.random() * frameworks.length)];

    const prompt = `
      ATUE COMO ALEX HORMOZI (Engenheiro de Ofertas).
      FRAMEWORK: ${selectedFramework}.

      DADOS:
      - SERVIÇO: "${serviceName}"
      - PÚBLICO: "${targetAudience}"
      - DESCRIÇÃO TÉCNICA: "${description}"

      MISSÃO: Criar uma OFERTA GRAND SLAM de 1 parágrafo.
      
      OBRIGATÓRIO:
      1. Use o nome do público (${targetAudience}).
      2. Invente um nome para o Método (Ex: Protocolo Lucro Turbo).
      3. Crie uma Garantia Ousada.
      4. SEJA ESPECÍFICO. Nada de "aumento seus resultados". Diga "Coloco 10 leads no seu zap".
      5. NÃO REPITA TEXTOS ANTERIORES. SEJA CRIATIVO.

      SAÍDA (Texto curto):
    `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 1.2, safetySettings: safetySettings } // Alta temperatura para criatividade
        });
        const text = response.text?.trim();
        if (!text || text.length < 10) throw new Error("Resposta curta");
        return text;
    } catch (e) {
        // Fallback dinâmico para não repetir texto fixo
        const audience = targetAudience || "sua empresa";
        const methods = ["Protocolo Escala-X", "Sistema Venda-Automática", "Método Blindado"];
        const method = methods[Math.floor(Math.random() * methods.length)];
        return `Implemento o ${method} para ${audience}. Se não gerar resultado em 30 dias, devolvo seu investimento em dobro.`;
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
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { safetySettings: safetySettings } });
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
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { safetySettings: safetySettings } });
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
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", safetySettings: safetySettings } });
        return extractJson(response.text || "[]");
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
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", safetySettings: safetySettings } });
        return { sender: 'ai', ...extractJson(response.text || "{}") };
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
        const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json", safetySettings: safetySettings } });
        return extractJson(response.text || "{}");
    } catch (e) { return { score: 0, sentiment: 'neutral', hiddenIntent: "Erro", nextMove: "Erro", tip: "Erro" }; }
};