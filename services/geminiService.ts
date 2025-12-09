

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext, LeadScore, LeadStatus, ServiceInsights } from "../types";

// @ts-ignore: O Vite substitui process.env.API_KEY no build, mas o TSC reclama. Ignoramos o erro.
const apiKey = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

// Helper to clean JSON string from Markdown code blocks
const extractJson = (text: string): any => {
  try {
    // Remove markdown code block syntax if present
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/);
    const jsonString = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("Failed to parse JSON from model output:", text);
    return null;
  }
};

const cleanPhone = (phone: string): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 8) return null; // Too short to be valid
  return cleaned;
};

// Calculate 'Lead Temperature'
const calculateLeadScore = (lead: any): LeadScore => {
    // Logic: No website or Broken Website = HOT Opportunity for web services
    if (!lead.website || lead.website === "Not Found" || lead.website === "") {
        return 'hot';
    }
    // Has website but also has Instagram (Means they are trying but might need optimization)
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
  serviceContext?: ServiceContext
): Promise<{ leads: Lead[], sources: GroundingSource[] }> => {
  
  // Construct a Context-Aware Prompt for "Hunter Mode"
  let serviceStrategy = "";
  if (serviceContext && serviceContext.serviceName) {
    serviceStrategy = `
    >>> HUNTER MODE ACTIVATED: HIGH QUALITY FILTERING <<<
    THE USER SELLS: "${serviceContext.serviceName}"
    OFFER DESCRIPTION: "${serviceContext.description}"
    
    YOUR MISSION: Find businesses that have a SPECIFIC PAIN POINT that this service solves.
    Examples of what to look for based on user service:
    - If user sells SITES -> Find businesses with NO website, BROKEN websites, or UGLY/OLD websites.
    - If user sells ADS/TRAFFIC -> Find businesses with low social engagement or who are invisible on Google.
    - If user sells SOCIAL MEDIA -> Find businesses with inactive Instagrams or bad photos.
    
    Do NOT just list random businesses. List businesses that are "Easy Wins" for this service provider.
    `;
  } else {
    serviceStrategy = `
    >>> HUNTER MODE ACTIVATED <<<
    Find businesses that look like they need Digital Modernization (No website, old branding, low reviews).
    `;
  }

  // Request slightly more than needed to account for filtering
  const requestCount = Math.ceil(count * 1.5);

  const prompt = `
    ACT AS AN ELITE SALES INTELLIGENCE BOT.
    
    TARGET:
    - Niche: "${niche}"
    - Location: "${location}"
    - Size: ${size} (Small = Local/Freelancer, Medium = Established, Large = Market Leader)
    
    ${serviceStrategy}
    
    REQUIREMENTS:
    1. FIND ${requestCount} POTENTIAL LEADS.
    2. *** STRICT TELEPHONE RULE ***: You MUST find a valid phone number (Mobile/WhatsApp preferred). If no phone, DO NOT include.
    3. EXCLUDE these existing names: ${existingNames.join(", ")}.
    
    FOR EACH LEAD, YOU MUST IDENTIFY:
    - "painPoints": An array of specific problems you detected (e.g., ["No Website", "Bad Reviews", "Inactive Instagram"]).
    - "matchReason": A short persuasive sentence on why this lead is ALMOST IMPOSSIBLE NOT TO BUY. (e.g., "They have 5k followers but no link in bio - losing money daily.").

    Output Format: STRICT JSON Array inside a code block.
    [
      {
        "name": "Business Name",
        "phone": "(XX) 9XXXX-XXXX",
        "instagram": "https://instagram.com/...",
        "website": "URL or 'Not Found'",
        "description": "Short description of the business.",
        "painPoints": ["No Website", "Low Google Rating"],
        "matchReason": "Ideal target because they have high foot traffic but zero digital presence."
      }
    ]
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
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
      throw new Error("AI did not return a valid array of leads.");
    }

    // Map, Sanitize, and STRICT FILTER
    const leads: Lead[] = rawLeads
      .map((item: any, index: number) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || "Desconhecido",
        phone: item.phone || "Não encontrado",
        instagram: (item.instagram === "Not Found" || !item.instagram) ? null : item.instagram,
        description: item.description || "Sem descrição disponível.",
        website: (item.website === "Not Found" || !item.website) ? undefined : item.website,
        painPoints: Array.isArray(item.painPoints) ? item.painPoints : [],
        matchReason: item.matchReason || "Oportunidade de modernização digital.",
        confidenceScore: 1,
        status: 'new' as LeadStatus,
        score: calculateLeadScore(item) // Calculate Hot/Warm based on website status
      }))
      // THE FILTER: Remove anything that doesn't have a valid phone number
      .filter((lead) => {
        const isNotFound = lead.phone === "Não encontrado" || lead.phone === "Not Found";
        const clean = cleanPhone(lead.phone);
        // Must not be "Not Found" AND must have at least 8 digits
        return !isNotFound && clean !== null;
      });

    return { leads, sources };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
};

/**
 * Generates a hyper-personalized message for a specific lead.
 */
export const generateMarketingCopy = async (
  lead: Lead, 
  serviceContext: ServiceContext
): Promise<string> => {
  
  // Fallback if no context
  if (!serviceContext.serviceName) {
    return `Olá ${lead.name}, tudo bem? Vi seu perfil e achei interessante o trabalho de vocês. Gostaria de conversar sobre uma oportunidade de parceria.`;
  }

  // Choose a random strategy to ensure variations
  const strategies = [
    "THE 'MYSTERY SHOPPER' (Pretend you tried to use their service but hit a snag)",
    "THE 'LOST REVENUE' (Aggressively point out money they are losing)",
    "THE 'COMPETITOR ENVY' (Mention their competitor is doing something better)",
    "THE 'PATTERN INTERRUPT' (Start with a weird, hyper-specific question)",
    "THE 'EGO BAIT' (Compliment them heavily, then pivot to the one missing piece)"
  ];
  const selectedStrategy = strategies[Math.floor(Math.random() * strategies.length)];

  // Inject specific pain points into the copy prompt if available
  const painPointsInfo = lead.painPoints && lead.painPoints.length > 0 
    ? `Specific Problems Detected: ${lead.painPoints.join(", ")}`
    : "Problem: General lack of digital optimization.";

  const prompt = `
    You are a world-class Direct Response Copywriter known for "Cold DMs" that get 80% response rates.
    You are aggressive, persuasive, and use psychological triggers.
    
    YOUR STRATEGY FOR THIS MESSAGE: ${selectedStrategy}

    The Client (Receiver):
    - Name: ${lead.name}
    - Details: "${lead.description}"
    - ${painPointsInfo}
    - Match Reason: ${lead.matchReason || "N/A"}
    
    My Service (Sender):
    - Service: ${serviceContext.serviceName}
    - Offer: ${serviceContext.description}
    
    Rules for the message:
    1. Language: Portuguese (Brazil). Informal but sharp. Use slang like "Opa", "Fala [Nome]".
    2. NO "Assunto:". Just the body text.
    3. SHORT. Mobile optimized. Max 3-4 sentences broken up.
    4. EXTREMELY PERSUASIVE. Focus on the PAIN POINTS detected.
    5. If they have "No Website", use that as the main hook.
    
    Output ONLY the message text.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 1.5, // High temperature for maximum creativity/variation
      }
    });
    return response.text?.trim() || "";
  } catch (error) {
    console.error("Copy generation error", error);
    return `Fala ${lead.name}, vi aqui que vocês estão deixando dinheiro na mesa sem um site profissional. Bora resolver isso hoje?`;
  }
};

