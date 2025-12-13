
// @ts-nocheck
/* eslint-disable */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights, ObjectionType, SequenceDay, RoleplayProfile, RoleplayMessage, ChatAnalysis, SearchFilters } from "../types";

// --- CONFIGURAÇÃO DE SEGURANÇA DA API ---
// Evita crash se 'process' não estiver definido no navegador
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {}
  return "AIzaSyBYm1j6yzneb_kkl0RZJfwpfG2CRz8qUew"; // Fallback de emergência
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey: apiKey });

// Helper para limpeza de JSON (Versão Blindada)
const extractJson = (text: string): any => {
  if (!text) return [];
  try {
    // Remove blocos de código markdown
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Tenta encontrar o início e fim do JSON
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      // É um array
      const lastBracket = cleaned.lastIndexOf(']');
      if (lastBracket !== -1) cleaned = cleaned.substring(firstBracket, lastBracket + 1);
    } else if (firstBrace !== -1) {
      // É um objeto
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace !== -1) cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Falha no parse JSON:", e);
    return [];
  }
};

const cleanPhone = (phone: string): string | null => {
  if (!phone) return null;
  const lower = phone.toLowerCase();
  if (lower.includes("não") || lower.includes("sem") || lower.includes("null")) return null;
  
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');
  
  // Filtros básicos de validade
  if (cleaned.length < 8) return null;
  if (/^(\d)\1+$/.test(cleaned)) return null; // Números repetidos ex: 99999999

  return cleaned;
};

const calculateLeadScore = (lead: any): LeadScore => {
    if (!lead.website || lead.website.length < 5) return 'hot';
    if (lead.instagram && lead.instagram.length > 5) return 'warm';
    return 'cold';
};

/**
 * MOTOR DE BUSCA V2 (Resiliente)
 */
export const generateLeads = async (
  niche: string, 
  location: string, 
  size: BusinessSize,
  targetCount: number,
  existingNames: string[],
  serviceContext?: ServiceContext,
  filters?: SearchFilters,
  customInstruction?: string
): Promise<{ leads: Lead[], sources: GroundingSource[] }> => {
  
  let allLeads: Lead[] = [];
  let allSources: GroundingSource[] = [];
  const processedNames = new Set(existingNames.map(n => n.toLowerCase())); 
  
  const isInstagramHunter = filters?.searchSource === 'instagram_hunter';
  let attempts = 0;
  const MAX_ATTEMPTS = 6; 

  const variants = isInstagramHunter ? [
      "whatsapp", "link na bio", "contato", "agendamento", "pedidos"
  ] : [
      "whatsapp", "telefone", "contato", "lista", "melhores"
  ];

  while (allLeads.length < targetCount && attempts < MAX_ATTEMPTS) {
      const variant1 = variants[(attempts * 2) % variants.length];
      const variant2 = variants[(attempts * 2 + 1) % variants.length];
      const variant3 = variants[(attempts * 2 + 2) % variants.length];
      
      const strategies = isInstagramHunter ? [
          `site:instagram.com "${niche}" "${location}" "${variant1}"`, 
          `site:instagram.com "${niche}" "${location}" "${variant2}"`, 
          `site:facebook.com "${niche}" "${location}" "${variant3}"` 
      ] : [
          `${niche} em ${location} ${variant1}`,
          `lista ${niche} ${location} ${variant2}`,
          `empresas ${niche} ${location} ${variant3}`
      ];

      const fetchBatch = async (query: string) => {
          const needed = targetCount - allLeads.length;
          const requestCount = Math.max(10, needed + 5);

          const basePrompt = `
            ACT AS DATA EXTRACTOR. LANGUAGE: PT-BR.
            QUERY: "${query}"
            CONTEXT: ${serviceContext?.serviceName ? `FIND CLIENTS FOR: ${serviceContext.serviceName}` : ""}
            ${filters?.websiteRule === 'must_not_have' ? "FILTER: PREFER NO WEBSITE." : ""}
            ${customInstruction ? `RULE: ${customInstruction}` : ""}
            
            EXTRACT JSON LIST of businesses found in search snippets.
            FIELDS: name, phone, instagram, website, description.
            REQUIRED: PHONE.
            
            JSON FORMAT: [{"name":"...","phone":"...","instagram":"...","website":"...","description":"..."}]
          `;

          try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: basePrompt,
                config: {
                  tools: [{ googleSearch: {} }],
                  temperature: 0.7, 
                },
            });

            if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                response.candidates[0].groundingMetadata.groundingChunks.forEach((c: any) => {
                    if (c.web?.uri && c.web?.title) allSources.push({ title: c.web.title, uri: c.web.uri });
                });
            }

            return extractJson(response.text || "[]");
          } catch (e) {
              return [];
          }
      };

      try {
          const results = await Promise.all([
              fetchBatch(strategies[0]),
              fetchBatch(strategies[1]),
              fetchBatch(strategies[2])
          ]);

          const rawLeads = results.flat();

          for (const item of rawLeads) {
              if (!item || !item.name || allLeads.length >= targetCount) continue;

              const normName = item.name.toLowerCase();
              if (processedNames.has(normName)) continue;
              
              const cleanP = cleanPhone(item.phone);
              if (!cleanP) continue;

              if (filters?.mobileOnly) {
                 if (cleanP.length !== 11 && cleanP.length !== 13) continue; 
              }

              processedNames.add(normName);
              
              allLeads.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: item.name,
                phone: item.phone, // Mantém original para display
                instagram: item.instagram || null,
                description: item.description || "Lead detectado.",
                website: item.website,
                painPoints: ["Oportunidade de Venda"],
                matchReason: "Perfil compatível com busca.",
                confidenceScore: 1,
                status: 'new',
                score: calculateLeadScore(item),
                qualityTier: 'opportunity'
              });
          }
      } catch (err) {
          console.error("Erro no ciclo de busca:", err);
      }

      attempts++;
      if (allLeads.length < targetCount) await new Promise(r => setTimeout(r, 1000));
  }

  return { leads: allLeads, sources: allSources };
};

