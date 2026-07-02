import { describe, expect, it } from "vitest";
import {
  createVideoProcessingDiagnosis,
  createVideoStageLog,
} from "@/lib/video/video-diagnostics";

describe("video diagnostics", () => {
  it("turns known processing failures into readable diagnoses", () => {
    expect(
      createVideoProcessingDiagnosis({
        stage: "download",
        code: "douyin_download_failed",
        message: "download missing",
      }),
    ).toMatchObject({
      title: "视频下载失败",
      suggestion: expect.stringContaining("重新复制抖音分享链接"),
    });

    expect(
      createVideoProcessingDiagnosis({
        stage: "audio",
        code: "audio_extraction_failed",
      }),
    ).toMatchObject({
      title: "音频提取失败",
      suggestion: expect.stringContaining("VIDEO_FFMPEG_PATH"),
    });

    expect(
      createVideoProcessingDiagnosis({
        stage: "summary",
        code: "video_content_empty",
      }),
    ).toMatchObject({
      title: "没有提取到可用内容",
    });
  });

  it("creates stage logs with labels and summaries", () => {
    const complete = createVideoStageLog({
      stage: "frames",
      status: "complete",
      details: { frameCount: 3 },
    });
    const failed = createVideoStageLog({
      stage: "download",
      status: "failed",
      details: { code: "douyin_download_failed", message: "download missing" },
    });

    expect(complete).toMatchObject({
      label: "抽取画面",
      summary: "已抽取 3 张画面",
    });
    expect(failed).toMatchObject({
      label: "下载视频",
      diagnosis: expect.objectContaining({ title: "视频下载失败" }),
    });
  });
});
