import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transcribeAudioFile } from "@/lib/ai/audio-transcription";
import {
  composeFallbackVideoKnowledgeNote,
  createVideoKnowledgeNote,
} from "@/lib/ai/video-knowledge";
import type { JsonRecord } from "@/lib/domain";
import { getServerEnv } from "@/lib/env";
import { extractAudioFromVideo, extractVideoFrames } from "@/lib/video/ffmpeg";
import { extractFrameTexts } from "@/lib/video/frame-text";
import { cleanupStaleVideoTempDirs } from "@/lib/video/temp-cleanup";
import { downloadVideoWithCommand } from "@/lib/video/video-command-downloader";
import type {
  DownloadedVideo,
  FrameText,
  VideoKnowledgeResult,
  VideoProcessingStage,
} from "@/lib/video/video-types";
import {
  VideoProcessingError,
  serializeVideoProcessingError,
  toVideoProcessingError,
} from "@/lib/video/video-types";

export interface ExtractVideoKnowledgeInput {
  url: string;
  title?: string;
  userContext?: string;
}

export interface VideoProcessingStageUpdate {
  stage: VideoProcessingStage;
  status: "running" | "complete" | "failed";
  details?: JsonRecord;
}

export interface ExtractVideoKnowledgeDeps {
  downloadVideo?: (input: {
    url: string;
    outputDir: string;
  }) => Promise<DownloadedVideo>;
  extractAudio?: (input: {
    videoPath: string;
    outputDir: string;
  }) => Promise<string>;
  transcribeAudio?: (audioPath: string) => Promise<string>;
  extractFrames?: (input: {
    videoPath: string;
    outputDir: string;
    intervalSeconds: number;
    maxFrames: number;
  }) => Promise<string[]>;
  extractFrameTexts?: (framePaths: string[]) => Promise<FrameText[]>;
  summarize?: (input: {
    url: string;
    transcript: string;
    frameTexts: FrameText[];
    userContext?: string;
  }) => Promise<string>;
  cleanup?: boolean;
  onStage?: (update: VideoProcessingStageUpdate) => void | Promise<void>;
}

