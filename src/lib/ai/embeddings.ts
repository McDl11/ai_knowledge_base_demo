import { createOpenAIClient } from "@/lib/ai/openai-client";
import { getServerEnv } from "@/lib/env";

export const localEmbeddingModel = "local-hash-embedding-v1";

export async function createEmbedding(input: string): Promise<number[]> {
  const env = getServerEnv();
  if (env.OPENAI_EMBEDDING_MODEL === localEmbeddingModel) {
    return createLocalHashEmbedding(input);
  }

  const client = createOpenAIClient();
  const response = await client.embeddings.create({
    model: env.OPENAI_EMBEDDING_MODEL,
    input,
  });

  return response.data[0]?.embedding ?? [];
}

export function createLocalHashEmbedding(
  input: string,
  dimensions = 1536,
): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const normalized = input.normalize("NFKC").toLowerCase().trim();
  const terms = collectTerms(normalized.length > 0 ? normalized : "empty");

  for (const term of terms) {
    for (const feature of collectFeatures(term)) {
      const hash = hashString(feature);
      const index = positiveModulo(hash, dimensions);
      vector[index] += hash % 2 === 0 ? 1 : -1;
    }
  }

  let magnitude = 0;
  for (const value of vector) {
    magnitude += value * value;
  }

  const scale = Math.sqrt(magnitude) || 1;
  return vector.map((value) => value / scale);
}

function collectTerms(input: string): string[] {
  const terms = input.match(/[\p{L}\p{N}]+/gu);
  if (terms && terms.length > 0) {
    return terms;
  }

  return Array.from(input);
}

function collectFeatures(term: string): string[] {
  if (term.length <= 2) {
    return [term];
  }

  const features = [term];
  for (let index = 0; index <= term.length - 2; index += 1) {
    features.push(term.slice(index, index + 2));
  }
  for (let index = 0; index <= term.length - 3; index += 1) {
    features.push(term.slice(index, index + 3));
  }

  return features;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
