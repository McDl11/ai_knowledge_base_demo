import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLocalChatMessage,
  createLocalProcessingKnowledgeItem,
  getOrCreateLocalSession,
  listLocalChatSessions,
  listLocalKnowledgeChunksByItem,
  listLocalKnowledgeItems,
  listLocalMessagesBySession,
  listLocalRecentMessages,
  markLocalKnowledgeItemReady,
  matchLocalKnowledgeChunks,
  replaceLocalKnowledgeChunks,
  saveLocalFeedback,
  renameLocalChatSession,
  deleteLocalChatSession,
  updateLocalKnowledgeItemMetadata,
} from "@/lib/db/local-store";

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-local-store-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("local store", () => {
  it("stores knowledge items and returns chunks by item", async () => {
    const item = await createLocalProcessingKnowledgeItem(dbPath, {
      title: "Refund FAQ.md",
      type: "markdown",
      fileName: "Refund FAQ.md",
      fileType: "text/markdown",
    });

    await replaceLocalKnowledgeChunks(dbPath, {
      itemId: item.id,
      chunks: [
        {
          chunkIndex: 0,
          content: "Refunds are available within 7 days.",
          tokenCount: 7,
          embedding: [1, 0],
        },
        {
          chunkIndex: 1,
          content: "Invoices are sent by email.",
          tokenCount: 6,
          embedding: [0, 1],
        },
      ],
    });
    await markLocalKnowledgeItemReady(dbPath, item.id, 2);

    const items = await listLocalKnowledgeItems(dbPath);
    const chunks = await listLocalKnowledgeChunksByItem(dbPath, item.id);
    const matches = await matchLocalKnowledgeChunks(dbPath, {
      embedding: [1, 0],
      threshold: 0.5,
      count: 1,
    });

    expect(items).toHaveLength(1);
    expect(chunks.map((chunk) => chunk.content)).toEqual([
      "Refunds are available within 7 days.",
      "Invoices are sent by email.",
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.content).toBe("Refunds are available within 7 days.");
    expect(matches[0]?.itemTitle).toBe("Refund FAQ.md");
  });

  it("matches chunks by query keywords when local embeddings are weak", async () => {
    const item = await createLocalProcessingKnowledgeItem(dbPath, {
      title: "Product FAQ.md",
      type: "markdown",
      fileName: "Product FAQ.md",
      fileType: "text/markdown",
    });

    await replaceLocalKnowledgeChunks(dbPath, {
      itemId: item.id,
      chunks: [
        {
          chunkIndex: 0,
          content: "The product supports refunds within 7 days.",
          tokenCount: 8,
          embedding: [0, 1],
        },
      ],
    });
    await markLocalKnowledgeItemReady(dbPath, item.id, 1);

    const matches = await matchLocalKnowledgeChunks(dbPath, {
      embedding: [1, 0],
      query: "refund policy",
      threshold: 0.78,
      count: 1,
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.content).toContain("refunds");
  });

  it("updates knowledge item metadata locally", async () => {
    const item = await createLocalProcessingKnowledgeItem(dbPath, {
      title: "Unclear note",
      type: "text",
      fileName: "manual:idea",
      fileType: "text/plain",
      metadata: { category: "unknown", needsReview: true },
    });

    const updated = await updateLocalKnowledgeItemMetadata(dbPath, item.id, {
      ...item.metadata,
      category: "tool",
      needsReview: false,
    });

    expect(updated.metadata).toMatchObject({
      category: "tool",
      needsReview: false,
    });
  });

  it("stores chat messages and feedback locally", async () => {
    const session = await getOrCreateLocalSession(dbPath, null, "How to refund?");
    const userMessage = await createLocalChatMessage(dbPath, {
      sessionId: session.id,
      role: "user",
      content: "How to refund?",
    });
    const assistantMessage = await createLocalChatMessage(dbPath, {
      sessionId: session.id,
      role: "assistant",
      content: "Refunds are available within 7 days.",
      sources: [],
    });

    await saveLocalFeedback(dbPath, assistantMessage.id, "helpful");

    const messages = await listLocalRecentMessages(dbPath);
    const sameSession = await getOrCreateLocalSession(
      dbPath,
      session.id,
      "Another question",
    );

    expect(userMessage.sessionId).toBe(session.id);
    expect(messages.map((message) => message.content)).toEqual([
      "How to refund?",
      "Refunds are available within 7 days.",
    ]);
    expect(sameSession.id).toBe(session.id);
  });

  it("lists chat sessions by latest activity and loads a selected session", async () => {
    const olderSession = await getOrCreateLocalSession(dbPath, null, "Old question");
    await createLocalChatMessage(dbPath, {
      sessionId: olderSession.id,
      role: "user",
      content: "Old question",
    });

    const newerSession = await getOrCreateLocalSession(
      dbPath,
      null,
      "New refund question",
    );
    await createLocalChatMessage(dbPath, {
      sessionId: newerSession.id,
      role: "user",
      content: "New refund question",
    });
    await createLocalChatMessage(dbPath, {
      sessionId: newerSession.id,
      role: "assistant",
      content: "Refunds are available within 7 days.",
    });

    const sessions = await listLocalChatSessions(dbPath);
    const messages = await listLocalMessagesBySession(dbPath, newerSession.id);

    expect(sessions.map((session) => session.id)).toEqual([
      newerSession.id,
      olderSession.id,
    ]);
    expect(sessions[0]).toMatchObject({
      id: newerSession.id,
      title: "New refund question",
      messageCount: 2,
    });
    expect(messages.map((message) => message.content)).toEqual([
      "New refund question",
      "Refunds are available within 7 days.",
    ]);
  });

  it("renames a chat session without changing its messages", async () => {
    const session = await getOrCreateLocalSession(dbPath, null, "Original title");
    await createLocalChatMessage(dbPath, {
      sessionId: session.id,
      role: "user",
      content: "Original title",
    });

    const renamed = await renameLocalChatSession(dbPath, session.id, "复盘资料整理");
    const sessions = await listLocalChatSessions(dbPath);
    const messages = await listLocalMessagesBySession(dbPath, session.id);

    expect(renamed.title).toBe("复盘资料整理");
    expect(sessions[0]).toMatchObject({
      id: session.id,
      title: "复盘资料整理",
      messageCount: 1,
    });
    expect(messages.map((message) => message.content)).toEqual(["Original title"]);
  });

  it("deletes a chat session and its messages", async () => {
    const deletedSession = await getOrCreateLocalSession(
      dbPath,
      null,
      "Delete this session",
    );
    await createLocalChatMessage(dbPath, {
      sessionId: deletedSession.id,
      role: "user",
      content: "Delete this session",
    });
    const keptSession = await getOrCreateLocalSession(dbPath, null, "Keep this session");
    await createLocalChatMessage(dbPath, {
      sessionId: keptSession.id,
      role: "user",
      content: "Keep this session",
    });

    await deleteLocalChatSession(dbPath, deletedSession.id);

    const sessions = await listLocalChatSessions(dbPath);
    const deletedMessages = await listLocalMessagesBySession(
      dbPath,
      deletedSession.id,
    );

    expect(sessions.map((session) => session.id)).toEqual([keptSession.id]);
    expect(deletedMessages).toEqual([]);
  });
});
