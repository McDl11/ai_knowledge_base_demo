import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ChatMessage,
  ChatSessionSummary,
  Citation,
  FeedbackRating,
  JsonRecord,
  KnowledgeChunkText,
  KnowledgeItem,
  KnowledgeItemType,
} from "@/lib/domain";
import { formatCitationSummary } from "@/lib/rag/citations";

interface LocalChatSession {
  id: string;
  title: string;
  createdAt: string;
}

interface LocalKnowledgeChunk {
  id: string;
  itemId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  tokenCount: number;
  metadata: JsonRecord;
  createdAt: string;
}

interface LocalFeedback {
  messageId: string;
  rating: FeedbackRating;
  updatedAt: string;
}

interface LocalDatabase {
  knowledgeItems: KnowledgeItem[];
  knowledgeChunks: LocalKnowledgeChunk[];
  chatSessions: LocalChatSession[];
  chatMessages: ChatMessage[];
  feedback: LocalFeedback[];
}

interface CreateProcessingKnowledgeItemInput {
  title: string;
  type: KnowledgeItemType;
  fileName: string;
  fileType: string;
  metadata?: JsonRecord;
}

interface ReplaceKnowledgeChunksInput {
  itemId: string;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    embedding: number[];
    tokenCount: number;
    metadata?: JsonRecord;
  }>;
}

interface MatchKnowledgeChunksInput {
  embedding: number[];
  query?: string;
  threshold: number;
  count: number;
}

interface CreateChatMessageInput {
  sessionId: string;
  role: ChatMessage["role"];
  content: string;
  sources?: Citation[];
}

export async function listLocalKnowledgeItems(
  dbPath: string,
): Promise<KnowledgeItem[]> {
  const database = await readLocalDatabase(dbPath);
  return [...database.knowledgeItems].sort(compareNewestFirst);
}

export async function getLocalKnowledgeItem(
  dbPath: string,
  itemId: string,
): Promise<KnowledgeItem | null> {
  const database = await readLocalDatabase(dbPath);
  return database.knowledgeItems.find((item) => item.id === itemId) ?? null;
}

export async function createLocalProcessingKnowledgeItem(
  dbPath: string,
  input: CreateProcessingKnowledgeItemInput,
): Promise<KnowledgeItem> {
  return updateLocalDatabase(dbPath, (database) => {
    const now = new Date().toISOString();
    const item: KnowledgeItem = {
      id: randomUUID(),
      title: input.title,
      type: input.type,
      fileName: input.fileName,
      fileType: input.fileType,
      status: "processing",
      chunkCount: 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    database.knowledgeItems.push(item);
    return item;
  });
}

export async function replaceLocalKnowledgeChunks(
  dbPath: string,
  input: ReplaceKnowledgeChunksInput,
): Promise<void> {
  await updateLocalDatabase(dbPath, (database) => {
    database.knowledgeChunks = database.knowledgeChunks.filter(
      (chunk) => chunk.itemId !== input.itemId,
    );

    const now = new Date().toISOString();
    database.knowledgeChunks.push(
      ...input.chunks.map((chunk) => ({
        id: randomUUID(),
        itemId: input.itemId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: chunk.embedding,
        tokenCount: chunk.tokenCount,
        metadata: chunk.metadata ?? {},
        createdAt: now,
      })),
    );
  });
}

export async function markLocalKnowledgeItemReady(
  dbPath: string,
  itemId: string,
  chunkCount: number,
  metadata?: JsonRecord,
): Promise<KnowledgeItem> {
  return updateLocalKnowledgeItem(dbPath, itemId, (item) => ({
    ...item,
    status: "ready",
    chunkCount,
    metadata: metadata ?? item.metadata,
    updatedAt: new Date().toISOString(),
  }));
}

export async function markLocalKnowledgeItemFailed(
  dbPath: string,
  itemId: string,
  reason: string,
  metadata?: JsonRecord,
): Promise<KnowledgeItem> {
  return updateLocalKnowledgeItem(dbPath, itemId, (item) => ({
    ...item,
    status: "failed",
    metadata: metadata ?? {
      ...item.metadata,
      failureReason: reason.slice(0, 500),
    },
    updatedAt: new Date().toISOString(),
  }));
}

export async function updateLocalKnowledgeItemStatus(
  dbPath: string,
  input: {
    itemId: string;
    status: KnowledgeItem["status"];
    chunkCount?: number;
    metadata?: JsonRecord;
  },
): Promise<KnowledgeItem> {
  return updateLocalKnowledgeItem(dbPath, input.itemId, (item) => ({
    ...item,
    status: input.status,
    chunkCount: input.chunkCount ?? item.chunkCount,
    metadata: input.metadata ?? item.metadata,
    updatedAt: new Date().toISOString(),
  }));
}

export async function updateLocalKnowledgeItemMetadata(
  dbPath: string,
  itemId: string,
  metadata: JsonRecord,
): Promise<KnowledgeItem> {
  return updateLocalKnowledgeItem(dbPath, itemId, (item) => ({
    ...item,
    metadata,
    updatedAt: new Date().toISOString(),
  }));
}

export async function deleteLocalKnowledgeItem(
  dbPath: string,
  itemId: string,
): Promise<void> {
  await updateLocalDatabase(dbPath, (database) => {
    database.knowledgeItems = database.knowledgeItems.filter(
      (item) => item.id !== itemId,
    );
    database.knowledgeChunks = database.knowledgeChunks.filter(
      (chunk) => chunk.itemId !== itemId,
    );
  });
}

export async function listLocalKnowledgeChunksByItem(
  dbPath: string,
  itemId: string,
): Promise<KnowledgeChunkText[]> {
  const database = await readLocalDatabase(dbPath);
  return database.knowledgeChunks
    .filter((chunk) => chunk.itemId === itemId)
    .sort((left, right) => left.chunkIndex - right.chunkIndex)
    .map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
    }));
}

