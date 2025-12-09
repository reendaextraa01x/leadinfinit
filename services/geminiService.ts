
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Lead, GroundingSource, BusinessSize, ServiceContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const generateLeads = async (
  niche: string, 
  location: string, 
  size: BusinessSize,
  count: number,
  existingNames: string[],
  serviceContext?: ServiceContext
): Promise<{ leads: Lead[], sources: GroundingSource[] }> => {
  
  let sizeInstruction = "";
  if (size === 'small') {
    sizeInstruction = "IMPORTANT: Focus strictly on SMALL, LOCAL businesses, freelancers, or service providers. Look for entities that might have poor websites, no websites, or just a social media page. These are potential clients for website creation services.";
  } else if (size === 'medium') {
    sizeInstruction = "Focus on MEDIUM-sized established businesses. They likely have a website but it might be outdated, or they are well-known locally but not nationally.";
  } else {
    sizeInstruction = "Focus on LARGE, FAMOUS market leaders and established brands in this region.";
  }

  let contextInstruction = "";
  if (serviceContext && serviceContext.serviceName) {
    contextInstruction = `
    CONTEXT & FILTERING STRATEGY:
    The user is a service provider offering: "${serviceContext.serviceName}".
    Their Offer/Description: "${serviceContext.description}".
    ${serviceContext.targetAudience ? `Target Audience specifics: ${serviceContext.targetAudience}` : ""}
    
    CRITICAL: Filter the results to find businesses that SPECIFICALLY need this service.
    Example: If the service is "Website Creation", prioritize finding businesses that DO NOT have a website listed, or have a very basic/broken online presence.
    
    In the "description" field of the JSON result, explain specifically WHY this lead is a good fit for the user's service "${serviceContext.serviceName}". (e.g., "Doesn't have a website", "Low social engagement").
    `;
  }

  // Request slightly more than needed to account for filtering
  const requestCount = Math.ceil(count * 1.5);

  const prompt = `
    I need you to act as an advanced lead generation bot. 
    Task: Search the internet for businesses or professionals in the niche: "${niche}" located in "${location}".
    
    ${sizeInstruction}

    ${contextInstruction}
    
    Goal: Find AT LEAST ${count} valid results. To be safe, try to find ${requestCount}.
    Constraint: Do not include these names: ${existingNames.join(", ")}.

    *** STRICT RULE - PHONE NUMBERS ARE MANDATORY ***
    1. You MUST find a valid phone number for every single entry.
    2. EXCLUDE any business where you cannot find a working phone number.
    3. Dig deep into Google Maps, Facebook "About", Instagram Bios (look for "WhatsApp", "Contato", "Tel").
    4. PREFER mobile numbers (WhatsApp capable, starting with 9 in Brazil).
    
    Information required for each lead:
    1. Business/Person Name
    2. Phone Number (MANDATORY. If not found, skip this business entirely.)
    3. Instagram Handle/URL (PRIORITY: Search specifically for their Instagram. If found, provide full URL. If not, "Not Found")
    4. Short Description (1 sentence, WRITTEN IN PORTUGUESE. If context is provided, explain why they need the service.)
    5. Website URL (if available)

    Output Format:
    You MUST return the data as a STRICT JSON Array wrapped in a code block. 
    Structure:
    [
      {
        "name": "Business Name",
        "phone": "(11) 99999-9999",
        "instagram": "https://instagram.com/...",
        "description": "Descrição em Português...",
        "website": "..."
      }
    ]

    Ensure the data is accurate based on the search results.
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
        confidenceScore: 1
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

  const prompt = `
    You are a world-class Direct Response Copywriter known for "Cold DMs" that get 80% response rates.
    You are aggressive, persuasive, and use psychological triggers.
    
    YOUR STRATEGY FOR THIS MESSAGE: ${selectedStrategy}

    The Client (Receiver):
    - Name: ${lead.name}
    - Details: "${lead.description}"
    - Website Status: ${lead.website ? "Has website: " + lead.website : "NO WEBSITE (Critical Pain Point!)"}
    
    My Service (Sender):
    - Service: ${serviceContext.serviceName}
    - Offer: ${serviceContext.description}
    
    Rules for the message:
    1. Language: Portuguese (Brazil). Informal but sharp. Use slang like "Opa", "Fala [Nome]".
    2. NO "Assunto:". Just the body text.
    3. SHORT. Mobile optimized. Max 3-4 sentences broken up.
    4. EXTREMELY PERSUASIVE. Create FOMO (Fear of missing out) or Urgent Pain.
    5. Do NOT sound like a robot. Sound like a busy expert giving them a heads up.
    6. If they have no website, act shocked. "Como vocês vendem sem site hoje em dia?"
    
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
