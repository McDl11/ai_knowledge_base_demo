import type { JsonRecord, KnowledgeItem } from "@/lib/domain";
import {
  createProcessingKnowledgeItem,
  getKnowledgeItem,
  listKnowledgeItems,
  markKnowledgeItemFailed,
  updateKnowledgeItemMetadata,
  updateKnowledgeItemStatus,
} from "@/lib/db/knowledge-repository";
import { finalizeKnowledgeItemFromText } from "@/lib/knowledge/ingestion";
import { parseKnowledgeSource } from "@/lib/knowledge/source-parser";
import {
  createVideoProcessingDiagnosis,
  createVideoStageLog,
} from "@/lib/video/video-diagnostics";
import { extractVideoKnowledgeFromUrl } from "@/lib/video/video-processing";
import type { VideoProcessingStage } from "@/lib/video/video-types";
import { serializeVideoProcessingError } from "@/lib/video/video-types";

const pendingVideoLinkIngestions = new Map<string, Promise<KnowledgeItem>>();
const defaultVideoTitle = "抖音视频内容笔记";

interface IngestVideoLinkInput {
  url: string;
  title?: string;
  content?: string;
}

interface ProcessVideoKnowledgeInput {
  url: string;
  title?: string;
  userContext?: string;
}

interface VideoLinkIngestionOptions {
  videoProcessor?: typeof extractVideoKnowledgeFromUrl;
  startProcessing?: boolean;
}

export async function ingestVideoLink(
  input: IngestVideoLinkInput,
  options: VideoLinkIngestionOptions = {},
): Promise<KnowledgeItem> {
  const url = normalizeSourceUrl(input.url);
  const pending = pendingVideoLinkIngestions.get(url);
  if (pending) {
    return pending;
  }

  const ingestion = createVideoLinkItem(url, input, options);
  pendingVideoLinkIngestions.set(url, ingestion);

  try {
    return await ingestion;
  } finally {
    pendingVideoLinkIngestions.delete(url);
  }
}

async function createVideoLinkItem(
  url: string,
  input: IngestVideoLinkInput,
  options: VideoLinkIngestionOptions,
): Promise<KnowledgeItem> {
  const existing = await findExistingVideoLinkItem(url);
  if (existing) {
    return existing;
  }

  const metadata = buildQueuedVideoMetadata({
    baseMetadata: {},
    url,
    userContext: input.content,
  });
  const item = await createProcessingKnowledgeItem({
    title: input.title?.trim() || defaultVideoTitle,
    type: "text",
    fileName: url,
    fileType: "text/uri-list",
    metadata,
  });

  if (options.startProcessing !== false) {
    startBackgroundVideoProcessing(
      item.id,
      {
        url,
        title: input.title,
        userContext: input.content,
      },
      options,
    );
  }

  return item;
}

export async function retryVideoKnowledgeItem(
  itemId: string,
  options: VideoLinkIngestionOptions = {},
): Promise<KnowledgeItem> {
  const item = await getKnowledgeItem(itemId);
  if (!item) {
    throw new Error("Material not found.");
  }
  if (item.status === "processing") {
    return item;
  }

  const url = getVideoSourceUrl(item);
  if (!url) {
    throw new Error("This material does not contain a video link.");
  }

  const userContext = getStoredUserContext(item.metadata);
  const metadata = buildQueuedVideoMetadata({
    baseMetadata: item.metadata,
    url,
    userContext,
  });
  const retryingItem = await updateKnowledgeItemStatus({
    itemId,
    status: "processing",
    chunkCount: 0,
    metadata,
  });

  if (options.startProcessing !== false) {
    startBackgroundVideoProcessing(
      itemId,
      {
        url,
        title: item.title,
        userContext,
      },
      options,
    );
  }

  return retryingItem;
}

export function startBackgroundVideoProcessing(
  itemId: string,
  input: ProcessVideoKnowledgeInput,
  options: VideoLinkIngestionOptions = {},
) {
  void processVideoKnowledgeItem(itemId, input, options).catch((error) => {
    console.error("[video] background processing failed", error);
  });
}

