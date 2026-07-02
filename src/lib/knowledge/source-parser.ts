import type { JsonRecord, KnowledgeItemType, MaterialType } from "@/lib/domain";
import { detectKnowledgeFileType } from "@/lib/knowledge/file-types";
import {
  classifyMaterial,
  mergeClassificationMetadata,
} from "@/lib/knowledge/material-classifier";
import { extractTextFromBuffer } from "@/lib/knowledge/text-extractors";

export type ParseKnowledgeSourceInput =
  | {
      kind: "file";
      fileName: string;
      mimeType: string;
      buffer: Buffer;
    }
  | {
      kind: "idea";
      title?: string;
      content: string;
    }
  | {
      kind: "link";
      url: string;
      title?: string;
      content?: string;
      fetchedUrl?: string;
      fetchedTitle?: string;
      fetchedText?: string;
      metadata?: JsonRecord;
    };

export interface ParsedKnowledgeSource {
  title: string;
  source: string;
  knowledgeType: KnowledgeItemType;
  fileType: string;
  materialType: MaterialType;
  text: string;
  metadata: JsonRecord;
}

export async function parseKnowledgeSource(
  input: ParseKnowledgeSourceInput,
): Promise<ParsedKnowledgeSource> {
  if (input.kind === "idea") {
    const content = input.content.trim();
    const title = normalizeTitle(input.title ?? content, "未命名想法");
    const materialType: MaterialType = "idea";
    const metadata = buildMetadata({
      title,
      text: content,
      materialType,
      sourceKind: "idea",
      baseMetadata: { sourceKind: "idea", materialType },
    });

    return {
      title,
      source: "manual:idea",
      knowledgeType: "text",
      fileType: "text/plain",
      materialType,
      text: content,
      metadata,
    };
  }

  if (input.kind === "link") {
    const url = input.url.trim();
    const materialType: MaterialType = isVideoUrl(url) ? "video_link" : "link";
    const title = normalizeTitle(input.title ?? input.fetchedTitle ?? url, url);
    const text = [title, input.fetchedUrl ?? url, input.content, input.fetchedText]
      .filter((part): part is string => Boolean(part?.trim()))
      .join("\n\n")
      .trim();
    const metadata = buildMetadata({
      title,
      text,
      materialType,
      sourceKind: "link",
      baseMetadata: {
        ...(input.metadata ?? {}),
        sourceKind: "link",
        materialType,
        url,
        fetchedUrl: input.fetchedUrl,
        fetched: Boolean(input.fetchedText),
      },
    });

    return {
      title,
      source: url,
      knowledgeType: "text",
      fileType: "text/uri-list",
      materialType,
      text,
      metadata,
    };
  }

  const detected = detectKnowledgeFileType(input.fileName, input.mimeType);
  if (!detected) {
    throw new Error("这个文件暂时不支持，请上传文本、Office 文档、CSV、HTML 或文本型 PDF。");
  }

  const text = await extractTextFromBuffer(detected.type, input.buffer, {
    fileName: input.fileName,
    mimeType: input.mimeType || detected.mimeType,
  });
  const materialType: MaterialType = detected.type === "image" ? "image" : "document";
  const metadata = buildMetadata({
    title: input.fileName,
    text,
    materialType,
    sourceKind: "file",
    baseMetadata: {
      sourceKind: "file",
      materialType,
      detectedType: detected.type,
    },
  });

  return {
    title: input.fileName,
    source: input.fileName,
    knowledgeType: detected.type,
    fileType: input.mimeType || detected.mimeType || detected.extension,
    materialType,
    text,
    metadata,
  };
}

function buildMetadata(input: {
  title: string;
  text: string;
  materialType: MaterialType;
  sourceKind: string;
  baseMetadata: JsonRecord;
}): JsonRecord {
  const classification = classifyMaterial({
    title: input.title,
    text: input.text,
    materialType: input.materialType,
    sourceKind: input.sourceKind,
  });

  return mergeClassificationMetadata(input.baseMetadata, classification);
}

function normalizeTitle(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  return truncateByCodePoints(trimmed, 40);
}

function truncateByCodePoints(text: string, maxLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxLength) {
    return text;
  }

  return `${characters.slice(0, maxLength).join("")}...`;
}

function isVideoUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|vimeo\.com|bilibili\.com|douyin\.com|kuaishou\.com)/i.test(
    url,
  );
}
