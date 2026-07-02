"use client";

import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";
import type { ChatMessage, Citation } from "@/lib/domain";
import {
  confirmableMaterialCategories,
  materialCategoryLabel,
  parseMaterialCategoryReply,
  type MaterialCategory,
} from "@/lib/knowledge/material-categories";
import { UniversalComposer } from "@/components/workbench/UniversalComposer";
import { cn } from "@/lib/utils";

export interface ClassificationReviewItem {
  id: string;
  title: string;
  summary: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  pendingClassificationItems: ClassificationReviewItem[];
  isLoadingMessages: boolean;
  hasReadyKnowledge: boolean;
  isViewingHistory: boolean;
  onSendQuestion: (question: string) => Promise<void>;
  onSaveIdea: (content: string) => Promise<void>;
  onSaveLink: (url: string, content?: string) => Promise<void>;
  onUploadFiles: (files: File[]) => Promise<void>;
  onFeedback: (
    messageId: string,
    rating: "helpful" | "not_helpful",
  ) => Promise<void>;
  onConfirmClassification: (
    itemId: string,
    category: MaterialCategory,
  ) => Promise<void>;
}

export function ChatPanel({
  messages,
  pendingClassificationItems,
  isLoadingMessages,
  hasReadyKnowledge,
  isViewingHistory,
  onSendQuestion,
  onSaveIdea,
  onSaveLink,
  onUploadFiles,
  onFeedback,
  onConfirmClassification,
}: ChatPanelProps) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(true);
  const [expandedSourceKey, setExpandedSourceKey] = useState<string | null>(null);

  async function ask(question: string) {
    if (isSending) {
      return;
    }

    const pendingItem = pendingClassificationItems[0];
    const confirmedCategory = pendingItem
      ? parseMaterialCategoryReply(question)
      : null;
    if (pendingItem && confirmedCategory) {
      await confirmClassification(pendingItem.id, confirmedCategory);
      return;
    }

    setIsSending(true);
    setError(null);
    setStatusMessage(null);
    try {
      await onSendQuestion(question);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "发送失败。");
    } finally {
      setIsSending(false);
    }
  }

  async function confirmClassification(
    itemId: string,
    category: MaterialCategory,
  ) {
    setError(null);
    setStatusMessage(null);
    try {
      await onConfirmClassification(itemId, category);
      setStatusMessage(`已归类为${materialCategoryLabel[category]}`);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "分类确认失败。",
      );
    }
  }

  async function saveIdea(content: string) {
    setError(null);
    setStatusMessage(null);
    try {
      await onSaveIdea(content);
      setStatusMessage("想法已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "想法保存失败。");
    }
  }

  async function saveLink(url: string, content?: string) {
    setError(null);
    setStatusMessage(null);
    try {
      await onSaveLink(url, content);
      setStatusMessage("链接已保存");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "链接保存失败。");
    }
  }

  async function uploadFiles(files: File[]) {
    setError(null);
    setStatusMessage(null);
    try {
      await onUploadFiles(files);
      setStatusMessage("文件已上传");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "文件上传失败。",
      );
    }
  }

  async function submitFeedback(
    messageId: string,
    rating: "helpful" | "not_helpful",
  ) {
    setStatusMessage(null);
    try {
      await onFeedback(messageId, rating);
      setStatusMessage("反馈已记录");
    } catch (feedbackError) {
      setStatusMessage(
        feedbackError instanceof Error
          ? feedbackError.message
          : "反馈提交失败。",
      );
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-slate-950">
      <div className="border-b border-cyan-400/10 bg-slate-900/80 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-50 text-balance">
              {isViewingHistory ? "正在查看历史对话" : "开始新的资料问答"}
            </h1>
            <p className="mt-1 text-sm text-slate-400 text-pretty">
              基于已保存资料回答问题，也可以从输入框保存想法、链接和文件。
            </p>
          </div>
          <label className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={showSources}
              onChange={(event) => setShowSources(event.target.checked)}
              className="size-4"
            />
            显示来源
          </label>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-5">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-6">
          {pendingClassificationItems.length > 0 ? (
            <ClassificationReviewCard
              item={pendingClassificationItems[0]}
              remainingCount={pendingClassificationItems.length - 1}
              onConfirm={(category) =>
                void confirmClassification(
                  pendingClassificationItems[0].id,
                  category,
                )
              }
            />
          ) : null}
          {isLoadingMessages ? (
            <p className="text-sm text-slate-400">正在加载问答历史</p>
          ) : messages.length === 0 ? (
            <div className="mx-auto mt-20 max-w-xl rounded-lg border border-cyan-400/10 bg-slate-900/70 p-8 text-center shadow-lg shadow-cyan-950/20">
              <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/15 text-cyan-100">
                <BookOpen className="size-6" aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-50 text-balance">
                准备好提问了吗？
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400 text-pretty">
                {hasReadyKnowledge
                  ? "输入问题开始问答，或把新想法和链接先保存进资料库。"
                  : "请先上传文件或保存一条想法，待状态变为可用后再提问。"}
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "rounded-lg px-4 py-3",
                  message.role === "user"
                    ? "ml-auto max-w-[78%] bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950/30"
                    : "max-w-[84%] border border-slate-700 bg-slate-900 text-slate-100 shadow-sm shadow-slate-950",
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {message.content}
                </p>
                {message.role === "assistant" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {showSources && message.sources.length > 0 ? (
                      <InlineSources
                        messageId={message.id}
                        sources={message.sources}
                        expandedSourceKey={expandedSourceKey}
                        onToggleSource={(key) =>
                          setExpandedSourceKey((current) =>
                            current === key ? null : key,
                          )
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void submitFeedback(message.id, "helpful")}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-cyan-200"
                    >
                      <ThumbsUp className="size-3.5" aria-hidden="true" />
                      有用
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitFeedback(message.id, "not_helpful")}
                      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-300"
                    >
                      <ThumbsDown className="size-3.5" aria-hidden="true" />
                      没用
                    </button>
                  </div>
                ) : null}
              </article>
            ))
          )}
          {isSending ? (
            <div className="max-w-[84%] rounded-lg border border-cyan-400/20 bg-slate-900 px-4 py-3 text-sm text-cyan-200 shadow-sm">
              正在生成回答
            </div>
          ) : null}
        </div>

        <div className="pb-5">
          {error ? <p className="mb-2 text-sm text-red-300">{error}</p> : null}
          {statusMessage ? (
            <p className="mb-2 text-sm text-cyan-200">{statusMessage}</p>
          ) : null}
          <UniversalComposer
            disabled={!hasReadyKnowledge}
            onAsk={ask}
            onSaveIdea={saveIdea}
            onSaveLink={saveLink}
            onUploadFiles={uploadFiles}
          />
        </div>
      </div>
    </section>
  );
}

