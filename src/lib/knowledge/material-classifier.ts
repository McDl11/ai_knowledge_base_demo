import type { JsonRecord, MaterialType } from "@/lib/domain";
import type { MaterialCategory } from "@/lib/knowledge/material-categories";

export interface MaterialClassification {
  category: MaterialCategory;
  summary: string;
  tags: string[];
  confidence: number;
  needsReview: boolean;
  reason: string;
}

interface MaterialCategoryScore {
  category: Exclude<MaterialCategory, "unknown">;
  score: number;
  tags: string[];
  reason: string;
}

interface ClassifyMaterialInput {
  title: string;
  text: string;
  materialType: MaterialType;
  sourceKind: string;
}

export function classifyMaterial(
  input: ClassifyMaterialInput,
): MaterialClassification {
  const combined = `${input.title}\n${input.text}`.normalize("NFKC").toLowerCase();
  const scores: MaterialCategoryScore[] = [
    scoreCategory(combined, "tool", ["工具", "软件", "插件", "plugin", "tool", "saas"]),
    scoreCategory(combined, "project_doc", [
      "项目",
      "方案",
      "需求",
      "roadmap",
      "prd",
      "project",
    ]),
    scoreCategory(combined, "competitor", ["竞品", "对标", "竞争", "competitor"]),
    scoreCategory(combined, "todo", ["待办", "todo", "行动项", "下一步"]),
    scoreCategory(combined, "knowledge_note", [
      "笔记",
      "教程",
      "说明",
      "知识",
      "文档",
      "guide",
      "docs",
    ]),
  ];

  if (input.materialType === "idea") {
    scores.push({
      category: "idea",
      score: 0.78,
      tags: ["idea"],
      reason: "manual idea input",
    });
  }

  const best = scores.sort((left, right) => right.score - left.score)[0];
  const category = best && best.score > 0 ? best.category : "unknown";
  const confidence = best?.score ?? 0.2;

  return {
    category,
    summary: summarizeText(input.text || input.title),
    tags: normalizeTags([
      input.materialType,
      input.sourceKind,
      ...(best?.tags ?? []),
    ]),
    confidence,
    needsReview: confidence < 0.62 || category === "unknown",
    reason: best?.reason ?? "no strong signal",
  };
}

export function mergeClassificationMetadata(
  metadata: JsonRecord,
  classification: MaterialClassification,
): JsonRecord {
  return {
    ...metadata,
    category: classification.category,
    summary: classification.summary,
    tags: classification.tags,
    classificationConfidence: classification.confidence,
    needsReview: classification.needsReview,
    classificationReason: classification.reason,
  };
}

function scoreCategory(
  text: string,
  category: Exclude<MaterialCategory, "idea" | "unknown">,
  keywords: string[],
): MaterialCategoryScore {
  const hits = keywords.filter((keyword) => text.includes(keyword));
  return {
    category,
    score: hits.length === 0 ? 0 : Math.min(0.95, 0.52 + hits.length * 0.12),
    tags: hits.slice(0, 4),
    reason: hits.length > 0 ? `matched: ${hits.join(", ")}` : "no match",
  };
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 120)}...`;
}

function normalizeTags(input: string[]): string[] {
  return [...new Set(input.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