export async function extractVideoKnowledgeFromUrl(
  input: ExtractVideoKnowledgeInput,
  deps: ExtractVideoKnowledgeDeps = {},
): Promise<VideoKnowledgeResult> {
  const env = getServerEnv();
  if (!env.VIDEO_PROCESSING_ENABLED) {
    await notifyStage(deps.onStage, "configuration", "failed", {
      code: "video_processing_disabled",
      message: "Video processing is disabled.",
    });
    throw new VideoProcessingError({
      stage: "configuration",
      code: "video_processing_disabled",
      message: "Video processing is disabled.",
    });
  }

  await cleanupStaleVideoTempDirs().catch((error) => {
    console.warn("[video] stale temp cleanup failed", error);
  });

  const tempDir = await mkdtemp(join(tmpdir(), "docpilot-video-"));
  const stages: JsonRecord[] = [];
  const warnings: JsonRecord[] = [];
  let downloaded: DownloadedVideo | null = null;
  let transcript = "";
  let framePaths: string[] = [];
  let frameTexts: FrameText[] = [];
  let usedFallbackSummary = false;

  try {
    logVideoStage("start", input.url);
    try {
      logVideoStage("download", input.url);
      await notifyStage(deps.onStage, "download", "running");
      downloaded = await (deps.downloadVideo ?? downloadVideoWithCommand)({
        url: input.url,
        outputDir: tempDir,
      });
      markStage(stages, "download", "complete", {
        source: downloaded.source,
      });
      await notifyStage(deps.onStage, "download", "complete", {
        source: downloaded.source,
      });
    } catch (error) {
      const serialized = serializeVideoProcessingError(error);
      await notifyStage(deps.onStage, "download", "failed", serialized);
      throw toVideoProcessingError(error, {
        stage: "download",
        code: "video_download_failed",
        message: "Video download failed.",
      });
    }

    const audioDir = join(tempDir, "audio");
    await mkdir(audioDir, { recursive: true });

    try {
      logVideoStage("transcription", input.url);
      await notifyStage(deps.onStage, "transcription", "running");
      const audioPath = await (deps.extractAudio ?? extractAudioFromVideo)({
        videoPath: downloaded.videoPath,
        outputDir: audioDir,
      });
      transcript = (
        await (deps.transcribeAudio ?? transcribeAudioFile)(audioPath)
      ).trim();
      markStage(stages, "transcription", "complete", {
        transcriptChars: transcript.length,
      });
      await notifyStage(deps.onStage, "transcription", "complete", {
        transcriptChars: transcript.length,
      });
    } catch (error) {
      const serialized = serializeVideoProcessingError(error);
      warnings.push(serialized);
      markStage(stages, "transcription", "failed", serialized);
      await notifyStage(deps.onStage, "transcription", "failed", serialized);
    }

    const framesDir = join(tempDir, "frames-output");
    await mkdir(framesDir, { recursive: true });

    try {
      logVideoStage("frames", input.url);
      await notifyStage(deps.onStage, "frames", "running");
      framePaths = await (deps.extractFrames ?? extractVideoFrames)({
        videoPath: downloaded.videoPath,
        outputDir: framesDir,
        intervalSeconds: Math.max(
          1,
          Number(env.VIDEO_FRAME_INTERVAL_SECONDS ?? 8),
        ),
        maxFrames: Math.max(0, Number(env.VIDEO_MAX_FRAMES ?? 8)),
      });
      markStage(stages, "frames", "complete", {
        frameCount: framePaths.length,
      });
      await notifyStage(deps.onStage, "frames", "complete", {
        frameCount: framePaths.length,
      });

      logVideoStage("vision", input.url);
      await notifyStage(deps.onStage, "vision", "running");
      frameTexts = await (deps.extractFrameTexts ?? extractFrameTexts)(
        framePaths,
      );
      markStage(stages, "vision", "complete", {
        frameTextCount: frameTexts.length,
      });
      await notifyStage(deps.onStage, "vision", "complete", {
        frameTextCount: frameTexts.length,
      });
    } catch (error) {
      const serialized = serializeVideoProcessingError(error);
      warnings.push(serialized);
      markStage(stages, "vision", "failed", serialized);
      await notifyStage(deps.onStage, "vision", "failed", serialized);
    }

    if (!transcript && frameTexts.length === 0) {
      await notifyStage(deps.onStage, "summary", "failed", {
        code: "video_content_empty",
        message:
          "No usable transcript or frame text was extracted from the video.",
      });
      throw new VideoProcessingError({
        stage: "summary",
        code: "video_content_empty",
        message:
          "No usable transcript or frame text was extracted from the video.",
      });
    }

    let content = "";
    try {
      logVideoStage("summary", input.url);
      await notifyStage(deps.onStage, "summary", "running");
      content = (
        await (deps.summarize ?? createVideoKnowledgeNote)({
          url: input.url,
          transcript,
          frameTexts,
          userContext: input.userContext,
        })
      ).trim();
      if (!content) {
        throw new Error("Video summary is empty.");
      }
      markStage(stages, "summary", "complete", { mode: "ai" });
      await notifyStage(deps.onStage, "summary", "complete", { mode: "ai" });
    } catch (error) {
      usedFallbackSummary = true;
      const serialized = serializeVideoProcessingError(error);
      warnings.push(serialized);
      content = composeFallbackVideoKnowledgeNote({
        url: input.url,
        transcript,
        frameTexts,
        userContext: input.userContext,
      });
      markStage(stages, "summary", "complete", { mode: "fallback" });
      await notifyStage(deps.onStage, "summary", "complete", {
        mode: "fallback",
      });
    }

    return {
      title: input.title?.trim() || "抖音视频内容笔记",
      content,
      metadata: {
        videoProcessing: {
          status: "complete",
          sourceUrl: input.url,
          downloader: downloaded.source,
          transcriptChars: transcript.length,
          frameCount: framePaths.length,
          frameTextCount: frameTexts.length,
          usedFallbackSummary,
          warnings,
          stages,
        },
      },
    };
  } finally {
    logVideoStage("cleanup", input.url);
    if (deps.cleanup !== false) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function markStage(
  stages: JsonRecord[],
  stage: VideoProcessingStage,
  status: "complete" | "failed",
  details: JsonRecord = {},
) {
  stages.push({
    stage,
    status,
    at: new Date().toISOString(),
    ...details,
  });
}

async function notifyStage(
  onStage: ExtractVideoKnowledgeDeps["onStage"],
  stage: VideoProcessingStage,
  status: VideoProcessingStageUpdate["status"],
  details: JsonRecord = {},
) {
  await onStage?.({
    stage,
    status,
    details: {
      at: new Date().toISOString(),
      ...details,
    },
  });
}

function logVideoStage(stage: string, url: string) {
  console.info(`[video] ${stage}: ${url}`);
}
