import { ingestKnowledgeSource } from "@/lib/knowledge/ingestion";

export function ingestIdea(input: { title?: string; content: string }) {
  return ingestKnowledgeSource({
    kind: "idea",
    title: input.title,
    content: input.content,
  });
}
