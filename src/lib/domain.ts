export type KnowledgeItemType =
  | "text"
  | "markdown"
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "csv"
  | "html"
  | "image"
  | "video"
  | "audio";

export type KnowledgeItemStatus = "processing" | "ready" | "failed";
export type ChatRole = "user" | "assistant";
export type FeedbackRating = "helpful" | "not_helpful";
export type AnswerStyle = "concise" | "detailed";

export type JsonRecord = Record<string, unknown>;

export interface Citation {
  chunkId: string;
  itemId: string;
  itemTitle: string;
  chunkIndex: number;
  content: string;
  summary: string;
  similarity: number;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeItemType;
  fileName: string;
  fileType: string;
  status: KnowledgeItemStatus;
  chunkCount: number;
  metadata: JsonRecord;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatRole;
  content: string;
  sources: Citation[];
  createdAt: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunkText {
  chunkIndex: number;
  content: string;
}

export type {
  MaterialCard,
  MaterialType,
  ProjectSpace,
  ToolProfile,
} from "@/lib/assets/asset-types";
