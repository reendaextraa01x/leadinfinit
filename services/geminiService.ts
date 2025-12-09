// @ts-nocheck
declare var process: any;

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights, ObjectionType, SequenceDay, RoleplayProfile, RoleplayMessage, ChatAnalysis, SearchFilters } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper ROBUSTO para limpar JSON (Remove Markdown, Texto conversacional, etc)
const extractJson = (text: string): any => {
  try {
    // 1. Tenta encontrar um bloco de código JSON explícito
    const jsonBlockMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    if (jsonBlockMatch) {
      return JSON.parse(jsonBlockMatch[1]);
    }

    // 2. Se não achar bloco, tenta encontrar o primeiro '[' e o último ']' (Array)
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    // 3. Tenta parsear o texto direto (caso venha limpo)
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
    // Lógica: Sem site ou Site Quebrado = Oportunidade QUENTE (Dinheiro na mesa)
    if (!lead.website || lead.website === "Não encontrado" || lead.website === "" || lead.website === "Sem Site") {
        return 'hot';
    }
    // Tem site mas tem Instagram (Tentando, mas pode melhorar)
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
  
  // Prompt Otimizado para Velocidade e Contexto (HUNTER MODE)
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

  // APLICAÇÃO DE FILTROS AVANÇADOS (SNIPER SCOPE)
  let advancedFilters = "";
  if (filters) {
      if (filters.websiteRule === 'must_have') advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter um website ativo.\n";
      if (filters.websiteRule === 'must_not_have') advancedFilters += "- OBRIGATÓRIO: O lead NÃO PODE ter website (ou deve estar quebrado/404).\n";
      if (filters.mustHaveInstagram) advancedFilters += "- OBRIGATÓRIO: O lead DEVE ter perfil no Instagram.\n";
      if (filters.mobileOnly) advancedFilters += "- OBRIGATÓRIO: Priorize números de celular/WhatsApp ((XX) 9...).\n";
  }

  // MIRA LASER (Custom Instruction)
  let laserScope = "";
  if (customInstruction) {
      laserScope = `
      >>> ORDEM PRIORITÁRIA (MIRA LASER - CRÍTICO) <<<
      O usuário definiu uma regra específica de busca. SIGA ISSO ACIMA DE TUDO:
      "${customInstruction}"
      `;
  }

  // Pede um pouco mais para compensar o filtro de telefone
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
        temperature: 0.7, // Equilíbrio entre criatividade e precisão
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
      console.warn("IA não retornou array válido. Texto:", text);
      throw new Error("Formato de resposta inválido. Tente novamente.");
    }

    // Mapeamento, Limpeza e FILTRO RIGOROSO
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
      // O FILTRO: Remove qualquer coisa sem telefone válido
      .filter((lead) => {
        const isNotFound = lead.phone === "Não encontrado" || lead.phone === "Not Found";
        const clean = cleanPhone(lead.phone);
        return !isNotFound && clean !== null;
      });

    return { leads, sources };

  } catch (error) {
    console.error("Erro na busca Gemini:", error);
    // Retorna vazio para a UI tratar sem quebrar a app inteira
    return { leads: [], sources: [] }; 
  }
};

/**
 * GERA PROMPTS TÁTICOS (Sugestões de Busca Inteligente)
 */
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
        
        Exemplo (se fosse Venda de Sites):
        1. "Apenas clínicas médicas que não possuem site cadastrado no Google Maps."
        2. "Advogados com sites antigos (não responsivos) e fotos de baixa qualidade."
        3. "Restaurantes com muitas reclamações sobre atendimento no delivery."
        
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
        return [
            "Empresas sem presença digital consolidada",
            "Negócios com alta demanda mas site ruim",
            "Empresas locais com perfil incompleto"
        ];
    }
}

/**
 * Gera Copy de Marketing Hiper-Personalizada (PT-BR)
 */
