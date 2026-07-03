import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DATABASE_PROVIDER: "local",
    LOCAL_DB_PATH: dbPath,
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
  }),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-material-ingestion-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("material ingestion", () => {
  it("ingests an idea into the local knowledge store", async () => {
    const { ingestIdea } = await import("@/lib/knowledge/idea-ingestion");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestIdea({
      title: "AI 插件导航",
      content: "收集国产 AI 插件，并按用途整理成工具雷达。",
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("工具雷达"),
      query: "工具雷达",
      threshold: 0.1,
      count: 1,
    });

    expect(item).toMatchObject({
      title: "AI 插件导航",
      type: "text",
      status: "ready",
      metadata: expect.objectContaining({ materialType: "idea" }),
    });
    expect(matches[0]?.content).toContain("工具雷达");
  }, 15_000);

  it("ingests a link into the local knowledge store", async () => {
    const { ingestLink } = await import("@/lib/knowledge/link-parser");

    const item = await ingestLink({
      url: "https://example.com/tool",
      title: "Example Tool",
      content: "一个用于整理网页资料的工具。",
    });

    expect(item).toMatchObject({
      title: "Example Tool",
      fileName: "https://example.com/tool",
      fileType: "text/uri-list",
      metadata: expect.objectContaining({ materialType: "link" }),
    });
  });

  it("uses fetched web page text when saving a link without manual content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          "<html><head><title>网页工具</title></head><body><h1>DocPilot</h1><p>网页正文已抓取。</p></body></html>",
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
      ),
    );

    const { ingestLink } = await import("@/lib/knowledge/link-parser");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestLink({
      url: "https://example.com/page",
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("网页正文"),
      query: "网页正文",
      threshold: 0.1,
      count: 1,
    });

    expect(item).toMatchObject({
      title: "网页工具",
      metadata: expect.objectContaining({ fetched: true }),
    });
    expect(matches[0]?.content).toContain("网页正文已抓取");

    vi.unstubAllGlobals();
  });
});
