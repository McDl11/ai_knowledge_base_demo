import type {
  Citation,
  JsonRecord,
  KnowledgeChunkText,
  KnowledgeItem,
  KnowledgeItemType,
} from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  createLocalProcessingKnowledgeItem,
  deleteLocalKnowledgeItem,
  getLocalKnowledgeItem,
  listLocalKnowledgeChunksByItem,
  listLocalKnowledgeItems,
  markLocalKnowledgeItemFailed,
  markLocalKnowledgeItemReady,
  matchLocalKnowledgeChunks,
  replaceLocalKnowledgeChunks,
  updateLocalKnowledgeItemStatus,
  updateLocalKnowledgeItemMetadata,
} from "@/lib/db/local-store";
import { getServerEnv } from "@/lib/env";
import { formatCitationSummary } from "@/lib/rag/citations";

interface KnowledgeItemRow {
  id: string;
  title: string;
  type: KnowledgeItemType;
  file_name: string;
  file_type: string;
  status: KnowledgeItem["status"];
  chunk_count: number;
  metadata_json: JsonRecord;
  created_at: string;
  updated_at: string;
}

interface MatchedKnowledgeChunkRow {
  chunk_id: string;
  item_id: string;
  item_title: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

interface CreateProcessingKnowledgeItemInput {
  title: string;
  type: KnowledgeItemType;
  fileName: string;
  fileType: string;
  metadata?: JsonRecord;
}

interface KnowledgeChunkRow {
  chunk_index: number;
  content: string;
}

interface ReplaceKnowledgeChunksInput {
  itemId: string;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    embedding: number[];
    tokenCount: number;
    metadata?: JsonRecord;
  }>;
}

interface MatchKnowledgeChunksInput {
  embedding: number[];
  query?: string;
  threshold: number;
  count: number;
}

export async function listKnowledgeItems(): Promise<KnowledgeItem[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return listLocalKnowledgeItems(env.LOCAL_DB_PATH);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as KnowledgeItemRow[]).map(mapKnowledgeItemRow);
}

export async function getKnowledgeItem(
  itemId: string,
): Promise<KnowledgeItem | null> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return getLocalKnowledgeItem(env.LOCAL_DB_PATH, itemId);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapKnowledgeItemRow(data as KnowledgeItemRow) : null;
}

export async function createProcessingKnowledgeItem(
  input: CreateProcessingKnowledgeItemInput,
): Promise<KnowledgeItem> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return createLocalProcessingKnowledgeItem(env.LOCAL_DB_PATH, input);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      title: input.title,
      type: input.type,
      file_name: input.fileName,
      file_type: input.fileType,
      status: "processing",
      metadata_json: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapKnowledgeItemRow(data as KnowledgeItemRow);
}

export async function replaceKnowledgeChunks(
  input: ReplaceKnowledgeChunksInput,
): Promise<void> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return replaceLocalKnowledgeChunks(env.LOCAL_DB_PATH, input);
  }

  const supabase = createSupabaseAdminClient();
  const deleteResult = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("item_id", input.itemId);

  if (deleteResult.error) {
    throw deleteResult.error;
  }

  if (input.chunks.length === 0) {
    return;
  }

  const { error } = await supabase.from("knowledge_chunks").insert(
    input.chunks.map((chunk) => ({
      item_id: input.itemId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      embedding: chunk.embedding,
      token_count: chunk.tokenCount,
      metadata_json: chunk.metadata ?? {},
    })),
  );

  if (error) {
    throw error;
  }
}

export async function markKnowledgeItemReady(
  itemId: string,
  chunkCount: number,
  metadata?: JsonRecord,
): Promise<KnowledgeItem> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return markLocalKnowledgeItemReady(
      env.LOCAL_DB_PATH,
      itemId,
      chunkCount,
      metadata,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .update({
      status: "ready",
      chunk_count: chunkCount,
      metadata_json: metadata ?? {},
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapKnowledgeItemRow(data as KnowledgeItemRow);
}

export async function markKnowledgeItemFailed(
  itemId: string,
  reason: string,
  metadata?: JsonRecord,
): Promise<KnowledgeItem> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return markLocalKnowledgeItemFailed(
      env.LOCAL_DB_PATH,
      itemId,
      reason,
      metadata,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .update({
      status: "failed",
      metadata_json: metadata ?? { failureReason: reason.slice(0, 500) },
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapKnowledgeItemRow(data as KnowledgeItemRow);
}

export async function updateKnowledgeItemStatus(input: {
  itemId: string;
  status: KnowledgeItem["status"];
  chunkCount?: number;
  metadata?: JsonRecord;
}): Promise<KnowledgeItem> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return updateLocalKnowledgeItemStatus(env.LOCAL_DB_PATH, input);
  }

  const patch: Record<string, unknown> = {
    status: input.status,
  };
  if (input.chunkCount !== undefined) {
    patch.chunk_count = input.chunkCount;
  }
  if (input.metadata !== undefined) {
    patch.metadata_json = input.metadata;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .update(patch)
    .eq("id", input.itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapKnowledgeItemRow(data as KnowledgeItemRow);
}

export async function deleteKnowledgeItem(itemId: string): Promise<void> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return deleteLocalKnowledgeItem(env.LOCAL_DB_PATH, itemId);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("knowledge_items").delete().eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function updateKnowledgeItemMetadata(
  itemId: string,
  metadata: JsonRecord,
): Promise<KnowledgeItem> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return updateLocalKnowledgeItemMetadata(
      env.LOCAL_DB_PATH,
      itemId,
      metadata,
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_items")
    .update({ metadata_json: metadata })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapKnowledgeItemRow(data as KnowledgeItemRow);
}

export async function listKnowledgeChunksByItem(
  itemId: string,
): Promise<KnowledgeChunkText[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return listLocalKnowledgeChunksByItem(env.LOCAL_DB_PATH, itemId);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("chunk_index, content")
    .eq("item_id", itemId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as KnowledgeChunkRow[]).map((row) => ({
    chunkIndex: row.chunk_index,
    content: row.content,
  }));
}

export async function matchKnowledgeChunks(
  input: MatchKnowledgeChunksInput,
): Promise<Citation[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return matchLocalKnowledgeChunks(env.LOCAL_DB_PATH, input);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: input.embedding,
    match_threshold: input.threshold,
    match_count: input.count,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as MatchedKnowledgeChunkRow[]).map((row) => ({
    chunkId: row.chunk_id,
    itemId: row.item_id,
    itemTitle: row.item_title,
    chunkIndex: row.chunk_index,
    content: row.content,
    summary: formatCitationSummary(row.content),
    similarity: row.similarity,
  }));
}

function mapKnowledgeItemRow(row: KnowledgeItemRow): KnowledgeItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    fileName: row.file_name,
    fileType: row.file_type,
    status: row.status,
    chunkCount: row.chunk_count,
    metadata: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