export const generateMarketingCopy = async (
  lead: Lead, 
  serviceContext: ServiceContext
): Promise<string> => {
  
  if (!serviceContext.serviceName) {
    return `Olá ${lead.name}, tudo bem? Vi seu perfil e achei interessante o trabalho de vocês. Gostaria de conversar sobre uma oportunidade de parceria.`;
  }

  // Estratégias (Traduzidas para contexto da IA)
  const strategies = [
    "O CLIENTE OCULTO (Finja que tentou comprar mas teve problema)",
    "DINHEIRO PERDIDO (Aponte agressivamente onde estão perdendo vendas)",
    "INVEJA DO CONCORRENTE (Mencione que o concorrente está fazendo melhor)",
    "QUEBRA DE PADRÃO (Comece com uma pergunta estranha e específica)",
    "ISCA DE EGO (Elogie muito, depois bata no único ponto fraco)"
  ];
  const selectedStrategy = strategies[Math.floor(Math.random() * strategies.length)];

  const painPointsInfo = lead.painPoints && lead.painPoints.length > 0 
    ? `Problemas Específicos Detectados: ${lead.painPoints.join(", ")}`
    : "Problema: Falta de otimização digital geral.";

  const prompt = `
    ATUE COMO UM COPYWRITER DE RESPOSTA DIRETA DE ELITE (Focado em Cold DM/WhatsApp).
    Você é agressivo, persuasivo e usa gatilhos mentais.
    
    SUA ESTRATÉGIA PARA ESSA MENSAGEM: ${selectedStrategy}

    O Cliente (Recebedor):
    - Nome: ${lead.name}
    - Detalhes: "${lead.description}"
    - ${painPointsInfo}
    - Motivo do Match: ${lead.matchReason || "N/A"}
    
    Meu Serviço (Remetente):
    - Serviço: ${serviceContext.serviceName}
    - Oferta: ${serviceContext.description}
    
    REGRAS DA MENSAGEM:
    1. IDIOMA: PORTUGUÊS DO BRASIL. Informal, mas afiado. Use gírias como "Opa", "Fala [Nome]".
    2. SEM "Assunto:". Apenas o texto do corpo.
    3. CURTO. Otimizado para celular. Max 3-4 frases quebradas.
    4. EXTREMAMENTE PERSUASIVO. Foque na DOR (PAIN POINT).
    5. Se eles tiverem "Sem Site", use isso como gancho principal.
    
    SAÍDA APENAS O TEXTO DA MENSAGEM.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.5, // Alta criatividade
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    return `Fala ${lead.name}, vi aqui que vocês estão deixando dinheiro na mesa sem um site profissional. Bora resolver isso hoje?`;
  }
};

/**
 * Gera Auditoria Técnica (A Arma Secreta) - REALISMO EXTREMO PT-BR
 */
export const generateLeadAudit = async (lead: Lead, serviceContext: ServiceContext): Promise<string> => {
    const painContext = lead.painPoints ? `Problemas Conhecidos: ${lead.painPoints.join(", ")}` : "";
    
    const prompt = `
        ATUE COMO UM CONSULTOR DE NEGÓCIOS EXPERT (Sem alucinações técnicas).
        ALVO: ${lead.name} (${lead.description}).
        SERVIÇO VENDIDO: ${serviceContext.serviceName}
        ${painContext}
        
        TAREFA: Criar uma mini "Auditoria de Negócio" encontrando 3 PROBLEMAS VISÍVEIS baseados em dados públicos externos (Google Maps, Instagram, Site) que justifiquem a compra.
        
        REGRAS DE REALISMO:
        1. NÃO INVENTE erros de servidor ou código que você não pode ver.
        2. FOQUE EM: Poucas Avaliações (Prova Social), Falta de Site, Fotos Ruins, Sem Link na Bio, Reclamações Recentes.
        3. TOM: Profissional mas "Duro na Queda" (Tough Love). 
        4. IDIOMA: PORTUGUÊS DO BRASIL.
        
        FORMATO:
        1. ❌ [Problema 1]
        2. ❌ [Problema 2]
        3. ❌ [Problema 3]
        
        Seja conciso. Max 3 bullet points.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "1. ❌ Site não encontrado ou link quebrado.\n2. ❌ Presença digital fraca comparada aos concorrentes.\n3. ❌ Ausência de chamada para ação clara.";
    }
}

