import type { JsonRecord } from "@/lib/domain";

export type VideoProcessingStage =
  | "queued"
  | "configuration"
  | "download"
  | "audio"
  | "transcription"
  | "frames"
  | "vision"
  | "summary";

export interface DownloadedVideo {
  videoPath: string;
  source: string;
  stdout?: string;
}

export interface FrameText {
  index: number;
  framePath: string;
  text: string;
}

export interface VideoKnowledgeResult {
  title: string;
  content: string;
  metadata: JsonRecord;
}

export class VideoProcessingError extends Error {
  readonly stage: VideoProcessingStage;
  readonly code: string;
  readonly originalCause?: unknown;

  constructor(input: {
    stage: VideoProcessingStage;
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "VideoProcessingError";
    this.stage = input.stage;
    this.code = input.code;
    this.originalCause = input.cause;
  }
}

export function serializeVideoProcessingError(error: unknown): JsonRecord {
  if (error instanceof VideoProcessingError) {
    return {
      stage: error.stage,
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error) {
    return {
      code: "video_processing_error",
      message: error.message,
    };
  }

  return {
    code: "video_processing_error",
    message: "Unknown video processing error.",
  };
}

export function toVideoProcessingError(
  error: unknown,
  input: {
    stage: VideoProcessingStage;
    code: string;
    message: string;
  },
): VideoProcessingError {
  if (error instanceof VideoProcessingError) {
    return error;
  }

  const suffix = error instanceof Error && error.message ? ` ${error.message}` : "";
  return new VideoProcessingError({
    ...input,
    message: `${input.message}${suffix}`.trim(),
    cause: error,
  });
}