function ClassificationReviewCard({
  item,
  remainingCount,
  onConfirm,
}: {
  item: ClassificationReviewItem;
  remainingCount: number;
  onConfirm: (category: MaterialCategory) => void;
}) {
  return (
    <article className="max-w-[84%] rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-slate-100 shadow-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-50">
            我不太确定这条资料应该归到哪一类。
          </p>
          <p className="mt-1 truncate text-sm text-slate-300">{item.title}</p>
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
              {item.summary}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {confirmableMaterialCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => onConfirm(category)}
                className="rounded-md border border-amber-300/30 bg-slate-950 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-300/10"
              >
                {materialCategoryLabel[category]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            也可以直接回复“这是工具”或“归到项目资料”。
            {remainingCount > 0 ? ` 还有 ${remainingCount} 条待确认。` : ""}
          </p>
        </div>
      </div>
    </article>
  );
}

function InlineSources({
  messageId,
  sources,
  expandedSourceKey,
  onToggleSource,
}: {
  messageId: string;
  sources: Citation[];
  expandedSourceKey: string | null;
  onToggleSource: (key: string) => void;
}) {
  const compactSources = sources.slice(0, 3);

  return (
    <div className="w-full rounded-md border border-cyan-400/10 bg-slate-950 px-3 py-2 text-xs text-slate-400">
      <p>
        来源：
        {compactSources.map((source, index) => {
          const key = `${messageId}:${source.chunkId}`;
          return (
            <span key={source.chunkId}>
              {index > 0 ? " · " : ""}
              <button
                type="button"
                onClick={() => onToggleSource(key)}
                className="inline-flex items-center gap-0.5 font-medium text-cyan-200 hover:text-cyan-100"
              >
                {source.itemTitle} #{source.chunkIndex + 1}
                {expandedSourceKey === key ? (
                  <ChevronUp className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronDown className="size-3" aria-hidden="true" />
                )}
              </button>
            </span>
          );
        })}
        {sources.length > compactSources.length
          ? ` 等 ${sources.length} 条`
          : ""}
      </p>
      {compactSources.map((source) => {
        const key = `${messageId}:${source.chunkId}`;
        if (expandedSourceKey !== key) {
          return null;
        }

        return (
          <p
            key={`${source.chunkId}:content`}
            className="mt-2 whitespace-pre-wrap rounded border border-slate-700 bg-slate-900 p-2 leading-5 text-slate-300"
          >
            {source.content}
          </p>
        );
      })}
    </div>
  );
}