/**
 * Gera Insights Estratégicos (Consultoria)
 */
export const generateServiceInsights = async (serviceName: string, description: string): Promise<ServiceInsights> => {
  const prompt = `
    Atue como um Estrategista de Negócios e Consultor de Vendas de Classe Mundial.
    
    O Usuário vende o seguinte serviço:
    Nome: "${serviceName}"
    Descrição: "${description}"

    SUA TAREFA:
    Analise este serviço e determine a MELHOR estratégia de mercado para vendas High-Ticket no Brasil.
    
    1. Identifique o MELHOR NICHO para atacar (Ex: "Dentistas de Alto Padrão", "Corretores de Luxo").
    2. Estime um preço HIGH-TICKET recomendado em BRL (R$) que este nicho pode pagar.
    3. Explique POR QUE este nicho é perfeito (a dor urgente).
    4. Descreva o potencial financeiro.

    Formato de Saída: APENAS JSON.
    {
      "recommendedNiche": "Nome da Indústria",
      "suggestedTicket": 2500,
      "reasoning": "Explicação em PT-BR do porquê...",
      "potential": "Explicação em PT-BR do tamanho da oportunidade..."
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text || "";
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro Insights:", error);
    return {
      recommendedNiche: "Negócios Locais",
      suggestedTicket: 1500,
      reasoning: "Todos os negócios precisam de presença digital para sobreviver hoje.",
      potential: "Alta demanda em todas as cidades brasileiras."
    };
  }
};

/**
 * Gera Diferencial Matador / Oferta Grand Slam (VERSÃO EXCLUSIVA E ÚNICA)
 */
export const generateKillerDifferential = async (serviceName: string, currentDescription: string): Promise<string> => {
    const prompt = `
      ATUE COMO UM ENGENHEIRO DE OFERTAS DE ELITE (Nível Alex Hormozi/Russell Brunson).

      CONTEXTO:
      O usuário vende: "${serviceName}"
      Detalhes/Diferencial atual: "${currentDescription}"

      OBJETIVO:
      Transformar isso em uma "OFERTA ÚNICA E EXCLUSIVA". Não quero algo genérico como "Melhoro seus resultados".
      Quero uma promessa tangível, com um NOME DE MÉTODO PROPRIETÁRIO e uma GARANTIA INSANA.

      ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
      1. Headline (Gancho): "Eu ajudo [Nicho] a [Resultado Sonhado] em [Tempo] sem [Esforço/Dor] usando o [Nome do Método Criado]."
      2. O Mecanismo Único: Dê um nome sexy para o processo (ex: "Protocolo Escala 3X", "Sistema Site-Relâmpago", "Funil de Conversão Infinita").
      3. A Garantia (Risk Reversal): Algo doloroso para o vendedor se falhar (ex: "Se não dobrar leads, eu trabalho de graça até dobrar" ou "Devolvo o dinheiro + R$ 500").

      REGRAS DE OURO:
      - ANALISE O INPUT: Se ele diz "site rápido", crie "Carregamento Instantâneo". Se ele diz "design", crie "Design de Conversão".
      - EXCLUSIVIDADE: Use palavras que denotem propriedade (Meu sistema, Método exclusivo).
      - IDIOMA: Português do Brasil (Copywriting Persuasivo).

      SAÍDA: Combine tudo em um texto fluido e poderoso de 2 ou 3 frases.
    `;
    
    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "Eu implemento o 'Protocolo de Presença Digital 360'. Transformo visitantes em clientes pagantes em menos de 7 dias com minha estrutura proprietária. Se não gerar resultado no primeiro mês, devolvo 100% do seu investimento.";
    }
};

/**
 * QUEBRA DE OBJEÇÕES (AI Sales Coach)
 */
export const handleObjection = async (
    leadName: string, 
    objectionType: ObjectionType, 
    serviceContext: ServiceContext
): Promise<string> => {
    const objectionContext = {
        'expensive': "O cliente disse que 'está caro' ou 'não tem orçamento'.",
        'partner': "O cliente disse que 'precisa ver com o sócio/esposa'.",
        'send_info': "O cliente disse 'me manda um PDF/apresentação' (geralmente para dispensar).",
        'has_agency': "O cliente disse que 'já tem quem faça isso'.",
        'later': "O cliente disse 'agora não' ou 'vou pensar'."
    }[objectionType];

    const prompt = `
        ATUE COMO UM TREINADOR DE VENDAS DE ELITE (Sandler System / Jordan Belfort).
        
        SITUAÇÃO:
        Você está conversando no WhatsApp com ${leadName}.
        Você ofereceu: ${serviceContext.serviceName}.
        
        OBJEÇÃO DO CLIENTE: ${objectionContext}
        
        TAREFA: Gere uma resposta CURTA (1-2 frases) para contornar essa objeção e manter a conversa viva.
        NÃO seja defensivo. Use perguntas ou concorde para depois reverter.
        
        Exemplo para 'Caro': "Entendo perfeitamente, Carlos. Deixa eu te perguntar: comparado a quanto um cliente novo traz de lucro pra você, R$ 1.500 ainda parece caro se isso te trouxer 10 clientes?"
        
        IDIOMA: PORTUGUÊS DO BRASIL.
        SAÍDA: APENAS A RESPOSTA SUGERIDA.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "Entendo. Só pra eu entender melhor, o que exatamente te preocupa nesse momento?";
    } catch (e) {
        return "Entendo perfeitamente. O que te impede de dar esse passo agora?";
    }
};

