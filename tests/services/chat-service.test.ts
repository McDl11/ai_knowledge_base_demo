import { describe, expect, it, vi } from "vitest";
import {
  buildLibraryContext,
  determineEvidenceMode,
  runChatTurn,
} from "@/lib/chat/chat-service";
import type { KnowledgeItem } from "@/lib/domain";

describe("runChatTurn", () => {
  it("lets the answer model respond helpfully when there are no direct citations", async () => {
    const createChatMessage = vi
      .fn()
      .mockResolvedValueOnce({
        id: "user-message",
        sessionId: "session-id",
        role: "user",
        content: "我现在该怎么优化这个项目？",
        sources: [],
        createdAt: "2026-06-29T00:00:00Z",
      })
      .mockResolvedValueOnce({
        id: "assistant-message",
        sessionId: "session-id",
        role: "assistant",
        content: "资料库里没有直接依据，但可以先从上传、检索、生成三个流程排查。",
        sources: [],
        createdAt: "2026-06-29T00:00:01Z",
      });
    const createEmbedding = vi.fn().mockResolvedValue([0.1, 0.2]);
    const searchRelevantChunks = vi.fn().mockResolvedValue([]);
    const generateGroundedAnswer = vi
      .fn()
      .mockResolvedValue("资料库里没有直接依据，但可以先从上传、检索、生成三个流程排查。");

    const result = await runChatTurn(
      {
        question: "我现在该怎么优化这个项目？",
        sessionId: null,
        style: "concise",
      },
      {
        getOrCreateSession: vi.fn().mockResolvedValue({
          id: "session-id",
          title: "我现在该怎么优化这个项目？",
        }),
        createChatMessage,
        createEmbedding,
        planRetrievalQuery: vi.fn().mockResolvedValue({
          originalQuestion: "我现在该怎么优化这个项目？",
          searchQuery: "项目 优化 上传 检索 生成",
          keywords: ["项目", "优化"],
          usedAi: true,
          reason: "test",
        }),
        searchRelevantChunks,
        listKnowledgeItems: vi.fn().mockResolvedValue([
          createKnowledgeItem({
            title: "DocPilot 开发路线图",
            status: "ready",
            summary: "上传、检索、素材生成是当前核心流程。",
          }),
        ]),
        generateGroundedAnswer,
        matchThreshold: 0.78,
      },
    );

    expect(result.assistantMessage.content).toContain("资料库里没有直接依据");
    expect(createEmbedding).toHaveBeenCalledWith("项目 优化 上传 检索 生成");
    expect(searchRelevantChunks).toHaveBeenCalledWith(
      [0.1, 0.2],
      "项目 优化 上传 检索 生成",
    );
    expect(generateGroundedAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "我现在该怎么优化这个项目？",
        citations: [],
        style: "concise",
        evidenceMode: "none",
        libraryContext: expect.stringContaining("共有 1 条资料"),
      }),
    );
  });

  it("marks weak citations separately from strongly grounded citations", () => {
    expect(determineEvidenceMode([], 0.78)).toBe("none");
    expect(determineEvidenceMode([{ similarity: 0.4 }], 0.78)).toBe("weak");
    expect(determineEvidenceMode([{ similarity: 0.82 }], 0.78)).toBe(
      "grounded",
    );
  });

  it("summarizes library status for answer context", () => {
    const context = buildLibraryContext([
      createKnowledgeItem({
        title: "已完成资料",
        status: "ready",
        summary: "这是可检索资料。",
      }),
      createKnowledgeItem({
        title: "处理中视频",
        status: "processing",
        materialType: "video_link",
      }),
      createKnowledgeItem({
        title: "失败链接",
        status: "failed",
      }),
    ]);

    expect(context).toContain("共有 3 条资料");
    expect(context).toContain("可检索 1 条");
    expect(context).toContain("处理中 1 条");
    expect(context).toContain("失败 1 条");
    expect(context).toContain("处理中视频");
  });
});

function createKnowledgeItem(input: {
  title: string;
  status: KnowledgeItem["status"];
  summary?: string;
  materialType?: string;
}): KnowledgeItem {
  return {
    id: input.title,
    title: input.title,
    type: "text",
    fileName: input.title,
    fileType: "text/plain",
    status: input.status,
    chunkCount: input.status === "ready" ? 1 : 0,
    metadata: {
      materialType: input.materialType ?? "document",
      summary: input.summary,
    },
    createdAt: "2026-06-29T00:00:00Z",
    updatedAt: "2026-06-29T00:00:00Z",
  };
}
