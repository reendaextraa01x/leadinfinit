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
    if (!serviceContext.serviceName) return [
        "Empresas com avaliações ruins no Google Maps",
        "Negócios sem website oficial",
        "Lojas com Instagram desatualizado"
    ];

    const prompt = `
        ATUE COMO UM ESTRATEGISTA DE PROSPECÇÃO B2B.
        
        SERVIÇO DO USUÁRIO: "${serviceContext.serviceName}"
        DESCRIÇÃO: "${serviceContext.description}"
        
        TAREFA: Crie 3 instruções de busca ("Prompts Táticos") curtas e específicas para encontrar os leads PERFEITOS para esse serviço.
        ORDENE PELA MELHOR IDEIA PRIMEIRO.
        
        SAÍDA: APENAS UM ARRAY JSON DE STRINGS.
        ["A melhor ideia aqui", "Outra ideia boa", "Ideia alternativa"]
        
        IDIOMA: PORTUGUÊS DO BRASIL.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const text = response.text || "[]";
        return JSON.parse(text);
    } catch (e) {
        return [];
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
 * CONSULTORIA ESTRATÉGICA (AGORA COM VARIAÇÃO DE ARQUÉTIPOS)
 */
export const generateServiceInsights = async (serviceName: string, description: string): Promise<ServiceInsights> => {
  // ROLETA DE ESTRATÉGIAS
  const archetypes = [
    { name: "O CAÇADOR DE BALEIAS", focus: "Foque exclusivamente em clientes High-Ticket (Ricos) que pagam caro por exclusividade." },
    { name: "O SNIPER DE MICRO-NICHO", focus: "Encontre um sub-nicho extremamente específico e ignorado (Oceano Azul)." },
    { name: "O OPORTUNISTA DE CRISE", focus: "Foque em nichos que têm um problema urgente e doloroso que precisa ser resolvido ontem." },
    { name: "O PARCEIRO DE ESCALA", focus: "Foque em empresas que já faturam bem mas estão travadas tecnologicamente." }
  ];
  
  const selectedArchetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  const prompt = `
    ATUE COMO UM CONSULTOR DE NEGÓCIOS DE ELITE.
    
    O USUÁRIO VENDE: "${serviceName}"
    DESCRIÇÃO: "${description}"

    SEU ARQUÉTIPO HOJE: ${selectedArchetype.name}.
    SUA LENTE DE ANÁLISE: ${selectedArchetype.focus}.

    TAREFA: Baseado APENAS nesse arquétipo, defina uma estratégia ÚNICA.
    NÃO SEJA GENÉRICO. NÃO DIGA "Pequenas Empresas". DIGA "Clínicas de Fertilidade" ou "Indústria Têxtil".
    
    1. MELHOR NICHO: Seja ultra-específico.
    2. TICKET SUGERIDO: Um valor alto e ousado em R$.
    3. POR QUE: A lógica psicológica por trás dessa escolha.
    4. POTENCIAL: O tamanho da oportunidade em dinheiro.

    Formato JSON:
    {
      "recommendedNiche": "Nome do Nicho Específico",
      "suggestedTicket": 0000,
      "reasoning": "Texto persuasivo explicando a escolha...",
      "potential": "Texto sobre o mercado..."
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.9 // Alta temperatura para garantir variedade a cada clique
      }
    });
    
    const text = response.text || "";
    const json = extractJson(text);
    return json || {
        recommendedNiche: "Nicho Específico (Erro na IA)",
        suggestedTicket: 2000,
        reasoning: "Tente gerar novamente para uma nova estratégia.",
        potential: "Alta demanda."
    };
  } catch (error) {
    return {
      recommendedNiche: "Consultórios Médicos Particulares",
      suggestedTicket: 2500,
      reasoning: "Público com alta margem de lucro que perde pacientes por falta de agendamento online.",
      potential: "Mercado de saúde privada movimenta bilhões."
    };
  }
};

/**
 * OFERTA IRRESISTÍVEL (AGORA COM VARIAÇÃO DE FRAMEWORKS)
 */
export const generateKillerDifferential = async (serviceName: string, currentDescription: string): Promise<string> => {
    // ROLETA DE FRAMEWORKS DE OFERTA
    const frameworks = [
        "GARANTIA DE RISCO REVERSO (Se eu falhar, eu te pago)",
        "MECANISMO ÚNICO (Nome proprietário estranho e curioso)",
        "OFERTA MAFIOSA (Uma oferta tão boa que recusar parece burrice)",
        "ANTI-AGÊNCIA (Nós não fazemos X, nós fazemos Y que gera dinheiro)"
    ];
    const selectedFramework = frameworks[Math.floor(Math.random() * frameworks.length)];

    const prompt = `
      ATUE COMO UM ENGENHEIRO DE OFERTAS (Nível Alex Hormozi).
      
      FRAMEWORK SELECIONADO: ${selectedFramework}.
      (Use este estilo agressivamente para diferenciar a resposta das anteriores).

      O USUÁRIO VENDE: "${serviceName}"
      DETALHES: "${currentDescription}"

      OBJETIVO: Criar uma promessa ÚNICA, EXCLUSIVA e OUSADA.
      
      PROIBIDO: "Melhoro seus resultados", "Serviço de qualidade", "Otimização".
      OBRIGATÓRIO: Nomes criativos, Garantias com números, Promessas de Tempo.

      SAÍDA: Um parágrafo curto e matador (2-3 frases) em PORTUGUÊS DO BRASIL.
    `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 1.0 } // Máxima criatividade
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "Implemento o Sistema de Aquisição Automática em 14 dias. Se não gerar ROI positivo no primeiro mês, devolvo 100% do seu dinheiro e trabalho de graça até gerar.";
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