export async function processVideoKnowledgeItem(
  itemId: string,
  input: ProcessVideoKnowledgeInput,
  options: VideoLinkIngestionOptions = {},
): Promise<KnowledgeItem> {
  const url = normalizeSourceUrl(input.url);
  const existing = await getKnowledgeItem(itemId);
  if (!existing) {
    throw new Error("Material not found.");
  }

  await updateKnowledgeItemStatus({
    itemId,
    status: "processing",
    chunkCount: 0,
    metadata: buildQueuedVideoMetadata({
      baseMetadata: existing.metadata,
      url,
      userContext: input.userContext,
    }),
  });

  try {
    const videoProcessor = options.videoProcessor ?? extractVideoKnowledgeFromUrl;
    const video = await videoProcessor(
      {
        url,
        title: input.title,
        userContext: input.userContext,
      },
      {
        onStage: (update) =>
          updateVideoProcessingStage(itemId, url, update.stage, update.status, {
            ...(update.details ?? {}),
          }),
      },
    );
    const content = [input.userContext, video.content]
      .filter((part): part is string => Boolean(part?.trim()))
      .join("\n\n");
    const latest = await getKnowledgeItem(itemId);
    const parsed = await parseKnowledgeSource({
      kind: "link",
      url,
      title: video.title || input.title || defaultVideoTitle,
      content,
      metadata: buildCompletedVideoMetadata({
        baseMetadata: latest?.metadata ?? existing.metadata,
        resultMetadata: video.metadata,
        url,
      }),
    });

    return finalizeKnowledgeItemFromText({
      itemId,
      text: parsed.text,
      metadata: {
        ...parsed.metadata,
        ...pickUserControlledMetadata(latest?.metadata ?? existing.metadata),
      },
    });
  } catch (error) {
    return markVideoProcessingFailed(itemId, error);
  }
}

async function findExistingVideoLinkItem(
  url: string,
): Promise<KnowledgeItem | null> {
  const normalized = normalizeSourceUrl(url);
  const items = await listKnowledgeItems();

  return (
    items.find((item) =>
      collectVideoSourceUrls(item).some(
        (candidate) => normalizeSourceUrl(candidate) === normalized,
      ),
    ) ?? null
  );
}

async function updateVideoProcessingStage(
  itemId: string,
  url: string,
  stage: VideoProcessingStage,
  status: "running" | "complete" | "failed",
  details: JsonRecord,
) {
  const item = await getKnowledgeItem(itemId);
  if (!item) {
    return;
  }

  const current = getVideoProcessingRecord(item.metadata);
  const logEntry = createVideoStageLog({
    stage,
    status,
    details,
  });
  await updateKnowledgeItemMetadata(itemId, {
    ...item.metadata,
    videoProcessing: {
      ...current,
      status: "processing",
      sourceUrl: url,
      currentStage: stage,
      stages: appendStage(current.stages, logEntry),
    },
  });
}

async function markVideoProcessingFailed(
  itemId: string,
  error: unknown,
): Promise<KnowledgeItem> {
  const item = await getKnowledgeItem(itemId);
  if (!item) {
    throw new Error("Material not found.");
  }

  const serialized = serializeVideoProcessingError(error);
  const current = getVideoProcessingRecord(item.metadata);
  const fallbackStage = readString(current.currentStage) ?? "summary";
  const failedStage = readStage(serialized.stage) ?? readStage(fallbackStage) ?? "summary";
  const reason = readString(serialized.message) ?? "Video processing failed.";
  const diagnosis = createVideoProcessingDiagnosis({
    stage: failedStage,
    code: serialized.code,
    message: reason,
  });
  const failedMetadata = {
    ...item.metadata,
    failureReason: reason.slice(0, 500),
    videoProcessing: {
      ...current,
      ...serialized,
      status: "failed",
      currentStage: failedStage,
      failureReason: reason.slice(0, 500),
      diagnosis,
      stages: appendStage(
        current.stages,
        createVideoStageLog({
          stage: failedStage,
          status: "failed",
          details: serialized,
        }),
      ),
    },
  };

  return markKnowledgeItemFailed(itemId, reason, failedMetadata);
}

