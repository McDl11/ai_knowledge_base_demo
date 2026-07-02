import type { KnowledgeItem } from "@/lib/domain";
import {
  listKnowledgeItems,
  updateKnowledgeItemMetadata,
} from "@/lib/db/knowledge-repository";
import {
  isMaterialCategory,
  type MaterialCategory,
} from "@/lib/knowledge/material-categories";

interface ConfirmMaterialCategoryInput {
  itemId: string;
  category: MaterialCategory;
}

export async function confirmMaterialCategory({
  itemId,
  category,
}: ConfirmMaterialCategoryInput): Promise<KnowledgeItem> {
  if (!isMaterialCategory(category) || category === "unknown") {
    throw new Error("请选择一个明确的资料分类。");
  }

  const items = await listKnowledgeItems();
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    throw new Error("资料不存在。");
  }

  return updateKnowledgeItemMetadata(itemId, {
    ...item.metadata,
    category,
    needsReview: false,
    classificationConfidence: 1,
    classificationReason: "confirmed by user",
    classificationSource: "user",
    classificationConfirmedAt: new Date().toISOString(),
  });
}