export async function matchLocalKnowledgeChunks(
  dbPath: string,
  input: MatchKnowledgeChunksInput,
): Promise<Citation[]> {
  const database = await readLocalDatabase(dbPath);
  const itemById = new Map(
    database.knowledgeItems
      .filter((item) => item.status === "ready")
      .map((item) => [item.id, item]),
  );

  return database.knowledgeChunks
    .map((chunk) => {
      const item = itemById.get(chunk.itemId);
      if (!item) {
        return null;
      }

      const keywordScore = calculateKeywordScore(input.query, chunk.content);
      return {
        chunk,
        item,
        similarity: cosineSimilarity(input.embedding, chunk.embedding),
        keywordScore,
      };
    })
    .filter((match): match is NonNullable<typeof match> => Boolean(match))
    .map((match) => ({
      ...match,
      score: Math.max(match.similarity, match.keywordScore),
    }))
    .filter((match) => match.score >= input.threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, input.count)
    .map(({ chunk, item, score }) => ({
      chunkId: chunk.id,
      itemId: item.id,
      itemTitle: item.title,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      summary: formatCitationSummary(chunk.content),
      similarity: score,
    }));
}

export async function getOrCreateLocalSession(
  dbPath: string,
  sessionId: string | null | undefined,
  firstQuestion: string,
): Promise<LocalChatSession> {
  return updateLocalDatabase(dbPath, (database) => {
    const existing = sessionId
      ? database.chatSessions.find((session) => session.id === sessionId)
      : undefined;
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const session: LocalChatSession = {
      id: randomUUID(),
      title: createSessionTitle(firstQuestion),
      createdAt: now,
    };

    database.chatSessions.push(session);
    return session;
  });
}

export async function createLocalChatMessage(
  dbPath: string,
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  return updateLocalDatabase(dbPath, (database) => {
    const message: ChatMessage = {
      id: randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      sources: input.sources ?? [],
      createdAt: new Date().toISOString(),
    };

    database.chatMessages.push(message);
    return message;
  });
}

export async function listLocalRecentMessages(
  dbPath: string,
  limit = 20,
): Promise<ChatMessage[]> {
  const database = await readLocalDatabase(dbPath);
  return [...database.chatMessages]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-limit);
}

