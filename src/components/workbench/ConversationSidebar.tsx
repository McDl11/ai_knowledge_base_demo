"use client";

import { Check, MessageCirclePlus, Pencil, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { ChatSessionSummary } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface ConversationSidebarProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  isLoading: boolean;
  onStartNewConversation: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

export function ConversationSidebar({
  sessions,
  activeSessionId,
  isLoading,
  onStartNewConversation,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: ConversationSidebarProps) {
  const safeSessions = sessions ?? [];
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startEditing(session: ChatSessionSummary) {
    setEditingSessionId(session.id);
    setTitleDraft(session.title);
    setError(null);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingSessionId || !titleDraft.trim()) {
      return;
    }

    setBusySessionId(editingSessionId);
    setError(null);
    try {
      await onRenameSession(editingSessionId, titleDraft.trim());
      setEditingSessionId(null);
      setTitleDraft("");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "重命名失败。");
    } finally {
      setBusySessionId(null);
    }
  }

  async function deleteSession(session: ChatSessionSummary) {
    const confirmed = window.confirm(`确定删除“${session.title}”吗？`);
    if (!confirmed) {
      return;
    }

    setBusySessionId(session.id);
    setError(null);
    try {
      await onDeleteSession(session.id);
      if (editingSessionId === session.id) {
        setEditingSessionId(null);
        setTitleDraft("");
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    } finally {
      setBusySessionId(null);
    }
  }

  return (
    <aside className="flex min-h-0 flex-col border-r border-cyan-400/10 bg-[#07111f] text-white">
      <div className="border-b border-white/5 px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-400/15 text-sm font-semibold text-cyan-100 shadow-sm shadow-cyan-950">
            文
          </div>
          <div>
            <p className="text-base font-semibold leading-tight text-balance">
              DocPilot
            </p>
            <p className="text-xs text-cyan-200/70">AI 知识中枢</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-4">
        <button
          type="button"
          onClick={onStartNewConversation}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700"
        >
          <MessageCirclePlus className="size-4" aria-hidden="true" />
          新对话
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="mb-2 px-2 text-xs font-medium text-slate-500">历史对话</p>
        {isLoading ? (
          <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
            正在加载历史
          </div>
        ) : safeSessions.length === 0 ? (
          <div className="rounded-md border border-dashed border-cyan-400/20 bg-cyan-400/5 p-3 text-sm text-slate-400">
            暂无历史对话，上传资料后开始第一次问答。
          </div>
        ) : (
          <div className="space-y-1">
            {error ? (
              <p className="rounded-md border border-red-900/60 bg-red-950/60 px-3 py-2 text-xs text-red-200">
                {error}
              </p>
            ) : null}
            {safeSessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isEditing = editingSessionId === session.id;
              const isBusy = busySessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group rounded-md border px-2 py-2",
                    isActive
                      ? "border-cyan-400/20 bg-cyan-400/10"
                      : "border-transparent hover:border-white/5 hover:bg-slate-950/50",
                  )}
                >
                  {isEditing ? (
                    <form onSubmit={submitRename} className="space-y-2">
                      <label className="sr-only" htmlFor={`session-title-${session.id}`}>
                        对话标题
                      </label>
                      <input
                        id={`session-title-${session.id}`}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        disabled={isBusy}
                        maxLength={80}
                        className="h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-cyan-400"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!titleDraft.trim() || isBusy}
                          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-cyan-500 px-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          保存
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingSessionId(null);
                            setTitleDraft("");
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-700 px-2 text-slate-300 hover:bg-slate-800 disabled:text-slate-600"
                          aria-label="取消重命名"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        aria-current={isActive ? "true" : undefined}
                        aria-label={`打开 ${session.title}`}
                        className="min-w-0 flex-1 rounded-md px-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-white">
                          {session.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {session.messageCount} 条消息
                        </span>
                      </button>
                      <div className="flex shrink-0 gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEditing(session)}
                          disabled={isBusy}
                          aria-label={`重命名 ${session.title}`}
                          title="重命名"
                          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-cyan-200 disabled:text-slate-700"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSession(session)}
                          disabled={isBusy}
                          aria-label={`删除 ${session.title}`}
                          title="删除"
                          className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-red-300 disabled:text-slate-700"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
