import type { KnowledgeItem } from "@/lib/domain";
import {
  isMaterialCategory,
  materialCategoryLabel,
} from "@/lib/knowledge/material-categories";

export function getMaterialKind(item: KnowledgeItem): string {
  const materialType = item.metadata.materialType;
  if (typeof materialType === "string") {
    return materialType;
  }

  return "document";
}

export function getMaterialKindLabel(item: KnowledgeItem): string {
  const materialType = getMaterialKind(item);
  if (materialType === "idea") {
    return "想法";
  }
  if (materialType === "video_link") {
    return "视频链接";
  }
  if (materialType === "link") {
    return "链接";
  }
  if (materialType === "image") {
    return "图片";
  }

  return "文件";
}

export function getMaterialCategoryLabel(item: KnowledgeItem): string {
  const category = item.metadata.category;
  if (isMaterialCategory(category)) {
    return materialCategoryLabel[category];
  }

  return "未分类";
}

export function getMaterialSummary(item: KnowledgeItem): string {
  const summary = item.metadata.summary;
  return typeof summary === "string" ? summary : "";
}

export function getMaterialTags(item: KnowledgeItem): string[] {
  const tags = item.metadata.tags;
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.filter((tag): tag is string => typeof tag === "string");
}

export function needsMaterialReview(item: KnowledgeItem): boolean {
  return item.metadata.needsReview === true;
}

export function getMaterialUserNote(item: KnowledgeItem): string {
  const userNote = item.metadata.userNote;
  return typeof userNote === "string" ? userNote : "";
}

export interface VideoProcessingInfo {
  status: string;
  sourceUrl: string;
  currentStage: string;
  failureReason: string;
  diagnosisTitle: string;
  diagnosisSuggestion: string;
  stages: VideoProcessingStageInfo[];
  warnings: string[];
}

export interface VideoProcessingStageInfo {
  stage: string;
  status: string;
  at: string;
  label: string;
  summary: string;
  message: string;
  diagnosisTitle: string;
  diagnosisSuggestion: string;
}

export interface VideoContentSection {
  title: string;
  content: string;
}

export function isVideoMaterial(item: KnowledgeItem): boolean {
  return getMaterialKind(item) === "video_link" || Boolean(getVideoProcessingInfo(item));
}

export function getVideoProcessingInfo(
  item: KnowledgeItem,
): VideoProcessingInfo | null {
  const processing = item.metadata.videoProcessing;
  if (!isRecord(processing)) {
    return null;
  }

  return {
    status: readString(processing.status) ?? item.status,
    sourceUrl:
      readString(processing.sourceUrl) ?? readString(item.metadata.url) ?? item.fileName,
    currentStage: readString(processing.currentStage) ?? "",
    failureReason:
      readString(processing.failureReason) ??
      readString(processing.message) ??
      readString(item.metadata.failureReason) ??
      "",
    diagnosisTitle: readNestedString(processing.diagnosis, "title"),
    diagnosisSuggestion: readNestedString(processing.diagnosis, "suggestion"),
    stages: readStages(processing.stages),
    warnings: readWarnings(processing.warnings),
  };
}

export function getVideoStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    queued: "等待处理",
    configuration: "检查配置",
    download: "下载视频",
    audio: "提取音频",
    transcription: "语音转文字",
    frames: "抽取画面",
    vision: "识别画面",
    summary: "整理知识笔记",
  };

  return labels[stage] ?? stage;
}

export function getVideoStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    processing: "处理中",
    running: "进行中",
    complete: "已完成",
    ready: "已完成",
    failed: "失败",
    skipped: "已跳过",
  };

  return labels[status] ?? status;
}

export function splitVideoContent(content: string): VideoContentSection[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const sections: VideoContentSection[] = [];
  let currentTitle = "AI 整理笔记";
  let currentLines: string[] = [];

  for (const line of trimmed.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      pushSection(sections, currentTitle, currentLines);
      currentTitle = heading[1] ?? "视频内容";
      currentLines = [];
      continue;
    }

    if (!line.startsWith("# ")) {
      currentLines.push(line);
    }
  }

  pushSection(sections, currentTitle, currentLines);
  return sections.length > 0
    ? sections
    : [{ title: "视频内容", content: trimmed }];
}

function pushSection(
  sections: VideoContentSection[],
  title: string,
  lines: string[],
) {
  const content = lines.join("\n").trim();
  if (content) {
    sections.push({ title, content });
  }
}

function readStages(value: unknown): VideoProcessingStageInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord).map((stage) => ({
    stage: readString(stage.stage) ?? "",
    status: readString(stage.status) ?? "",
    at: readString(stage.at) ?? "",
    label: readString(stage.label) ?? "",
    summary: readString(stage.summary) ?? "",
    message: readString(stage.message) ?? readString(stage.code) ?? "",
    diagnosisTitle: readNestedString(stage.diagnosis, "title"),
    diagnosisSuggestion: readNestedString(stage.diagnosis, "suggestion"),
  }));
}

function readWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((warning) => {
      if (isRecord(warning)) {
        return readString(warning.message) ?? readString(warning.code);
      }
      return typeof warning === "string" ? warning : null;
    })
    .filter((warning): warning is string => Boolean(warning));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedString(value: unknown, key: string): string {
  if (!isRecord(value)) {
    return "";
  }

  return readString(value[key]) ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
