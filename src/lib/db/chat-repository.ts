import type { ChatMessage, ChatSessionSummary, FeedbackRating } from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/db/admin";
import {
  createLocalChatMessage,
  deleteLocalChatSession,
  getOrCreateLocalSession,
  listLocalChatSessions,
  listLocalMessagesBySession,
  listLocalRecentMessages,
  renameLocalChatSession,
  saveLocalFeedback,
} from "@/lib/db/local-store";
import { getServerEnv } from "@/lib/env";

interface ChatSession {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  role: ChatMessage["role"];
  content: string;
  sources_json: ChatMessage["sources"];
  created_at: string;
}

interface CreateChatMessageInput {
  sessionId: string;
  role: ChatMessage["role"];
  content: string;
  sources?: ChatMessage["sources"];
}

export async function getOrCreateSession(
  sessionId: string | null | undefined,
  firstQuestion: string,
): Promise<ChatSession> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return getOrCreateLocalSession(env.LOCAL_DB_PATH, sessionId, firstQuestion);
  }

  const supabase = createSupabaseAdminClient();

  if (sessionId) {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id,title")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (data) {
      return data as ChatSession;
    }
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ title: createSessionTitle(firstQuestion) })
    .select("id,title")
    .single();

  if (error) {
    throw error;
  }

  return data as ChatSession;
}

export async function createChatMessage(
  input: CreateChatMessageInput,
): Promise<ChatMessage> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return createLocalChatMessage(env.LOCAL_DB_PATH, input);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      session_id: input.sessionId,
      role: input.role,
      content: input.content,
      sources_json: input.sources ?? [],
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapChatMessageRow(data as ChatMessageRow);
}

export async function listRecentMessages(limit = 20): Promise<ChatMessage[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return listLocalRecentMessages(env.LOCAL_DB_PATH, limit);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ChatMessageRow[]).map(mapChatMessageRow);
}

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return listLocalChatSessions(env.LOCAL_DB_PATH);
  }

  const supabase = createSupabaseAdminClient();
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("chat_sessions")
    .select("id,title,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    throw sessionsError;
  }

  const sessions = (sessionsData ?? []) as Array<{
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }>;
  if (sessions.length === 0) {
    return [];
  }

  const { data: messagesData, error: messagesError } = await supabase
    .from("chat_messages")
    .select("session_id,created_at")
    .in(
      "session_id",
      sessions.map((session) => session.id),
    );

  if (messagesError) {
    throw messagesError;
  }

  const messageStats = new Map<string, { count: number; latest?: string }>();
  for (const row of (messagesData ?? []) as Array<{
    session_id: string;
    created_at: string;
  }>) {
    const current = messageStats.get(row.session_id) ?? { count: 0 };
    current.count += 1;
    current.latest =
      current.latest && current.latest > row.created_at
        ? current.latest
        : row.created_at;
    messageStats.set(row.session_id, current);
  }

  return sessions
    .map((session) => {
      const stats = messageStats.get(session.id);
      return {
        id: session.id,
        title: session.title,
        messageCount: stats?.count ?? 0,
        createdAt: session.created_at,
        updatedAt: stats?.latest ?? session.updated_at,
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function listMessagesBySession(
  sessionId: string,
): Promise<ChatMessage[]> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return listLocalMessagesBySession(env.LOCAL_DB_PATH, sessionId);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ChatMessageRow[]).map(mapChatMessageRow);
}

export async function renameChatSession(
  sessionId: string,
  title: string,
): Promise<ChatSessionSummary> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("对话标题不能为空。");
  }

  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return renameLocalChatSession(env.LOCAL_DB_PATH, sessionId, trimmedTitle);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .update({ title: trimmedTitle })
    .eq("id", sessionId)
    .select("id,title,created_at,updated_at")
    .single();

  if (error) {
    throw error;
  }

  const { count, error: countError } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (countError) {
    throw countError;
  }

  const session = data as {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };

  return {
    id: session.id,
    title: session.title,
    messageCount: count ?? 0,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return deleteLocalChatSession(env.LOCAL_DB_PATH, sessionId);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    throw error;
  }
}

export async function saveFeedback(
  messageId: string,
  rating: FeedbackRating,
): Promise<void> {
  const env = getServerEnv();
  if (env.DATABASE_PROVIDER === "local") {
    return saveLocalFeedback(env.LOCAL_DB_PATH, messageId, rating);
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("answer_feedback").upsert(
    {
      message_id: messageId,
      rating,
    },
    { onConflict: "message_id" },
  );

  if (error) {
    throw error;
  }
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

function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sources: (row.sources_json ?? []) as ChatMessage["sources"],
    createdAt: row.created_at,
  };
}
