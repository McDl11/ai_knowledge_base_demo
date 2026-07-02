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
  }),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-repository-provider-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("repository provider routing", () => {
  it("uses the local knowledge repository when configured", async () => {
    const {
      createProcessingKnowledgeItem,
      listKnowledgeItems,
      markKnowledgeItemReady,
      matchKnowledgeChunks,
      replaceKnowledgeChunks,
    } = await import("@/lib/db/knowledge-repository");

    const item = await createProcessingKnowledgeItem({
      title: "本地文档.md",
      type: "markdown",
      fileName: "本地文档.md",
      fileType: "text/markdown",
    });
    await replaceKnowledgeChunks({
      itemId: item.id,
      chunks: [
        {
          chunkIndex: 0,
          content: "本地数据库不会上传",
          embedding: [1, 0],
          tokenCount: 9,
        },
      ],
    });
    await markKnowledgeItemReady(item.id, 1);

    const items = await listKnowledgeItems();
    const matches = await matchKnowledgeChunks({
      embedding: [1, 0],
      threshold: 0.1,
      count: 1,
    });

    expect(items[0]?.title).toBe("本地文档.md");
    expect(matches[0]?.content).toBe("本地数据库不会上传");
  });

  it("uses the local chat repository when configured", async () => {
    const {
      createChatMessage,
      getOrCreateSession,
      listChatSessions,
      listMessagesBySession,
      listRecentMessages,
      saveFeedback,
    } = await import("@/lib/db/chat-repository");

    const session = await getOrCreateSession(null, "本地保存吗？");
    const assistant = await createChatMessage({
      sessionId: session.id,
      role: "assistant",
      content: "只保存在本地。",
    });
    await saveFeedback(assistant.id, "helpful");

    const messages = await listRecentMessages();
    const sessions = await listChatSessions();
    const selectedMessages = await listMessagesBySession(session.id);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("只保存在本地。");
    expect(sessions[0]?.title).toBe("本地保存吗？");
    expect(selectedMessages[0]?.content).toBe("只保存在本地。");
  });
});
