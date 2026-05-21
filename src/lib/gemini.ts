import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

// Check if Gemini API is configured
export function isGeminiConfigured(): boolean {
  return !!apiKey;
}

// Initialize the Google Gen AI client
export const ai = new GoogleGenAI({
  apiKey: apiKey || "placeholder_for_build",
});

const DEFAULT_MODEL = "gemini-3-flash-preview";

const SYSTEM_INSTRUCTION = `
You are the whichlist Watchlist Assistant.
whichlist is a premium, minimalist, and highly structured Swiss-design system for movie and TV logging.
Your personality is:
1. Analytical, objective, and precise.
2. Slightly dry, sharp, or sardonic (especially when roasting user taste). No fake cheerfulness or bubbly emojis.
3. Minimalist, using clean typographic hierarchies, technical terminology, and uppercase tags where relevant (e.g. [LOG], [DIAGNOSTIC], [ALERT]).
Keep responses direct and focused on cinematic analysis, ratings, and television/film cataloging.
`;

/**
 * Generates plain text from Gemini
 */
export async function generateText(
  prompt: string,
  customSystemInstruction?: string
): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: customSystemInstruction ?? SYSTEM_INSTRUCTION,
      },
    });

    return response.text ?? "";
  } catch (error) {
    console.error("Gemini text generation failed:", error);
    throw error;
  }
}

/**
 * Generates JSON content from Gemini
 */
export async function generateJSON<T>(
  prompt: string,
  responseSchema?: any,
  customSystemInstruction?: string
): Promise<T> {
  if (!isGeminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not configured in .env.local");
  }

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: customSystemInstruction ?? SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Received empty response from Gemini");
    }

    return JSON.parse(text) as T;
  } catch (error) {
    console.error("Gemini JSON generation failed:", error);
    throw error;
  }
}
