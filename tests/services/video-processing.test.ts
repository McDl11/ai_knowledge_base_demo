import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { VideoProcessingError } from "@/lib/video/video-types";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DATABASE_PROVIDER: "local",
    LOCAL_DB_PATH: "data/local-db.json",
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    OPENAI_API_KEY: "openai-key",
    OPENAI_BASE_URL: "https://example.com/v1",
    OPENAI_WIRE_API: "responses",
    OPENAI_DISABLE_RESPONSE_STORAGE: true,
    OPENAI_CHAT_MODEL: "gpt-4o-mini",
    OPENAI_REASONING_EFFORT: "medium",
    OPENAI_EMBEDDING_MODEL: "local-hash-embedding-v1",
    RAG_MATCH_THRESHOLD: 0.78,
    RAG_MATCH_COUNT: 5,
    RAG_AI_QUERY_PLANNING: true,
    VIDEO_PROCESSING_ENABLED: true,
    VIDEO_AUDIO_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
    VIDEO_FRAME_INTERVAL_SECONDS: 5,
    VIDEO_MAX_FRAMES: 2,
    VIDEO_FFMPEG_PATH: "ffmpeg",
    DOUYIN_VIDEO_COMMAND: undefined,
    DOUYIN_VIDEO_COMMAND_ARGS: undefined,
    DOUYIN_VIDEO_COMMAND_TIMEOUT_MS: 120000,
  }),
}));

describe("extractVideoKnowledgeFromUrl", () => {
  it("combines transcript and frame text into a knowledge note", async () => {
    const { extractVideoKnowledgeFromUrl } = await import(
      "@/lib/video/video-processing"
    );
    const summarize = vi.fn().mockResolvedValue(
      "# 视频内容知识笔记\n\n## 核心内容\n视频讲了资料自动分类和链接入库。",
    );

    const result = await extractVideoKnowledgeFromUrl(
      {
        url: "https://v.douyin.com/abc/",
        userContext: "用户觉得这条视频适合作为产品灵感。",
      },
      {
        downloadVideo: async ({ outputDir }) => ({
          videoPath: join(outputDir, "source.mp4"),
          source: "test",
        }),
        extractAudio: async ({ outputDir }) => join(outputDir, "audio.mp3"),
        transcribeAudio: async () => "这里讲资料上传后自动分类。",
        extractFrames: async ({ outputDir }) => [
          join(outputDir, "frame-001.jpg"),
        ],
        extractFrameTexts: async (framePaths) => [
          {
            index: 1,
            framePath: framePaths[0] ?? "frame-001.jpg",
            text: "画面文字：上传、分类、检索",
          },
        ],
        summarize,
      },
    );

    expect(result.title).toBe("抖音视频内容笔记");
    expect(result.content).toContain("资料自动分类");
    expect(summarize).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: "这里讲资料上传后自动分类。",
        frameTexts: [
          expect.objectContaining({ text: "画面文字：上传、分类、检索" }),
        ],
      }),
    );
    expect(result.metadata.videoProcessing).toMatchObject({
      status: "complete",
      transcriptChars: 13,
      frameCount: 1,
      frameTextCount: 1,
      usedFallbackSummary: false,
    });
  });

  it("falls back to a raw note when AI summary fails", async () => {
    const { extractVideoKnowledgeFromUrl } = await import(
      "@/lib/video/video-processing"
    );

    const result = await extractVideoKnowledgeFromUrl(
      { url: "https://v.douyin.com/abc/" },
      {
        downloadVideo: async ({ outputDir }) => ({
          videoPath: join(outputDir, "source.mp4"),
          source: "test",
        }),
        extractAudio: async ({ outputDir }) => join(outputDir, "audio.mp3"),
        transcribeAudio: async () => "视频原始转写内容。",
        extractFrames: async () => [],
        extractFrameTexts: async () => [],
        summarize: async () => {
          throw new Error("model unavailable");
        },
      },
    );

    expect(result.content).toContain("## 原始转写");
    expect(result.content).toContain("视频原始转写内容。");
    expect(result.metadata.videoProcessing).toMatchObject({
      status: "complete",
      usedFallbackSummary: true,
    });
  });

  it("fails when no transcript or frame text can be extracted", async () => {
    const { extractVideoKnowledgeFromUrl } = await import(
      "@/lib/video/video-processing"
    );

    await expect(
      extractVideoKnowledgeFromUrl(
        { url: "https://v.douyin.com/empty/" },
        {
          downloadVideo: async ({ outputDir }) => ({
            videoPath: join(outputDir, "source.mp4"),
            source: "test",
          }),
          extractAudio: async () => {
            throw new Error("no audio");
          },
          extractFrames: async () => [],
          extractFrameTexts: async () => [],
        },
      ),
    ).rejects.toBeInstanceOf(VideoProcessingError);
  });
});
