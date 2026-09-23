import { GoogleGenAI } from "@google/genai";
import { config } from "../config";

export class LLMUnavailableError extends Error {}

const ai = config.geminiKey
  ? new GoogleGenAI({ apiKey: config.geminiKey })
  : null;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getErrorMessage(error: any): string {
  return String(error?.message || error || "Unknown Gemini error");
}

function isRetryableError(error: any): boolean {
  const message = getErrorMessage(error);

  return (
    /429/.test(message) ||
    /RESOURCE_EXHAUSTED/i.test(message) ||
    /rate.?limit/i.test(message) ||
    /quota/i.test(message) ||
    /503/.test(message) ||
    /UNAVAILABLE/i.test(message) ||
    /temporar/i.test(message) ||
    /timeout/i.test(message)
  );
}

export async function generateJson<T>(
  prompt: string,
  schema: any,
  attempts = 3
): Promise<T> {
  if (!ai) {
    throw new LLMUnavailableError(
      "GEMINI_API_KEY is not configured"
    );
  }

  let lastError: any = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.2
        }
      });

      const raw = response.text?.trim();

      if (!raw) {
        throw new Error("Gemini returned an empty response");
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error(
          `Gemini returned invalid JSON: ${raw.slice(0, 500)}`
        );
      }

    } catch (error: any) {
      lastError = error;

      const message = getErrorMessage(error);

      console.error(
        `Gemini request failed (attempt ${attempt + 1}/${attempts}):`,
        message
      );

      // Do NOT retry invalid schemas or other permanent 400 errors.
      if (!isRetryableError(error)) {
        break;
      }

      // Don't immediately hammer Gemini again.
      if (attempt < attempts - 1) {
        const delay =
          3000 * Math.pow(2, attempt) +
          Math.floor(Math.random() * 1000);

        console.log(
          `Retrying Gemini request in ${Math.round(delay / 1000)} seconds...`
        );

        await sleep(delay);
      }
    }
  }

  throw new Error(
    `LLM generation failed: ${getErrorMessage(lastError)}`
  );
}