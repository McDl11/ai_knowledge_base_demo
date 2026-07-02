import type { Citation } from "@/lib/domain";
import { getServerEnv } from "@/lib/env";
import { matchKnowledgeChunks } from "@/lib/db/knowledge-repository";

export async function searchRelevantChunks(
  questionEmbedding: number[],
  question: string,
): Promise<Citation[]> {
  const env = getServerEnv();

  return matchKnowledgeChunks({
    embedding: questionEmbedding,
    query: question,
    threshold: Math.min(env.RAG_MATCH_THRESHOLD, 0.25),
    count: env.RAG_MATCH_COUNT,
  });
}
