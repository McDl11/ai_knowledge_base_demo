import type { JsonRecord, KnowledgeItem } from "@/lib/domain";
import { createEmbedding } from "@/lib/ai/embeddings";
import {
  createProcessingKnowledgeItem,
  markKnowledgeItemFailed,
  markKnowledgeItemReady,
  replaceKnowledgeChunks,
} from "@/lib/db/knowledge-repository";
import type { ChunkTextOptions, TextChunk } from "@/lib/knowledge/chunk-text";
import { chunkText } from "@/lib/knowledge/chunk-text";
import type { ParseKnowledgeSourceInput } from "@/lib/knowledge/source-parser";
import { parseKnowledgeSource } from "@/lib/knowledge/source-parser";

interface IngestKnowledgeFileInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

interface FinalizeKnowledgeItemFromTextInput {
  itemId: string;
  text: string;
  metadata?: JsonRecord;
}

export function prepareKnowledgeChunks(
  text: string,
  options?: ChunkTextOptions,
): TextChunk[] {
  return chunkText(text, options);
}

export async function ingestKnowledgeFile(
  input: IngestKnowledgeFileInput,
): Promise<KnowledgeItem> {
  return ingestKnowledgeSource({
    kind: "file",
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
  });
}

export async function ingestKnowledgeSource(
  input: ParseKnowledgeSourceInput,
): Promise<KnowledgeItem> {
  const parsed = await parseKnowledgeSource(input);
  if (!parsed.text) {
    throw new Error("资料内容为空，无法入库。");
  }

  const item = await createProcessingKnowledgeItem({
    title: parsed.title,
    type: parsed.knowledgeType,
    fileName: parsed.source,
    fileType: parsed.fileType,
    metadata: parsed.metadata,
  });

  try {
    return finalizeKnowledgeItemFromText({
      itemId: item.id,
      text: parsed.text,
      metadata: parsed.metadata,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "资料入库失败。";
    await markKnowledgeItemFailed(item.id, reason);
    throw error;
  }
}

export async function finalizeKnowledgeItemFromText(
  input: FinalizeKnowledgeItemFromTextInput,
): Promise<KnowledgeItem> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Knowledge content is empty.");
  }

  const chunks = prepareKnowledgeChunks(text);
  const chunksWithEmbeddings = await Promise.all(
    chunks.map(async (chunk) => ({
      ...chunk,
      embedding: await createEmbedding(chunk.content),
    })),
  );

  await replaceKnowledgeChunks({
    itemId: input.itemId,
    chunks: chunksWithEmbeddings.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
      metadata: input.metadata,
    })),
  });

  return markKnowledgeItemReady(input.itemId, chunks.length, input.metadata);
}
