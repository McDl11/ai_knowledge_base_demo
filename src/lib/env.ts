import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_PROVIDER: z.enum(["local", "supabase"]).default("local"),
    LOCAL_DB_PATH: z.string().min(1).default("data/local-db.json"),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1).optional(),
    OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    OPENAI_WIRE_API: z.enum(["responses", "chat_completions"]).default("responses"),
    OPENAI_DISABLE_RESPONSE_STORAGE: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-4o-mini"),
    OPENAI_REASONING_EFFORT: z
      .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
      .optional(),
    OPENAI_EMBEDDING_MODEL: z
      .string()
      .min(1)
      .default("local-hash-embedding-v1"),
    RAG_MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.78),
    RAG_MATCH_COUNT: z.coerce.number().int().positive().default(5),
    RAG_AI_QUERY_PLANNING: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    VIDEO_PROCESSING_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    VIDEO_AUDIO_TRANSCRIPTION_MODEL: z
      .string()
      .min(1)
      .default("gpt-4o-mini-transcribe"),
    VIDEO_FRAME_INTERVAL_SECONDS: z.coerce.number().positive().default(8),
    VIDEO_MAX_FRAMES: z.coerce.number().int().nonnegative().default(8),
    VIDEO_FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
    DOUYIN_VIDEO_COMMAND: z.string().min(1).optional(),
    DOUYIN_VIDEO_COMMAND_ARGS: z.string().min(1).optional(),
    DOUYIN_VIDEO_COMMAND_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(120_000),
  })
  .transform((env, context) => {
    const apiKey = env.OPENAI_API_KEY;
    if (env.DATABASE_PROVIDER === "supabase") {
      if (!env.SUPABASE_URL) {
        context.addIssue({
          code: "custom",
          message: "SUPABASE_URL is required when DATABASE_PROVIDER=supabase.",
          path: ["SUPABASE_URL"],
        });
      }
      if (!env.SUPABASE_SERVICE_ROLE_KEY) {
        context.addIssue({
          code: "custom",
          message:
            "SUPABASE_SERVICE_ROLE_KEY is required when DATABASE_PROVIDER=supabase.",
          path: ["SUPABASE_SERVICE_ROLE_KEY"],
        });
      }
    }

    if (!apiKey) {
      context.addIssue({
        code: "custom",
        message: "OPENAI_API_KEY is required.",
        path: ["OPENAI_API_KEY"],
      });
      return z.NEVER;
    }

    return {
      DATABASE_PROVIDER: env.DATABASE_PROVIDER,
      LOCAL_DB_PATH: env.LOCAL_DB_PATH,
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: apiKey,
      OPENAI_BASE_URL: env.OPENAI_BASE_URL,
      OPENAI_WIRE_API: env.OPENAI_WIRE_API,
      OPENAI_DISABLE_RESPONSE_STORAGE: env.OPENAI_DISABLE_RESPONSE_STORAGE,
      OPENAI_CHAT_MODEL: env.OPENAI_CHAT_MODEL,
      OPENAI_REASONING_EFFORT: env.OPENAI_REASONING_EFFORT,
      OPENAI_EMBEDDING_MODEL: env.OPENAI_EMBEDDING_MODEL,
      RAG_MATCH_THRESHOLD: env.RAG_MATCH_THRESHOLD,
      RAG_MATCH_COUNT: env.RAG_MATCH_COUNT,
      RAG_AI_QUERY_PLANNING: env.RAG_AI_QUERY_PLANNING,
      VIDEO_PROCESSING_ENABLED: env.VIDEO_PROCESSING_ENABLED,
      VIDEO_AUDIO_TRANSCRIPTION_MODEL: env.VIDEO_AUDIO_TRANSCRIPTION_MODEL,
      VIDEO_FRAME_INTERVAL_SECONDS: env.VIDEO_FRAME_INTERVAL_SECONDS,
      VIDEO_MAX_FRAMES: env.VIDEO_MAX_FRAMES,
      VIDEO_FFMPEG_PATH: env.VIDEO_FFMPEG_PATH,
      DOUYIN_VIDEO_COMMAND: env.DOUYIN_VIDEO_COMMAND,
      DOUYIN_VIDEO_COMMAND_ARGS: env.DOUYIN_VIDEO_COMMAND_ARGS,
      DOUYIN_VIDEO_COMMAND_TIMEOUT_MS: env.DOUYIN_VIDEO_COMMAND_TIMEOUT_MS,
    };
  });

export type ServerEnv = z.infer<typeof envSchema>;
type ServerEnvInput = Record<string, string | undefined>;

export function parseServerEnv(env: ServerEnvInput): ServerEnv {
  return envSchema.parse(env);
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
