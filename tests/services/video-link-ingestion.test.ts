import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeItem } from "@/lib/domain";
import { VideoProcessingError } from "@/lib/video/video-types";

const videoProcessorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/video/video-processing", () => ({
  extractVideoKnowledgeFromUrl: videoProcessorMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DATABASE_PROVIDER: "local",
    LOCAL_DB_PATH: dbPath,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    OPENAI_API_KEY: "openai-key",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
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
    VIDEO_FRAME_INTERVAL_SECONDS: 8,
    VIDEO_MAX_FRAMES: 8,
    VIDEO_FFMPEG_PATH: "ffmpeg",
    DOUYIN_VIDEO_COMMAND: undefined,
    DOUYIN_VIDEO_COMMAND_ARGS: undefined,
    DOUYIN_VIDEO_COMMAND_TIMEOUT_MS: 120000,
  }),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-video-link-"));
  dbPath = join(directory, "local-db.json");
  videoProcessorMock.mockReset();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

describe("video link ingestion", () => {
  it("creates a processing item first and stores extracted knowledge later", async () => {
    videoProcessorMock.mockResolvedValue(createVideoResult());

    const { ingestLink } = await import("@/lib/knowledge/link-parser");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestLink({
      url: "https://v.douyin.com/abc/",
    });

    expect(item).toMatchObject({
      title: "抖音视频内容笔记",
      status: "processing",
      metadata: expect.objectContaining({
        materialType: "video_link",
        videoProcessing: expect.objectContaining({
          status: "processing",
          currentStage: "queued",
        }),
      }),
    });
    await vi.waitFor(() => {
      expect(videoProcessorMock).toHaveBeenCalledWith(
        {
          url: "https://v.douyin.com/abc/",
          title: undefined,
          userContext: undefined,
        },
        expect.objectContaining({ onStage: expect.any(Function) }),
      );
    });

    const ready = await waitForItem(item.id, (latest) => latest.status === "ready");
    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("自动分类"),
      query: "自动分类",
      threshold: 0.1,
      count: 1,
    });

    expect(ready.metadata).toMatchObject({
      materialType: "video_link",
      videoProcessing: expect.objectContaining({ status: "complete" }),
    });
    expect(matches[0]?.content).toContain("自动分类");
  }, 15_000);

  it("returns the existing material when the same Douyin link is saved again", async () => {
    let resolveVideo: (value: unknown) => void = () => undefined;
    videoProcessorMock.mockReturnValue(
      new Promise((resolve) => {
        resolveVideo = resolve;
      }),
    );

    const { ingestLink } = await import("@/lib/knowledge/link-parser");

    const first = await ingestLink({ url: "https://v.douyin.com/abc/" });
    const duplicate = await ingestLink({ url: "https://v.douyin.com/abc/" });

    expect(duplicate.id).toBe(first.id);
    expect(duplicate.status).toBe("processing");
    await vi.waitFor(() => {
      expect(videoProcessorMock).toHaveBeenCalledTimes(1);
    });

    resolveVideo(createVideoResult());
    await waitForItem(first.id, (latest) => latest.status === "ready");
  }, 15_000);

  it("keeps the same video material failed when background processing fails", async () => {
    videoProcessorMock.mockRejectedValue(
      new VideoProcessingError({
        stage: "download",
        code: "douyin_download_failed",
        message: "download missing",
      }),
    );

    const { ingestLink } = await import("@/lib/knowledge/link-parser");

    const item = await ingestLink({
      url: "https://v.douyin.com/fail/",
    });
    const failed = await waitForItem(
      item.id,
      (latest) => latest.status === "failed",
    );

    expect(failed).toMatchObject({
      title: "抖音视频内容笔记",
      metadata: expect.objectContaining({
        materialType: "video_link",
        videoProcessing: expect.objectContaining({
          status: "failed",
          stage: "download",
          code: "douyin_download_failed",
          failureReason: "download missing",
          diagnosis: expect.objectContaining({
            title: "视频下载失败",
            suggestion: expect.stringContaining("重新复制抖音分享链接"),
          }),
        }),
      }),
    });
  });

  it("retries a failed video material in place", async () => {
    videoProcessorMock
      .mockRejectedValueOnce(
        new VideoProcessingError({
          stage: "download",
          code: "douyin_download_failed",
          message: "download missing",
        }),
      )
      .mockResolvedValueOnce(createVideoResult());

    const { ingestLink } = await import("@/lib/knowledge/link-parser");
    const { retryVideoKnowledgeItem } = await import(
      "@/lib/knowledge/video-link-ingestion"
    );

    const item = await ingestLink({
      url: "https://v.douyin.com/retry/",
    });
    await waitForItem(item.id, (latest) => latest.status === "failed");

    const retrying = await retryVideoKnowledgeItem(item.id, {
      videoProcessor: videoProcessorMock,
    });
    const ready = await waitForItem(item.id, (latest) => latest.status === "ready");

    expect(retrying.id).toBe(item.id);
    expect(retrying.status).toBe("processing");
    expect(ready.id).toBe(item.id);
    expect(ready.metadata.videoProcessing).toMatchObject({ status: "complete" });
    expect(videoProcessorMock).toHaveBeenCalledTimes(2);
  });
});

function createVideoResult() {
  return {
    title: "抖音视频内容笔记",
    content: "# 视频内容知识笔记\n\n## 核心内容\n视频讲资料上传、自动分类和检索。",
    metadata: {
      videoProcessing: {
        status: "complete",
        transcriptChars: 18,
        frameTextCount: 1,
        stages: [{ stage: "summary", status: "complete" }],
      },
    },
  };
}

async function waitForItem(
  itemId: string,
  predicate: (item: KnowledgeItem) => boolean,
): Promise<KnowledgeItem> {
  const { getKnowledgeItem } = await import("@/lib/db/knowledge-repository");
  let matched: KnowledgeItem | null = null;

  await vi.waitFor(async () => {
    const item = await getKnowledgeItem(itemId);
    expect(item).not.toBeNull();
    if (item && predicate(item)) {
      matched = item;
    }
    expect(matched).not.toBeNull();
  });

  if (!matched) {
    throw new Error(`Timed out waiting for item ${itemId}.`);
  }

  return matched;
}
