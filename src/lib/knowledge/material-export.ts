import type { KnowledgeItem } from "@/lib/domain";
import {
  getMaterialCategoryLabel,
  getMaterialKindLabel,
  getMaterialSummary,
  getMaterialTags,
  getMaterialUserNote,
} from "@/lib/knowledge/material-view";
import { getMaterialAnnotations } from "@/lib/knowledge/material-annotations";

export type MaterialExportStyle = "markdown" | "card" | "json";

export interface MaterialExportContent {
  content: string;
  fileName: string;
  mimeType: string;
}

export function exportMaterial(
  item: KnowledgeItem,
  content: string,
  style: MaterialExportStyle,
): MaterialExportContent {
  if (style === "json") {
    return {
      content: JSON.stringify({ item, content }, null, 2),
      fileName: `${safeFileName(item.title)}.json`,
      mimeType: "application/json;charset=utf-8",
    };
  }

  if (style === "card") {
    return {
      content: buildMaterialCardMarkdown(item),
      fileName: `${safeFileName(item.title)}-card.md`,
      mimeType: "text/markdown;charset=utf-8",
    };
  }

  return {
    content: buildOriginalMarkdown(item, content),
    fileName: `${safeFileName(item.title)}.md`,
    mimeType: "text/markdown;charset=utf-8",
  };
}

function buildOriginalMarkdown(item: KnowledgeItem, content: string): string {
  return [
    `# ${item.title}`,
    "",
    `- 类型：${getMaterialKindLabel(item)}`,
    `- 分类：${getMaterialCategoryLabel(item)}`,
    `- 来源：${item.fileName}`,
    `- 创建时间：${item.createdAt}`,
    "",
    "## 摘要",
    "",
    getMaterialSummary(item) || "无摘要",
    "",
    "## 处理说明",
    "",
    getMaterialUserNote(item) || "无",
    "",
    ...buildAnnotationSection(item),
    "",
    "## 原文",
    "",
    content || "暂无原文内容",
    "",
  ].join("\n");
}

function buildMaterialCardMarkdown(item: KnowledgeItem): string {
  const tags = getMaterialTags(item);

  return [
    `# ${item.title}`,
    "",
    `> ${getMaterialSummary(item) || "无摘要"}`,
    "",
    `- 类型：${getMaterialKindLabel(item)}`,
    `- 分类：${getMaterialCategoryLabel(item)}`,
    `- 来源：${item.fileName}`,
    `- 标签：${tags.length > 0 ? tags.join(", ") : "无"}`,
    `- 处理说明：${getMaterialUserNote(item) || "无"}`,
    "",
    ...buildAnnotationSection(item),
  ].join("\n");
}

function buildAnnotationSection(item: KnowledgeItem): string[] {
  const annotations = getMaterialAnnotations(item.metadata);
  if (annotations.length === 0) {
    return ["## 片段注释", "", "无"];
  }

  return [
    "## 片段注释",
    "",
    ...annotations.flatMap((annotation, index) => [
      `### 注释 ${index + 1}`,
      "",
      `> ${annotation.quote}`,
      "",
      annotation.note,
      "",
    ]),
  ];
}

function safeFileName(input: string): string {
  const normalized = input
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");

  return normalized || "material";
}
