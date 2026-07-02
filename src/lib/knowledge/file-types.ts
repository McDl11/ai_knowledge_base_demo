import type { KnowledgeItemType } from "@/lib/domain";

export interface DetectedKnowledgeFileType {
  type: KnowledgeItemType;
  extension: string;
  mimeType: string;
}

const extensionMap = new Map<string, KnowledgeItemType>([
  [".txt", "text"],
  [".md", "markdown"],
  [".markdown", "markdown"],
  [".pdf", "pdf"],
  [".docx", "docx"],
  [".xlsx", "xlsx"],
  [".xls", "xlsx"],
  [".pptx", "pptx"],
  [".csv", "csv"],
  [".html", "html"],
  [".htm", "html"],
  [".jpg", "image"],
  [".jpeg", "image"],
  [".png", "image"],
  [".webp", "image"],
]);

const mimeMap = new Map<string, KnowledgeItemType>([
  ["text/plain", "text"],
  ["text/markdown", "markdown"],
  ["application/pdf", "pdf"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/msword", "docx"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
  ["application/vnd.ms-excel", "xlsx"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],
  ["text/csv", "csv"],
  ["application/csv", "csv"],
  ["text/html", "html"],
  ["application/xhtml+xml", "html"],
  ["image/jpeg", "image"],
  ["image/png", "image"],
  ["image/webp", "image"],
]);

export function detectKnowledgeFileType(
  fileName: string,
  mimeType: string,
): DetectedKnowledgeFileType | null {
  const normalizedMimeType = mimeType.toLowerCase().trim();
  const mimeMatch = mimeMap.get(normalizedMimeType);
  if (mimeMatch) {
    return {
      type: mimeMatch,
      extension: getExtension(fileName),
      mimeType: normalizedMimeType,
    };
  }

  const extension = getExtension(fileName);
  const extensionMatch = extensionMap.get(extension);
  if (!extensionMatch) {
    return null;
  }

  return {
    type: extensionMatch,
    extension,
    mimeType: normalizedMimeType,
  };
}

export function isSupportedKnowledgeFile(
  fileName: string,
  mimeType: string,
): boolean {
  return detectKnowledgeFileType(fileName, mimeType) !== null;
}

function getExtension(fileName: string): string {
  const normalizedFileName = fileName.toLowerCase().trim();
  const dotIndex = normalizedFileName.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return normalizedFileName.slice(dotIndex);
}
