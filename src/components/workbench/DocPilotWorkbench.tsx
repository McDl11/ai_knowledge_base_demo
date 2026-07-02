"use client";

import Link from "next/link";
import { Files, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnswerStyle,
  ChatMessage,
  ChatSessionSummary,
  KnowledgeItem,
} from "@/lib/domain";
import { ChatPanel, type ClassificationReviewItem } from "@/components/workbench/ChatPanel";
import { ConversationSidebar } from "@/components/workbench/ConversationSidebar";
import { SettingsDialog } from "@/components/workbench/SettingsDialog";
import { UploadButton } from "@/components/workbench/UploadButton";
import type { MaterialCategory } from "@/lib/knowledge/material-categories";

export function DocPilotWorkbench() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [style, setStyle] = useState<AnswerStyle>("concise");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const readyItemCount = useMemo(
    () => items.filter((item) => item.status === "ready").length,
    [items],
  );
  const pendingClassificationItems = useMemo<ClassificationReviewItem[]>(
    () =>
      items
        .filter((item) => item.status === "ready" && item.metadata.needsReview === true)
        .map((item) => ({
          id: item.id,
          title: item.title,
          summary: typeof item.metadata.summary === "string" ? item.metadata.summary : "",
        })),
    [items],
  );

  const refreshItems = useCallback(async () => {
    const response = await fetch("/api/knowledge-items", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("知识源加载失败。");
    }
    const data = (await response.json()) as { items: KnowledgeItem[] };
    setItems(data.items);
  }, []);

  const refreshSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch("/api/chat", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("历史对话加载失败。");
      }
      const data = (await response.json()) as {
        sessions?: ChatSessionSummary[];
        messages: ChatMessage[];
      };
      setSessions(data.sessions ?? []);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [itemsResponse, chatResponse] = await Promise.all([
          fetch("/api/knowledge-items", { cache: "no-store" }),
          fetch("/api/chat", { cache: "no-store" }),
        ]);

        if (!itemsResponse.ok || !chatResponse.ok) {
          throw new Error("工作台数据加载失败。");
        }

        const itemsData = (await itemsResponse.json()) as { items: KnowledgeItem[] };
        const chatData = (await chatResponse.json()) as {
          sessions?: ChatSessionSummary[];
          messages: ChatMessage[];
        };

        if (!isMounted) {
          return;
        }

        setItems(itemsData.items);
        setSessions(chatData.sessions ?? []);
        setMessages([]);
        setSessionId(null);
        setIsViewingHistory(false);
      } finally {
        if (isMounted) {
          setIsLoadingSessions(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  async function selectSession(nextSessionId: string) {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/chat?sessionId=${nextSessionId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("历史对话加载失败。");
      }

      const data = (await response.json()) as { messages: ChatMessage[] };
      setSessionId(nextSessionId);
      setIsViewingHistory(true);
      setMessages(data.messages);
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function sendQuestion(question: string) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, sessionId, style }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "发送失败，请稍后再试。");
    }

    const data = (await response.json()) as {
      sessionId: string;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
    };

    setSessionId(data.sessionId);
    setMessages((current) => [
      ...current,
      data.userMessage,
      data.assistantMessage,
    ]);
    if (!sessionId) {
      setIsViewingHistory(false);
    }
    await refreshSessions();
  }

  async function saveIdea(content: string) {
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "idea",
        title: content.slice(0, 40),
        content,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "想法保存失败。");
    }

    await refreshItems();
  }

  async function saveLink(url: string, content?: string) {
    const response = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "link", url, content }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "链接保存失败。");
    }

    await refreshItems();
  }

  async function uploadFiles(files: File[]) {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/knowledge-items", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `${file.name} 上传失败。`);
      }
    }

    await refreshItems();
  }

  async function sendFeedback(messageId: string, rating: "helpful" | "not_helpful") {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });

    if (!response.ok) {
      throw new Error("反馈提交失败，请稍后再试。");
    }
  }

  async function renameSession(nextSessionId: string, title: string) {
    const response = await fetch(`/api/chat/${nextSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "对话重命名失败。");
    }

    await refreshSessions();
  }

  async function deleteSession(nextSessionId: string) {
    const response = await fetch(`/api/chat/${nextSessionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "对话删除失败。");
    }

    if (sessionId === nextSessionId) {
      startNewConversation();
    }
    await refreshSessions();
  }

  async function confirmClassification(
    itemId: string,
    category: MaterialCategory,
  ) {
    const response = await fetch(`/api/materials/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "分类确认失败。");
    }

    const data = (await response.json()) as { item: KnowledgeItem };
    setItems((current) =>
      current.map((item) => (item.id === data.item.id ? data.item : item)),
    );
  }

  function startNewConversation() {
    setSessionId(null);
    setIsViewingHistory(false);
    setMessages([]);
    setIsLoadingMessages(false);
  }

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-slate-950 text-slate-100 lg:h-dvh lg:grid-cols-[288px_minmax(0,1fr)]">
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={sessionId}
        isLoading={isLoadingSessions}
        onStartNewConversation={startNewConversation}
        onSelectSession={(nextSessionId) => void selectSession(nextSessionId)}
        onRenameSession={renameSession}
        onDeleteSession={deleteSession}
      />

      <div className="flex min-h-dvh flex-col lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/10 bg-slate-950/95 px-4 py-3 shadow-sm shadow-cyan-950/30">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 font-medium text-cyan-200">
              {readyItemCount} 条可检索资料
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1">
              {sessions.length} 个历史会话
            </span>
          </div>
          <div className="flex items-center gap-2">
            <UploadButton onUploaded={refreshItems} />
            <Link
              href="/library"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 hover:border-cyan-400/50 hover:bg-slate-800"
            >
              <Files className="size-4" aria-hidden="true" />
              资料库
            </Link>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 hover:border-cyan-400/50 hover:bg-slate-800"
            >
              <Settings className="size-4" aria-hidden="true" />
              设置
            </button>
          </div>
        </div>

        <ChatPanel
          messages={messages}
          pendingClassificationItems={pendingClassificationItems}
          isLoadingMessages={isLoadingMessages}
          hasReadyKnowledge={readyItemCount > 0}
          isViewingHistory={isViewingHistory}
          onSendQuestion={sendQuestion}
          onSaveIdea={saveIdea}
          onSaveLink={saveLink}
          onUploadFiles={uploadFiles}
          onFeedback={sendFeedback}
          onConfirmClassification={confirmClassification}
        />
      </div>

      <SettingsDialog
        isOpen={isSettingsOpen}
        style={style}
        onStyleChange={setStyle}
        onClose={() => setIsSettingsOpen(false)}
      />
    </main>
  );
}
