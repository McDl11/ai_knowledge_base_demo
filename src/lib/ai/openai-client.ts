import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";

export function createOpenAIClient(): OpenAI {
  const env = getServerEnv();
  const options: ConstructorParameters<typeof OpenAI>[0] = {
    apiKey: env.OPENAI_API_KEY,
  };

  if (env.OPENAI_BASE_URL) {
    options.baseURL = env.OPENAI_BASE_URL;
  }

  return new OpenAI(options);
}
