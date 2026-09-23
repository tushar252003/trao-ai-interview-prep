import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

export class LLMUnavailableError extends Error {}

const ai = config.geminiKey ? new GoogleGenAI({ apiKey: config.geminiKey }) : null;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateJson<T>(prompt: string, schema: any, attempts = 3): Promise<T> {
  if (!ai) throw new LLMUnavailableError("GEMINI_API_KEY is not configured");

  let last: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await ai.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const raw = response.text?.trim();
      if (!raw) throw new Error("Empty model response");
      return JSON.parse(raw) as T;
    } catch (e: any) {
      last = e;
      const message = String(e?.message || e);
      const retryable = /429|rate|quota|503|timeout|temporar/i.test(message);
      if (!retryable || i === attempts - 1) break;
      await sleep(700 * 2 ** i + Math.floor(Math.random() * 250));
    }
  }
  throw new Error(`LLM generation failed: ${String(last?.message || last)}`);
}
