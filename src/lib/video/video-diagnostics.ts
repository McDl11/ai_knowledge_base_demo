import type { JsonRecord } from "@/lib/domain";
import type { VideoProcessingStage } from "@/lib/video/video-types";

export interface VideoProcessingDiagnosis {
  title: string;
  message: string;
  suggestion: string;
}

export function createVideoProcessingDiagnosis(input: {
  stage?: unknown;
  code?: unknown;
  message?: unknown;
}): VideoProcessingDiagnosis {
  const stage = readString(input.stage);
  const code = readString(input.code);
  const message = readString(input.message);

  if (code === "video_processing_disabled") {
    return {
      title: "视频处理未启用",
      message: "当前环境关闭了视频下载、转写和画面识别流程。",
      suggestion: "检查 VIDEO_PROCESSING_ENABLED 是否为 true。",
    };
  }

  if (isDownloadStage(stage, code)) {
    return {
      title: "视频下载失败",
      message: message ?? "没有成功把抖音视频下载到本地。",
      suggestion:
        "确认分享链接可访问，必要时重新复制抖音分享链接后点击重新处理。",
    };
  }

  if (stage === "audio" || code === "audio_extraction_failed") {
    return {
      title: "音频提取失败",
      message: message ?? "ffmpeg 没有成功从视频中提取音频。",
      suggestion:
        "检查 VIDEO_FFMPEG_PATH 是否指向 ffmpeg.exe；如果视频本身没有声音，可以依赖画面识别结果。",
    };
  }

  if (stage === "transcription") {
    return {
      title: "语音转文字失败",
      message: message ?? "音频已经提取，但转写模型没有返回可用文本。",
      suggestion:
        "稍后重试；如果视频声音很小或背景噪声很重，可以补充一段人工说明。",
    };
  }

  if (stage === "frames" || code === "frame_extraction_failed") {
    return {
      title: "画面抽取失败",
      message: message ?? "ffmpeg 没有成功抽取视频画面。",
      suggestion:
        "检查视频是否能被 ffmpeg 解码；如果音频转写成功，仍可生成文字笔记。",
    };
  }

  if (stage === "vision") {
    return {
      title: "画面识别失败",
      message: message ?? "关键帧已经抽取，但画面识别没有返回可用内容。",
      suggestion:
        "可以稍后重试；若视频主要靠字幕表达，建议提高抽帧数量后重新处理。",
    };
  }

  if (code === "video_content_empty") {
    return {
      title: "没有提取到可用内容",
      message: message ?? "语音转写和画面识别都没有得到可用内容。",
      suggestion:
        "可以给这个链接添加人工说明，或换一个更清晰、有声音/字幕的视频重新处理。",
    };
  }

  if (stage === "summary") {
    return {
      title: "AI 整理失败",
      message: message ?? "内容已提取，但 AI 整理笔记时失败。",
      suggestion: "点击重新处理；如果仍失败，可以先保存原始转写内容。",
    };
  }

  return {
    title: "视频处理失败",
    message: message ?? "视频处理过程中出现未知错误。",
    suggestion: "可以先点击重新处理；如果仍失败，检查链接、ffmpeg 和模型配置。",
  };
}

export function createVideoStageLog(input: {
  stage: VideoProcessingStage;
  status: "running" | "complete" | "failed";
  details?: JsonRecord;
}): JsonRecord {
  const details = input.details ?? {};
  const diagnosis =
    input.status === "failed"
      ? createVideoProcessingDiagnosis({
          stage: input.stage,
          code: details.code,
          message: details.message,
        })
      : undefined;

  return {
    stage: input.stage,
    status: input.status,
    label: getVideoStageLogLabel(input.stage),
    at:
      typeof details.at === "string" && details.at.trim()
        ? details.at
        : new Date().toISOString(),
    summary: summarizeStageDetails(input.stage, input.status, details),
    ...(diagnosis ? { diagnosis } : {}),
    ...details,
  };
}

function summarizeStageDetails(
  stage: VideoProcessingStage,
  status: string,
  details: JsonRecord,
): string {
  if (status === "running") {
    return `${getVideoStageLogLabel(stage)}中`;
  }

  if (status === "failed") {
    const diagnosis = createVideoProcessingDiagnosis({
      stage,
      code: details.code,
      message: details.message,
    });
    return diagnosis.title;
  }

  if (stage === "download" && typeof details.source === "string") {
    return `下载完成，来源：${details.source}`;
  }
  if (stage === "transcription" && typeof details.transcriptChars === "number") {
    return `转写完成，约 ${details.transcriptChars} 字`;
  }
  if (stage === "frames" && typeof details.frameCount === "number") {
    return `已抽取 ${details.frameCount} 张画面`;
  }
  if (stage === "vision" && typeof details.frameTextCount === "number") {
    return `已识别 ${details.frameTextCount} 条画面内容`;
  }
  if (stage === "summary" && typeof details.mode === "string") {
    return details.mode === "fallback"
      ? "AI 整理失败，已保存兜底笔记"
      : "AI 整理完成";
  }

  return `${getVideoStageLogLabel(stage)}完成`;
}

function getVideoStageLogLabel(stage: VideoProcessingStage): string {
  const labels: Record<VideoProcessingStage, string> = {
    queued: "等待处理",
    configuration: "检查配置",
    download: "下载视频",
    audio: "提取音频",
    transcription: "语音转文字",
    frames: "抽取画面",
    vision: "识别画面",
    summary: "整理知识笔记",
  };

  return labels[stage];
}

function isDownloadStage(stage: string | null, code: string | null): boolean {
  return (
    stage === "download" ||
    code === "video_download_failed" ||
    code === "douyin_download_failed"
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
