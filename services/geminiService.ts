
import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";

// Chat Service
// Fix: Removed global chatSession and ai instance to ensure compliance with the requirement of creating a fresh GoogleGenAI instance per call
export const sendMessageToGemini = async (
  message: string,
  history: ChatMessage[]
): Promise<string> => {
  try {
    // Fix: Creating a new GoogleGenAI instance right before making the API call to ensure the most up-to-date API key is used
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

    // Fix: Using ai.models.generateContent with complete history to provide multi-turn conversation support statelessly as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...history.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: "You are a helpful, friendly financial assistant for a family. You help them track expenses, understand savings, and provide general financial advice. Keep answers concise and practical.",
      },
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat Error:", error);
    // Rethrow error so the UI can detect specific codes like "Requested entity was not found"
    throw error;
  }
};