// --- OUTRAS FUNÇÕES DO SERVIÇO (MANTIDAS SIMPLIFICADAS) ---

export const generateTacticalPrompts = async (serviceContext: ServiceContext) => {
    try {
        const prompt = `Gere 3 termos de busca google (dorks) para achar clientes para: ${serviceContext.serviceName}. JSON Array string.`;
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return extractJson(res.text || "[]");
    } catch { return ["Empresas sem site", "Baixa avaliação google"]; }
};

export const generateMarketingCopyBatch = async (leads: Lead[], ctx: ServiceContext) => {
    if (!leads.length) return {};
    try {
        const prompt = `Escreva uma mensagem curta de venda WhatsApp para cada lead: ${JSON.stringify(leads.map(l=>({id:l.id, name:l.name, desc:l.description})))}. Oferta: ${ctx.serviceName}. JSON {id: "msg"}`;
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return extractJson(res.text || "{}");
    } catch { return {}; }
};

export const generateLeadAudit = async (lead: Lead, ctx: ServiceContext) => {
    try {
        const prompt = `Auditoria curta e brutal de 3 erros de marketing para: ${lead.name} (${lead.website || "sem site"}). Vendedor: ${ctx.serviceName}.`;
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return res.text?.trim() || "Erro ao gerar auditoria.";
    } catch { return "Erro na análise."; }
};

export const generateServiceInsights = async (name: string, desc: string, target: string) => {
    try {
        const prompt = `Analise nicho e ticket para: ${name}. JSON: {recommendedNiche, suggestedTicket, reasoning, potential}`;
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
        return extractJson(res.text || "{}");
    } catch { return { recommendedNiche: target, suggestedTicket: 1000, reasoning: "Padrão", potential: "Médio" }; }
};

export const generateKillerDifferential = async (name: string, desc: string, target: string) => {
    try {
        const prompt = `Crie uma promessa única de venda (USP) para ${name} focado em ${target}. Curto.`;
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return res.text?.trim() || "";
    } catch { return desc; }
};

export const handleObjection = async (name: string, type: string, ctx: ServiceContext) => {
    try {
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Resposta curta para objeção '${type}' de ${name}. Serviço: ${ctx.serviceName}` });
        return res.text?.trim() || "";
    } catch { return "Entendo seu ponto."; }
};

export const calculateInactionCost = async (lead: Lead, ctx: ServiceContext) => {
    try {
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Calcule prejuízo de não contratar ${ctx.serviceName} para ${lead.name}. Curto.` });
        return res.text?.trim() || "";
    } catch { return "Você está perdendo oportunidades."; }
};

export const generateNeuroSequence = async (ctx: ServiceContext) => {
    try {
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Sequencia follow-up 5 dias para ${ctx.serviceName}. JSON Array.`, config: { responseMimeType: "application/json" } });
        return extractJson(res.text || "[]");
    } catch { return []; }
};

export const runRoleplayTurn = async (profile: string, history: any[], ctx: ServiceContext) => {
    try {
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Roleplay cliente ${profile}. Histórico: ${JSON.stringify(history)}. JSON {text, feedback, score, betterResponse}`, config: { responseMimeType: "application/json" } });
        return { sender: 'ai', ...extractJson(res.text || "{}") };
    } catch { return { sender: 'ai', text: "Erro.", score: 0 }; }
};

export const analyzeChatHistory = async (chat: string, ctx: ServiceContext) => {
    try {
        const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Analise chat venda ${ctx.serviceName}: ${chat}. JSON {score, sentiment, hiddenIntent, nextMove, tip}`, config: { responseMimeType: "application/json" } });
        return extractJson(res.text || "{}");
    } catch { return { score: 0, sentiment: 'neutral', hiddenIntent: '', nextMove: '', tip: '' }; }
};