/**
 * Generates a Technical Audit (The Secret Weapon)
 */
export const generateLeadAudit = async (lead: Lead, serviceContext: ServiceContext): Promise<string> => {
    const painContext = lead.painPoints ? `Known Issues: ${lead.painPoints.join(", ")}` : "";
    
    const prompt = `
        ACT AS AN EXPERT AUDITOR FOR: ${serviceContext.serviceName || "Digital Marketing"}.
        TARGET: ${lead.name} (${lead.description}).
        ${painContext}
        
        TASK: Create a mini "Technical Audit" finding 3 SPECIFIC PROBLEMS with their digital presence that justify buying the user's service.
        
        FORMAT:
        1. ❌ [Problem 1]
        2. ❌ [Problem 2]
        3. ❌ [Problem 3]
        
        Language: Portuguese (Brazil). Professional, authoritative, but shocking.
        Keep it concise. Max 3 bullet points.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "1. ❌ Site não encontrado ou lento.\n2. ❌ Perfil do Google desatualizado.\n3. ❌ Ausência de funil de vendas.";
    }
}

/**
 * Generates Strategic Insights based on the user's service.
 */
export const generateServiceInsights = async (serviceName: string, description: string): Promise<ServiceInsights> => {
  const prompt = `
    Act as a World-Class Business Strategist & Sales Consultant.
    
    The User sells the following service:
    Name: "${serviceName}"
    Description: "${description}"

    YOUR TASK:
    Analyze this service and determine the absolute BEST market strategy for high-ticket sales.
    
    1. Identify the ONE best niche industry to target (e.g., "Dentistas de Alto Padrão", "Corretores de Imóveis de Luxo").
    2. Estimate a recommended HIGH-TICKET price in BRL (R$) that this specific niche can afford.
    3. Explain WHY this niche is the perfect fit (the pain point).
    4. Describe the financial potential (Why is it lucrative?).

    Output format: JSON ONLY.
    {
      "recommendedNiche": "Industry Name",
      "suggestedTicket": 2500,
      "reasoning": "Explanation of why this niche needs this service urgently...",
      "potential": "Explanation of the market size and opportunity..."
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
    console.error("Strategy Insight Error", error);
    // Fallback
    return {
      recommendedNiche: "Negócios Locais",
      suggestedTicket: 1500,
      reasoning: "Todos os negócios precisam de presença digital.",
      potential: "Alta demanda em todas as cidades."
    };
  }
};