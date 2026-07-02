import type { AnswerStyle, ChatMessage, Citation, KnowledgeItem } from "@/lib/domain";
import { generateGroundedAnswer, type EvidenceMode } from "@/lib/ai/answers";
import { createEmbedding } from "@/lib/ai/embeddings";
import {
  createChatMessage,
  getOrCreateSession,
} from "@/lib/db/chat-repository";
import { listKnowledgeItems } from "@/lib/db/knowledge-repository";
import { getServerEnv } from "@/lib/env";
import {
  planRetrievalQuery,
  type RetrievalQueryPlan,
} from "@/lib/rag/query-planner";
import { searchRelevantChunks } from "@/lib/rag/retrieval";

interface RunChatTurnInput {
  question: string;
  sessionId?: string | null;
  style: AnswerStyle;
}

interface ChatSession {
  id: string;
  title: string;
}

export interface RunChatTurnDependencies {
  getOrCreateSession: (
    sessionId: string | null | undefined,
    firstQuestion: string,
  ) => Promise<ChatSession>;
  createChatMessage: (input: {
    sessionId: string;
    role: ChatMessage["role"];
    content: string;
    sources?: Citation[];
  }) => Promise<ChatMessage>;
  createEmbedding: (input: string) => Promise<number[]>;
  planRetrievalQuery: (question: string) => Promise<RetrievalQueryPlan>;
  searchRelevantChunks: (embedding: number[], question: string) => Promise<Citation[]>;
  listKnowledgeItems: () => Promise<KnowledgeItem[]>;
  generateGroundedAnswer: (input: {
    question: string;
    citations: Citation[];
    style: AnswerStyle;
    evidenceMode?: EvidenceMode;
    libraryContext?: string;
  }) => Promise<string>;
  matchThreshold: number;
}

export interface RunChatTurnResult {
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export function createDefaultChatDependencies(): RunChatTurnDependencies {
  const env = getServerEnv();

  return {
    getOrCreateSession,
    createChatMessage,
    createEmbedding,
    planRetrievalQuery,
    searchRelevantChunks,
    listKnowledgeItems,
    generateGroundedAnswer,
    matchThreshold: env.RAG_MATCH_THRESHOLD,
  };
}

export async function runChatTurn(
  input: RunChatTurnInput,
  dependencies: RunChatTurnDependencies = createDefaultChatDependencies(),
): Promise<RunChatTurnResult> {
  const session = await dependencies.getOrCreateSession(
    input.sessionId,
    input.question,
  );

  const userMessage = await dependencies.createChatMessage({
    sessionId: session.id,
    role: "user",
    content: input.question,
  });

  const queryPlan = await dependencies.planRetrievalQuery(input.question);
  const questionEmbedding = await dependencies.createEmbedding(queryPlan.searchQuery);
  const citations = await dependencies.searchRelevantChunks(
    questionEmbedding,
    queryPlan.searchQuery,
  );
  const evidenceMode = determineEvidenceMode(
    citations,
    dependencies.matchThreshold,
  );
  const libraryItems = await dependencies.listKnowledgeItems();
  const answer = await dependencies.generateGroundedAnswer({
    question: input.question,
    citations,
    style: input.style,
    evidenceMode,
    libraryContext: buildLibraryContext(libraryItems),
  });

  const assistantMessage = await dependencies.createChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: answer,
    sources: citations,
  });

  return {
    sessionId: session.id,
    userMessage,
    assistantMessage,
  };
}

export function determineEvidenceMode(
  citations: Pick<Citation, "similarity">[],
  threshold: number,
): EvidenceMode {
  if (citations.length === 0) {
    return "none";
  }

  if (citations.some((citation) => citation.similarity >= threshold)) {
    return "grounded";
  }

  return "weak";
}

export function buildLibraryContext(items: KnowledgeItem[]): string {
  if (items.length === 0) {
    return "资料库为空。";
  }

  const ready = items.filter((item) => item.status === "ready");
  const processing = items.filter((item) => item.status === "processing");
  const failed = items.filter((item) => item.status === "failed");
  const recent = items.slice(0, 8).map((item) => {
    const summary =
      typeof item.metadata.summary === "string" && item.metadata.summary.trim()
        ? `：${item.metadata.summary.trim()}`
        : "";
    const materialType =
      typeof item.metadata.materialType === "string"
        ? item.metadata.materialType
        : item.type;

    return `- ${item.title}（${materialType}，${item.status}）${summary}`;
  });

  return [
    `共有 ${items.length} 条资料，其中可检索 ${ready.length} 条，处理中 ${processing.length} 条，失败 ${failed.length} 条。`,
    recent.length > 0 ? `最近资料：\n${recent.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
