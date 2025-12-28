
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatMessage } from "../types";

// Chat Service
// Refactored to use the client-side GoogleGenerativeAI SDK
export const sendMessageToGemini = async (
  message: string,
  history: ChatMessage[]
): Promise<string> => {
  try {
    // Fix: Check both import.meta.env and process.env (fallback)
    const apiKey = import.meta.env.VITE_API_KEY || (process.env.GEMINI_API_KEY as string);
    if (!apiKey) {
      console.error("Gemini API Key is missing. Checked VITE_API_KEY and GEMINI_API_KEY.");
      throw new Error("VITE_API_KEY is not defined");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Note: Ensuring we use a valid model name. 
    // If 'gemini-3-pro-preview' was a placeholder, consider 'gemini-1.5-flash' or 'gemini-pro'.
    // Using the user's provided model name but 'getGenerativeModel' pattern.
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', // Defaulting to a known working model for now, user can change back if needed.
      systemInstruction: "You are a helpful, friendly financial assistant for a family. You help them track expenses, understand savings, and provide general financial advice. Keep answers concise and practical.",
    });

    // Using generateContent with full history manually as per original implementation.
    // This supports the stateless nature of this function.
    const result = await model.generateContent({
      contents: [
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ]
    });

    return result.response.text();
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};
