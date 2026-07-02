import type { KnowledgeItem } from "@/lib/domain";
import {
  listKnowledgeItems,
  updateKnowledgeItemMetadata,
} from "@/lib/db/knowledge-repository";
import {
  getMaterialAnnotations,
  type MaterialAnnotation,
} from "@/lib/knowledge/material-annotations";

export async function updateMaterialUserNote(
  itemId: string,
  userNote: string,
): Promise<KnowledgeItem> {
  const item = await findKnowledgeItem(itemId);

  return updateKnowledgeItemMetadata(itemId, {
    ...item.metadata,
    userNote: userNote.trim(),
    userNoteUpdatedAt: new Date().toISOString(),
  });
}

export async function addMaterialAnnotation(input: {
  itemId: string;
  quote: string;
  note: string;
}): Promise<KnowledgeItem> {
  const quote = input.quote.trim();
  const note = input.note.trim();
  if (!quote || !note) {
    throw new Error("请选择内容并填写注释。");
  }

  const item = await findKnowledgeItem(input.itemId);
  const annotations = getMaterialAnnotations(item.metadata);
  const annotation: MaterialAnnotation = {
    id: crypto.randomUUID(),
    quote: quote.slice(0, 500),
    note: note.slice(0, 1000),
    createdAt: new Date().toISOString(),
  };

  return updateKnowledgeItemMetadata(input.itemId, {
    ...item.metadata,
    annotations: [annotation, ...annotations],
  });
}

async function findKnowledgeItem(itemId: string): Promise<KnowledgeItem> {
  const items = await listKnowledgeItems();
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error("资料不存在。");
  }

  return item;
}