/**
 * CALCULADORA DE CUSTO DA INAÇÃO (ROI/Medo)
 */
export const calculateInactionCost = async (
    lead: Lead,
    serviceContext: ServiceContext
): Promise<string> => {
    const prompt = `
        ATUE COMO UM ANALISTA FINANCEIRO AGRESSIVO.
        
        CLIENTE: ${lead.name} (${lead.description})
        PROBLEMA DETECTADO: ${lead.painPoints?.join(", ") || "Falta de presença digital eficiente"}
        SOLUÇÃO OFERECIDA: ${serviceContext.serviceName}
        
        TAREFA: Crie um "Cálculo de Prejuízo Estimado" para enviar ao cliente.
        Mostre, com números fictícios mas realistas para o nicho, quanto dinheiro ele está perdendo POR MÊS ao não resolver o problema.
        
        Exemplo: "Dr. João, sem um site captando pacientes no Google, o senhor perde em média 5 pacientes de R$ 300 por semana. Isso são R$ 6.000/mês jogados no lixo."
        
        REGRAS:
        1. Seja específico e use valores em R$.
        2. Curto e direto (formato de mensagem de WhatsApp).
        3. Gere medo da perda (Loss Aversion).
        4. IDIOMA: PORTUGUÊS DO BRASIL.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "Sem essa solução implementada, estima-se que você esteja perdendo cerca de 20% do faturamento potencial todos os meses para concorrentes mais digitalizados.";
    }
};

/**
 * SALES LAB: GERADOR DE CADÊNCIA NEURAL (5 dias)
 */
export const generateNeuroSequence = async (serviceContext: ServiceContext): Promise<SequenceDay[]> => {
    if (!serviceContext.serviceName) throw new Error("Configure seu serviço primeiro.");

    const prompt = `
      ATUE COMO UM ESPECIALISTA EM NEUROVENDAS.
      
      CONTEXTO:
      Eu vendo: "${serviceContext.serviceName}"
      Minha oferta: "${serviceContext.description}"
      
      TAREFA: Crie uma "SEQUÊNCIA DE RESGATE" de 5 mensagens para leads que pararam de responder (Ghosting).
      Use estes gatilhos obrigatórios:
      1. Dia 1: Reciprocidade/Valor (Entregar algo útil/dica rápida).
      2. Dia 3: Curiosidade (Uma pergunta estranha).
      3. Dia 7: Prova Social (Citar outros resultados sem se gabar).
      4. Dia 15: Medo da Perda/Escassez (Falar que a agenda vai fechar).
      5. Dia 30: "Break-up" (Despedida educada para gerar reação).
      
      FORMATO: JSON ARRAY.
      [
        { 
          "day": "Dia 1", 
          "trigger": "Reciprocidade",
          "subject": "Ideia rápida pra você",
          "message": "Texto da mensagem...",
          "explanation": "Por que funciona..."
        }
      ]
      
      IDIOMA: PORTUGUÊS DO BRASIL. Texto de WhatsApp (curto, informal).
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const text = response.text || "";
        return JSON.parse(text);
    } catch (e) {
        console.error("Erro Sequence:", e);
        return [];
    }
};

