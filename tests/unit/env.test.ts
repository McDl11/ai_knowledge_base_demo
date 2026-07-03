import { describe, expect, it } from "vitest";
import { parseServerEnv } from "@/lib/env";

const requiredEnv = {
  OPENAI_API_KEY: "openai-key",
};

describe("parseServerEnv", () => {
  it("parses local mode values with defaults", () => {
    const env = parseServerEnv(requiredEnv);

    expect(env.DATABASE_PROVIDER).toBe("local");
    expect(env.LOCAL_DB_PATH).toBe("data/local-db.json");
    expect(env.OPENAI_API_KEY).toBe("openai-key");
    expect(env.OPENAI_BASE_URL).toBeUndefined();
    expect(env.OPENAI_WIRE_API).toBe("responses");
    expect(env.OPENAI_DISABLE_RESPONSE_STORAGE).toBe(true);
    expect(env.OPENAI_CHAT_MODEL).toBe("gpt-4o-mini");
    expect(env.OPENAI_REASONING_EFFORT).toBeUndefined();
    expect(env.OPENAI_EMBEDDING_MODEL).toBe("local-hash-embedding-v1");
    expect(env.RAG_AI_QUERY_PLANNING).toBe(true);
    expect(env.VIDEO_PROCESSING_ENABLED).toBe(true);
    expect(env.VIDEO_AUDIO_TRANSCRIPTION_MODEL).toBe("gpt-4o-mini-transcribe");
    expect(env.VIDEO_FRAME_INTERVAL_SECONDS).toBe(8);
    expect(env.VIDEO_MAX_FRAMES).toBe(8);
    expect(env.VIDEO_FFMPEG_PATH).toBe("ffmpeg");
    expect(env.DOUYIN_VIDEO_COMMAND).toBeUndefined();
    expect(env.DOUYIN_VIDEO_COMMAND_ARGS).toBeUndefined();
    expect(env.DOUYIN_VIDEO_COMMAND_TIMEOUT_MS).toBe(120000);
  });

  it("keeps OPENAI_API_KEY as a compatibility fallback", () => {
    const env = parseServerEnv({
      OPENAI_API_KEY: "compatible-key",
    });

    expect(env.OPENAI_API_KEY).toBe("compatible-key");
  });

  it("parses optional reasoning effort for reasoning-capable models", () => {
    const env = parseServerEnv({
      ...requiredEnv,
      OPENAI_REASONING_EFFORT: "medium",
    });

    expect(env.OPENAI_REASONING_EFFORT).toBe("medium");
  });

  it("parses an optional OpenAI-compatible base URL", () => {
    const env = parseServerEnv({
      ...requiredEnv,
      OPENAI_BASE_URL: "https://example.com/v1",
    });

    expect(env.OPENAI_BASE_URL).toBe("https://example.com/v1");
  });

  it("requires Supabase values only in Supabase mode", () => {
    expect(() =>
      parseServerEnv({
        ...requiredEnv,
        DATABASE_PROVIDER: "supabase",
      }),
    ).toThrow();

    const env = parseServerEnv({
      ...requiredEnv,
      DATABASE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });

    expect(env.DATABASE_PROVIDER).toBe("supabase");
    expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-key");
  });

  it("converts RAG_MATCH_THRESHOLD to a number", () => {
    const env = parseServerEnv({
      ...requiredEnv,
      RAG_MATCH_THRESHOLD: "0.82",
    });

    expect(env.RAG_MATCH_THRESHOLD).toBe(0.82);
  });

  it("converts RAG_MATCH_COUNT to an integer", () => {
    const env = parseServerEnv({
      ...requiredEnv,
      RAG_MATCH_COUNT: "8",
    });

    expect(env.RAG_MATCH_COUNT).toBe(8);
  });

  it("parses video processing overrides", () => {
    const env = parseServerEnv({
      ...requiredEnv,
      VIDEO_PROCESSING_ENABLED: "false",
      VIDEO_AUDIO_TRANSCRIPTION_MODEL: "gpt-4o-transcribe",
      VIDEO_FRAME_INTERVAL_SECONDS: "5",
      VIDEO_MAX_FRAMES: "12",
      VIDEO_FFMPEG_PATH: "C:\\tools\\ffmpeg.exe",
      DOUYIN_VIDEO_COMMAND: "node",
      DOUYIN_VIDEO_COMMAND_ARGS: "[\"scripts/download.js\",\"{url}\",\"{outputDir}\"]",
      DOUYIN_VIDEO_COMMAND_TIMEOUT_MS: "90000",
    });

    expect(env.VIDEO_PROCESSING_ENABLED).toBe(false);
    expect(env.VIDEO_AUDIO_TRANSCRIPTION_MODEL).toBe("gpt-4o-transcribe");
    expect(env.VIDEO_FRAME_INTERVAL_SECONDS).toBe(5);
    expect(env.VIDEO_MAX_FRAMES).toBe(12);
    expect(env.VIDEO_FFMPEG_PATH).toBe("C:\\tools\\ffmpeg.exe");
    expect(env.DOUYIN_VIDEO_COMMAND).toBe("node");
    expect(env.DOUYIN_VIDEO_COMMAND_ARGS).toBe(
      "[\"scripts/download.js\",\"{url}\",\"{outputDir}\"]",
    );
    expect(env.DOUYIN_VIDEO_COMMAND_TIMEOUT_MS).toBe(90000);
  });
});
