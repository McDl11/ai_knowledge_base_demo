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
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    OPENAI_WIRE_API: "responses",
    OPENAI_DISABLE_RESPONSE_STORAGE: true,
    OPENAI_CHAT_MODEL: "gpt-4o-mini",
    OPENAI_REASONING_EFFORT: "medium",
    OPENAI_EMBEDDING_MODEL: "local-hash-embedding-v1",
    RAG_MATCH_THRESHOLD: 0.78,
    RAG_MATCH_COUNT: 5,
    RAG_AI_QUERY_PLANNING: true,
  }),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-classification-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("confirmMaterialCategory", () => {
  it("marks a material category as confirmed by the user", async () => {
    const { createProcessingKnowledgeItem } = await import(
      "@/lib/db/knowledge-repository"
    );
    const { confirmMaterialCategory } = await import(
      "@/lib/knowledge/classification-confirmation"
    );

    const item = await createProcessingKnowledgeItem({
      title: "Unclear note",
      type: "text",
      fileName: "manual:idea",
      fileType: "text/plain",
      metadata: {
        category: "unknown",
        needsReview: true,
        summary: "Unclear note",
      },
    });

    const updated = await confirmMaterialCategory({
      itemId: item.id,
      category: "tool",
    });

    expect(updated.metadata).toMatchObject({
      category: "tool",
      needsReview: false,
      classificationConfidence: 1,
      classificationReason: "confirmed by user",
      classificationSource: "user",
      summary: "Unclear note",
    });
    expect(typeof updated.metadata.classificationConfirmedAt).toBe("string");
  });
});