/**
 * SALES LAB: ROLEPLAY DOJO
 */
export const runRoleplayTurn = async (
    profile: RoleplayProfile, 
    chatHistory: RoleplayMessage[], 
    serviceContext: ServiceContext
): Promise<RoleplayMessage> => {
    
    const profileDesc = {
        'skeptic': "O Cético: Duvida de tudo, acha golpe, pede provas, é frio.",
        'cheap': "O Pão-Duro: Só liga pro preço, chora desconto, diz que o sobrinho faz de graça.",
        'hasty': "O Apressado: Não tem tempo, responde monossílabo, quer o preço direto, é grosso."
    }[profile];

    const historyText = chatHistory.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join("\n");

    const prompt = `
      ATUE COMO DOIS PERSONAGENS:
      1. O CLIENTE (${profileDesc}). Você está conversando com um vendedor que vende "${serviceContext.serviceName}".
      2. O TREINADOR DE VENDAS (COACH).
      
      HISTÓRICO DA CONVERSA:
      ${historyText}
      
      SUA MISSÃO AGORA:
      Analise a última mensagem do USUÁRIO (Vendedor).
      
      SAÍDA ESPERADA (JSON):
      {
        "text": "Sua resposta como CLIENTE. Mantenha a personalidade difícil. Seja curto, como no WhatsApp.",
        "feedback": "Seu feedback como COACH sobre a resposta do usuário. O que ele fez bem? O que errou?",
        "score": 0 a 10 (Nota para a resposta do usuário),
        "betterResponse": "Escreva aqui um EXEMPLO PRÁTICO de uma resposta PERFEITA que o usuário deveria ter enviado para lidar com esse tipo de cliente e avançar a venda."
      }
      
      IDIOMA: PORTUGUÊS DO BRASIL.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text || "{}");
        return {
            sender: 'ai',
            text: data.text || "...",
            feedback: data.feedback,
            score: data.score,
            betterResponse: data.betterResponse
        };
    } catch (e) {
        return { sender: 'ai', text: "Pode repetir? Não entendi.", feedback: "Erro na IA.", score: 0 };
    }
};

/**
 * AUTÓPSIA DE NEGOCIAÇÃO (Real-Time Chat Analysis)
 */
export const analyzeChatHistory = async (chatText: string, serviceContext: ServiceContext): Promise<ChatAnalysis> => {
    const prompt = `
        ATUE COMO UM ESTRATEGISTA DE VENDAS SÊNIOR (THE CLOSER).
        
        CONTEXTO:
        O usuário está vendendo: "${serviceContext.serviceName}"
        Abaixo está o histórico copiado e colado de uma conversa real de WhatsApp (pode estar bagunçado).
        
        CONVERSA REAL:
        """
        ${chatText.substring(0, 5000)}
        """
        
        SUA MISSÃO:
        Analise o que foi dito e o que NÃO foi dito.
        
        RETORNE UM JSON:
        {
          "score": 0 a 100, // Probabilidade real de fechar.
          "sentiment": "positive" | "neutral" | "negative",
          "hiddenIntent": "O que o cliente está realmente pensando? (ex: Ele diz que vai pensar, mas achou caro)",
          "nextMove": "A MENSAGEM PERFEITA para mandar AGORA e destravar a venda.",
          "tip": "Um conselho estratégico curto."
        }
        
        IDIOMA: PORTUGUÊS DO BRASIL.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error(e);
        return {
            score: 0,
            sentiment: 'neutral',
            hiddenIntent: "Não foi possível analisar o texto.",
            nextMove: "Tente retomar o contato perguntando se ficou alguma dúvida.",
            tip: "Tente colar a conversa novamente."
        };
    }
};