export async function listLocalChatSessions(
  dbPath: string,
): Promise<ChatSessionSummary[]> {
  const database = await readLocalDatabase(dbPath);

  return database.chatSessions
    .map((session) => {
      const messages = database.chatMessages.filter(
        (message) => message.sessionId === session.id,
      );
      const latestMessage = messages
        .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
        .at(0);

      return {
        id: session.id,
        title: session.title,
        messageCount: messages.length,
        createdAt: session.createdAt,
        updatedAt: latestMessage?.createdAt ?? session.createdAt,
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listLocalMessagesBySession(
  dbPath: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const database = await readLocalDatabase(dbPath);

  return database.chatMessages
    .filter((message) => message.sessionId === sessionId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function renameLocalChatSession(
  dbPath: string,
  sessionId: string,
  title: string,
): Promise<ChatSessionSummary> {
  return updateLocalDatabase(dbPath, (database) => {
    const session = database.chatSessions.find((item) => item.id === sessionId);
    if (!session) {
      throw new Error(`Chat session not found: ${sessionId}`);
    }

    session.title = title.trim();
    const messages = database.chatMessages.filter(
      (message) => message.sessionId === sessionId,
    );
    const latestMessage = messages
      .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      .at(0);

    return {
      id: session.id,
      title: session.title,
      messageCount: messages.length,
      createdAt: session.createdAt,
      updatedAt: latestMessage?.createdAt ?? session.createdAt,
    };
  });
}

export async function deleteLocalChatSession(
  dbPath: string,
  sessionId: string,
): Promise<void> {
  await updateLocalDatabase(dbPath, (database) => {
    database.chatSessions = database.chatSessions.filter(
      (session) => session.id !== sessionId,
    );
    database.chatMessages = database.chatMessages.filter(
      (message) => message.sessionId !== sessionId,
    );
    database.feedback = database.feedback.filter((feedback) =>
      database.chatMessages.some((message) => message.id === feedback.messageId),
    );
  });
}

export async function saveLocalFeedback(
  dbPath: string,
  messageId: string,
  rating: FeedbackRating,
): Promise<void> {
  await updateLocalDatabase(dbPath, (database) => {
    const existing = database.feedback.find(
      (feedback) => feedback.messageId === messageId,
    );
    if (existing) {
      existing.rating = rating;
      existing.updatedAt = new Date().toISOString();
      return;
    }

    database.feedback.push({
      messageId,
      rating,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function readLocalDatabase(dbPath: string): Promise<LocalDatabase> {
  try {
    const raw = await readFile(dbPath, "utf8");
    return { ...createEmptyDatabase(), ...JSON.parse(raw) };
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyDatabase();
    }

    throw error;
  }
}

async function writeLocalDatabase(
  dbPath: string,
  database: LocalDatabase,
): Promise<void> {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(database, null, 2)}\n`, "utf8");
}

async function updateLocalDatabase<T>(
  dbPath: string,
  updater: (database: LocalDatabase) => T,
): Promise<T> {
  const database = await readLocalDatabase(dbPath);
  const result = updater(database);
  await writeLocalDatabase(dbPath, database);
  return result;
}

async function updateLocalKnowledgeItem(
  dbPath: string,
  itemId: string,
  updater: (item: KnowledgeItem) => KnowledgeItem,
): Promise<KnowledgeItem> {
  return updateLocalDatabase(dbPath, (database) => {
    const index = database.knowledgeItems.findIndex((item) => item.id === itemId);
    if (index === -1) {
      throw new Error(`Knowledge item not found: ${itemId}`);
    }

    const updated = updater(database.knowledgeItems[index]);
    database.knowledgeItems[index] = updated;
    return updated;
  });
}

function createEmptyDatabase(): LocalDatabase {
  return {
    knowledgeItems: [],
    knowledgeChunks: [],
    chatSessions: [],
    chatMessages: [],
    feedback: [],
  };
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function calculateKeywordScore(query: string | undefined, content: string): number {
  const queryTerms = collectSearchTerms(query ?? "");
  if (queryTerms.length === 0) {
    return 0;
  }

  const normalizedContent = normalizeSearchText(content);
  let hits = 0;
  for (const term of queryTerms) {
    if (normalizedContent.includes(term)) {
      hits += 1;
    }
  }

  if (hits === 0) {
    return 0;
  }

  return Math.min(1, 0.72 + hits / queryTerms.length);
}

function collectSearchTerms(text: string): string[] {
  const normalized = normalizeSearchText(text);
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = new Set<string>();

  for (const word of words) {
    if (word.length >= 2 && !isStopWord(word)) {
      terms.add(word);
    }

    for (const phrase of domainPhrases) {
      if (word.includes(phrase)) {
        terms.add(phrase);
      }
    }
  }

  return [...terms];
}

function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}

function isStopWord(word: string): boolean {
  return localSearchStopWords.has(word);
}

const domainPhrases = [
  "退款",
  "退货",
  "换货",
  "售后",
  "发票",
  "价格",
  "产品",
  "项目",
  "特点",
];

const localSearchStopWords = new Set([
  "这个",
  "那个",
  "请问",
  "是否",
  "支持",
  "可以",
  "什么",
  "怎么",
  "如何",
  "吗",
]);

function compareNewestFirst(left: KnowledgeItem, right: KnowledgeItem): number {
  return right.createdAt.localeCompare(left.createdAt);
}

function createSessionTitle(question: string): string {
  const trimmed = question.trim();
  if (containsChinese(trimmed)) {
    return truncateByCodePoints(trimmed, 20);
  }

  return truncateByCodePoints(trimmed, 40);
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function truncateByCodePoints(text: string, maxLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxLength) {
    return text;
  }

  return `${characters.slice(0, maxLength).join("")}...`;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