function buildQueuedVideoMetadata(input: {
  baseMetadata: JsonRecord;
  url: string;
  userContext?: string;
}): JsonRecord {
  const metadata: JsonRecord = {
    ...input.baseMetadata,
    sourceKind: "link",
    materialType: "video_link",
    url: input.url,
    fetched: false,
    category:
      typeof input.baseMetadata.category === "string"
        ? input.baseMetadata.category
        : "unknown",
    summary: "视频正在处理，完成后会自动生成可检索的知识笔记。",
    tags: mergeStringArrays(input.baseMetadata.tags, ["video_link", "link"]),
    needsReview:
      typeof input.baseMetadata.needsReview === "boolean"
        ? input.baseMetadata.needsReview
        : true,
    videoProcessing: {
      ...clearFailureFields(getVideoProcessingRecord(input.baseMetadata)),
      status: "processing",
      sourceUrl: input.url,
      currentStage: "queued",
      stages: appendStage(
        getVideoProcessingRecord(input.baseMetadata).stages,
        createVideoStageLog({
          stage: "queued",
          status: "complete",
        }),
      ),
      warnings: [],
    },
  };

  if (input.userContext?.trim()) {
    metadata.userContext = input.userContext.trim();
  }
  delete metadata.failureReason;

  return metadata;
}

function buildCompletedVideoMetadata(input: {
  baseMetadata: JsonRecord;
  resultMetadata: JsonRecord;
  url: string;
}): JsonRecord {
  const current = getVideoProcessingRecord(input.baseMetadata);
  const result = getVideoProcessingRecord(input.resultMetadata);

  return {
    ...input.resultMetadata,
    videoProcessing: {
      ...current,
      ...result,
      status: "complete",
      sourceUrl: input.url,
      currentStage: "summary",
      stages:
        Array.isArray(result.stages) && result.stages.length > 0
          ? result.stages
          : current.stages,
    },
  };
}

function collectVideoSourceUrls(item: KnowledgeItem): string[] {
  const videoProcessing = getVideoProcessingRecord(item.metadata);
  return [item.fileName, item.metadata.url, videoProcessing.sourceUrl].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

function getVideoSourceUrl(item: KnowledgeItem): string | null {
  const urls = collectVideoSourceUrls(item);
  return urls[0] ? normalizeSourceUrl(urls[0]) : null;
}

function getStoredUserContext(metadata: JsonRecord): string | undefined {
  const value = metadata.userContext;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getVideoProcessingRecord(metadata: JsonRecord): JsonRecord {
  const value = metadata.videoProcessing;
  return isJsonRecord(value) ? value : {};
}

function clearFailureFields(metadata: JsonRecord): JsonRecord {
  const next = { ...metadata };
  delete next.code;
  delete next.failureReason;
  delete next.message;
  delete next.stage;
  return next;
}

function appendStage(stages: unknown, stage: JsonRecord): JsonRecord[] {
  const current = Array.isArray(stages)
    ? stages.filter(isJsonRecord)
    : [];

  return [
    ...current,
    {
      at: new Date().toISOString(),
      ...stage,
    },
  ].slice(-40);
}

function pickUserControlledMetadata(metadata: JsonRecord): JsonRecord {
  const picked: JsonRecord = {};
  if (typeof metadata.userNote === "string") {
    picked.userNote = metadata.userNote;
  }
  if (Array.isArray(metadata.annotations)) {
    picked.annotations = metadata.annotations;
  }
  if (typeof metadata.userContext === "string") {
    picked.userContext = metadata.userContext;
  }
  return picked;
}

function mergeStringArrays(value: unknown, additions: string[]): string[] {
  const existing = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  return [...new Set([...existing, ...additions])];
}

function normalizeSourceUrl(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    url.hash = "";
    return url.toString();
  } catch {
    return trimmed;
  }
}

function readStage(value: unknown): VideoProcessingStage | null {
  if (
    value === "queued" ||
    value === "configuration" ||
    value === "download" ||
    value === "audio" ||
    value === "transcription" ||
    value === "frames" ||
    value === "vision" ||
    value === "summary"
  ) {
    return value;
  }

  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
