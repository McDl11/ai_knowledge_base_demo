import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

export function createOpenAIClient(): OpenAI {
  const env = getServerEnv();

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });
}
