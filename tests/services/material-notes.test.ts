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
    RAG_AI_QUERY_PLANNING: true,
  }),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-material-notes-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("material notes", () => {
  it("updates a material user note", async () => {
    const { createProcessingKnowledgeItem } = await import(
      "@/lib/db/knowledge-repository"
    );
    const { updateMaterialUserNote } = await import(
      "@/lib/knowledge/material-notes"
    );

    const item = await createProcessingKnowledgeItem({
      title: "Pricing page",
      type: "text",
      fileName: "https://example.com/pricing",
      fileType: "text/uri-list",
      metadata: { materialType: "link" },
    });

    const updated = await updateMaterialUserNote(
      item.id,
      "重点看价格和套餐限制",
    );

    expect(updated.metadata).toMatchObject({
      userNote: "重点看价格和套餐限制",
    });
    expect(typeof updated.metadata.userNoteUpdatedAt).toBe("string");
  });

  it("adds an annotation for selected material text", async () => {
    const { createProcessingKnowledgeItem } = await import(
      "@/lib/db/knowledge-repository"
    );
    const { addMaterialAnnotation } = await import("@/lib/knowledge/material-notes");
    const { getMaterialAnnotations } = await import(
      "@/lib/knowledge/material-annotations"
    );

    const item = await createProcessingKnowledgeItem({
      title: "Feature page",
      type: "text",
      fileName: "https://example.com/features",
      fileType: "text/uri-list",
      metadata: { materialType: "link" },
    });

    const updated = await addMaterialAnnotation({
      itemId: item.id,
      quote: "AI workflow automation",
      note: "这是竞品核心功能",
    });

    expect(getMaterialAnnotations(updated.metadata)[0]).toMatchObject({
      quote: "AI workflow automation",
      note: "这是竞品核心功能",
    });
  });
});
