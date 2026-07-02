"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { KnowledgeChunkText, KnowledgeItem } from "@/lib/domain";
import { downloadTextFile } from "@/lib/browser/download";
import {
  exportMaterial,
  type MaterialExportStyle,
} from "@/lib/knowledge/material-export";
import {
  getMaterialCategoryLabel,
  getMaterialKind,
  getMaterialKindLabel,
  getMaterialSummary,
  getMaterialTags,
  getMaterialUserNote,
  getVideoProcessingInfo,
  getVideoStageLabel,
  getVideoStatusLabel,
  isVideoMaterial,
  needsMaterialReview,
  splitVideoContent,
  type VideoContentSection,
  type VideoProcessingInfo,
} from "@/lib/knowledge/material-view";
import {
  getMaterialAnnotations,
  type MaterialAnnotation,
} from "@/lib/knowledge/material-annotations";
import { MaterialGeneratePanel } from "@/components/workbench/MaterialGeneratePanel";
import { cn } from "@/lib/utils";

const filterOptions = [
  { value: "all", label: "全部" },
  { value: "idea", label: "想法" },
  { value: "link", label: "链接" },
  { value: "video_link", label: "视频链接" },
  { value: "image", label: "图片" },
  { value: "document", label: "文件" },
] as const;

type FilterValue = (typeof filterOptions)[number]["value"];

interface MaterialDetail {
  chunks: KnowledgeChunkText[];
  content: string;
}

export function LibraryPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MaterialDetail | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [exportStyle, setExportStyle] =
    useState<MaterialExportStyle>("markdown");
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [userNoteDraft, setUserNoteDraft] = useState("");
  const [selectedQuote, setSelectedQuote] = useState("");
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isRetryingVideo, setIsRetryingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const selectedVideoInfo = selectedItem
    ? getVideoProcessingInfo(selectedItem)
    : null;
  const selectedVideoSections =
    selectedItem && isVideoMaterial(selectedItem)
      ? splitVideoContent(detail?.content ?? "")
      : [];
  const annotations = selectedItem
    ? getMaterialAnnotations(selectedItem.metadata)
    : [];
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const normalizedQuery = query.trim().toLowerCase();
        const matchesQuery =
          !normalizedQuery ||
          [item.title, item.fileName, getMaterialSummary(item), ...getMaterialTags(item)]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        const matchesKind =
          filter === "all" ||
          (filter === "document"
            ? getMaterialKind(item) === "document"
            : getMaterialKind(item) === filter);

        return matchesQuery && matchesKind;
      }),
    [filter, items, query],
  );

  const refreshItems = useCallback(async () => {
    const response = await fetch("/api/knowledge-items", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("资料库刷新失败。");
    }

    const data = (await response.json()) as { items: KnowledgeItem[] };
    setItems(data.items);
    setSelectedId((current) => {
      const nextId = current ?? data.items[0]?.id ?? null;
      const nextItem = data.items.find((item) => item.id === nextId);
      setUserNoteDraft(nextItem ? getMaterialUserNote(nextItem) : "");
      return nextItem ? nextId : data.items[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadItems() {
      setIsLoadingItems(true);
      setError(null);
      try {
        const response = await fetch("/api/knowledge-items", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("资料库加载失败。");
        }
        const data = (await response.json()) as { items: KnowledgeItem[] };
        if (!isMounted) {
          return;
        }
        setItems(data.items);
        setSelectedId((current) => {
          const nextId = current ?? data.items[0]?.id ?? null;
          const nextItem = data.items.find((item) => item.id === nextId);
          setUserNoteDraft(nextItem ? getMaterialUserNote(nextItem) : "");
          return nextId;
        });
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "资料库加载失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadItems();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.status === "processing")) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshItems().catch((refreshError) => {
        setError(
          refreshError instanceof Error ? refreshError.message : "资料库刷新失败。",
        );
      });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [items, refreshItems]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let isMounted = true;

    async function loadDetail() {
      setIsLoadingDetail(true);
      setError(null);
      try {
        const response = await fetch(`/api/materials/${selectedId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("资料内容加载失败。");
        }
        const data = (await response.json()) as MaterialDetail;
        if (isMounted) {
          setDetail(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : "资料内容加载失败。",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedId, selectedItem?.updatedAt]);

  async function deleteSelectedItem() {
    if (!selectedItem) {
      return;
    }

    const response = await fetch(`/api/knowledge-items/${selectedItem.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("删除失败，请稍后再试。");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== selectedItem.id));
    setSelectedId((current) => {
      if (current !== selectedItem.id) {
        return current;
      }
      return filteredItems.find((item) => item.id !== selectedItem.id)?.id ?? null;
    });
    setDetail(null);
  }

  async function saveUserNote() {
    if (!selectedItem) {
      return;
    }

    setIsSavingNote(true);
    setError(null);
    try {
      const updated = await patchMaterial(selectedItem.id, {
        userNote: userNoteDraft,
      });
      replaceItem(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "处理说明保存失败。");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function saveAnnotation() {
    if (!selectedItem) {
      return;
    }

    setIsSavingNote(true);
    setError(null);
    try {
      const updated = await patchMaterial(selectedItem.id, {
        annotation: {
          quote: selectedQuote,
          note: annotationDraft,
        },
      });
      replaceItem(updated);
      setSelectedQuote("");
      setAnnotationDraft("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "片段注释保存失败。");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function retrySelectedVideo() {
    if (!selectedItem) {
      return;
    }

    setIsRetryingVideo(true);
    setError(null);
    try {
      const updated = await patchMaterial(selectedItem.id, {
        action: "retryVideoProcessing",
      });
      replaceItem(updated);
      setDetail(null);
    } catch (retryError) {
      setError(
        retryError instanceof Error ? retryError.message : "视频处理重试失败。",
      );
    } finally {
      setIsRetryingVideo(false);
    }
  }

  function selectItem(item: KnowledgeItem) {
    setSelectedId(item.id);
    setDetail(null);
    setSelectedQuote("");
    setAnnotationDraft("");
    setUserNoteDraft(getMaterialUserNote(item));
  }

  function captureSelectedText() {
    const selection = window.getSelection()?.toString().trim() ?? "";
    if (selection) {
      setSelectedQuote(selection.slice(0, 500));
    }
  }

  function replaceItem(updated: KnowledgeItem) {
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  async function patchMaterial(
    itemId: string,
    payload: Record<string, unknown>,
  ): Promise<KnowledgeItem> {
    const response = await fetch(`/api/materials/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(data?.error ?? "资料更新失败。");
    }

    const data = (await response.json()) as { item: KnowledgeItem };
    return data.item;
  }

  function exportSelectedItem() {
    if (!selectedItem) {
      return;
    }

    const exported = exportMaterial(
      selectedItem,
      detail?.content ?? "",
      exportStyle,
    );
    downloadTextFile(exported.content, exported.fileName, exported.mimeType);
  }

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-cyan-400/10 bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-cyan-200"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              返回问答
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-50">资料库</h1>
            <p className="mt-1 text-sm text-slate-400">
              查看、筛选和导出已入库的资料。
            </p>
          </div>
          <div className="text-right text-sm text-slate-400 tabular-nums">
            <p>{items.length} 条资料</p>
            <p>{items.filter((item) => needsMaterialReview(item)).length} 条待确认</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="min-h-0 rounded-lg border border-cyan-400/10 bg-slate-900">
          <div className="border-b border-slate-800 p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、来源、摘要或标签"
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterValue)}
              className="mt-3 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[calc(100dvh-230px)] overflow-y-auto p-3">
            {isLoadingItems ? (
              <EmptyState text="正在加载资料" />
            ) : filteredItems.length === 0 ? (
              <EmptyState text="没有符合条件的资料。" />
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left",
                      selectedId === item.id
                        ? "border-cyan-400/30 bg-cyan-400/10"
                        : "border-slate-800 bg-slate-950/60 hover:border-cyan-400/20 hover:bg-slate-950",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {item.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {getMaterialKindLabel(item)} · {item.fileName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge>{getMaterialCategoryLabel(item)}</Badge>
                          {needsMaterialReview(item) ? (
                            <Badge tone="warning">待确认</Badge>
                          ) : null}
                          <MaterialStatusBadges item={item} />
                        </div>
                        <VideoProgressLine item={item} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <MaterialGeneratePanel items={items} />
        </section>

        <section className="min-h-[520px] rounded-lg border border-cyan-400/10 bg-slate-900">
          {!selectedItem ? (
            <EmptyState text="请选择一条资料查看内容。" />
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-800 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-slate-50">
                      {selectedItem.title}
                    </h2>
                    <p className="mt-1 break-all text-sm text-slate-400">
                      来源：{selectedItem.fileName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={exportStyle}
                      onChange={(event) =>
                        setExportStyle(event.target.value as MaterialExportStyle)
                      }
                      className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
                    >
                      <option value="markdown">原文 Markdown</option>
                      <option value="card">资料卡片</option>
                      <option value="json">JSON 数据</option>
                    </select>
                    <button
                      type="button"
                      onClick={exportSelectedItem}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      导出
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteSelectedItem()}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-red-300"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      删除
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>{getMaterialKindLabel(selectedItem)}</Badge>
                  <Badge>{getMaterialCategoryLabel(selectedItem)}</Badge>
                  <Badge>{selectedItem.chunkCount} 段</Badge>
                  <MaterialStatusBadges item={selectedItem} />
                  {getMaterialTags(selectedItem).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>

                {getMaterialSummary(selectedItem) ? (
                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {getMaterialSummary(selectedItem)}
                  </p>
                ) : null}

                {selectedVideoInfo ? (
                  <VideoProcessingPanel
                    info={selectedVideoInfo}
                    onRetry={() => void retrySelectedVideo()}
                    isRetrying={isRetryingVideo}
                    canRetry={selectedItem.status === "failed"}
                  />
                ) : null}

                <div className="mt-5 rounded-md border border-slate-800 bg-slate-950/70 p-3">
                  <label
                    htmlFor="material-user-note"
                    className="text-sm font-medium text-slate-200"
                  >
                    处理说明
                  </label>
                  <p className="mt-1 text-xs text-slate-500">
                    写给 AI 的使用提示，例如“重点看定价”或“用于竞品分析”。
                  </p>
                  <textarea
                    id="material-user-note"
                    value={userNoteDraft}
                    onChange={(event) => setUserNoteDraft(event.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                    placeholder="给这条资料加一个处理说明"
                  />
                  <button
                    type="button"
                    onClick={() => void saveUserNote()}
                    disabled={isSavingNote}
                    className="mt-2 rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    保存说明
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {error ? (
                  <div className="mb-4 rounded-md border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}
                {isLoadingDetail ? (
                  <EmptyState text="正在加载资料内容" />
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-300">
                          原文内容
                        </p>
                        <button
                          type="button"
                          onClick={captureSelectedText}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
                        >
                          <MessageSquarePlus className="size-3.5" />
                          用选中内容添加注释
                        </button>
                      </div>
                      {selectedVideoSections.length > 0 ? (
                        <VideoContentSections sections={selectedVideoSections} />
                      ) : selectedItem.status === "processing" ? (
                        <EmptyState text="视频还在处理中，完成后这里会显示整理后的内容。" />
                      ) : (
                        <pre className="whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                          {detail?.content || "暂无原文内容"}
                        </pre>
                      )}
                    </div>
                    <aside className="space-y-3">
                      <div className="rounded-md border border-slate-800 bg-slate-950/70 p-3">
                        <p className="text-sm font-medium text-slate-200">
                          片段注释
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          先在原文里选中一段文字，再点击添加注释。
                        </p>
                        <textarea
                          value={selectedQuote}
                          onChange={(event) => setSelectedQuote(event.target.value)}
                          rows={3}
                          className="mt-3 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                          placeholder="选中的原文片段"
                        />
                        <textarea
                          value={annotationDraft}
                          onChange={(event) => setAnnotationDraft(event.target.value)}
                          rows={3}
                          className="mt-2 w-full resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                          placeholder="给这段内容写注释"
                        />
                        <button
                          type="button"
                          onClick={() => void saveAnnotation()}
                          disabled={!selectedQuote || !annotationDraft || isSavingNote}
                          className="mt-2 w-full rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500"
                        >
                          保存片段注释
                        </button>
                      </div>
                      <AnnotationList annotations={annotations} />
                    </aside>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AnnotationList({
  annotations,
}: {
  annotations: MaterialAnnotation[];
}) {
  if (annotations.length === 0) {
    return <EmptyState text="还没有片段注释。" />;
  }

  return (
    <div className="space-y-2">
      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className="rounded-md border border-slate-800 bg-slate-950 p-3"
        >
          <p className="line-clamp-3 border-l-2 border-cyan-400/40 pl-2 text-xs leading-5 text-slate-500">
            {annotation.quote}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
            {annotation.note}
          </p>
        </div>
      ))}
    </div>
  );
}

function MaterialStatusBadges({ item }: { item: KnowledgeItem }) {
  const videoInfo = getVideoProcessingInfo(item);

  if (item.status === "processing") {
    return <Badge tone="info">处理中</Badge>;
  }
  if (item.status === "failed") {
    return <Badge tone="danger">处理失败</Badge>;
  }
  if (videoInfo?.status === "complete" || item.status === "ready") {
    return <Badge tone="success">已完成</Badge>;
  }

  return null;
}

function VideoProgressLine({ item }: { item: KnowledgeItem }) {
  const info = getVideoProcessingInfo(item);
  if (!info || item.status !== "processing") {
    return null;
  }

  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-cyan-300">
      <Clock3 className="size-3.5" aria-hidden="true" />
      {info.currentStage
        ? `正在${getVideoStageLabel(info.currentStage)}`
        : "正在处理视频"}
    </p>
  );
}

function VideoProcessingPanel({
  info,
  onRetry,
  isRetrying,
  canRetry,
}: {
  info: VideoProcessingInfo;
  onRetry: () => void;
  isRetrying: boolean;
  canRetry: boolean;
}) {
  const isFailed = info.status === "failed";
  const isComplete = info.status === "complete" || info.status === "ready";
  const StatusIcon = isFailed ? AlertCircle : isComplete ? CheckCircle2 : Clock3;

  return (
    <div
      className={
        isFailed
          ? "mt-4 rounded-md border border-red-400/30 bg-red-950/30 p-3"
          : "mt-4 rounded-md border border-cyan-400/20 bg-cyan-400/10 p-3"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={
              isFailed
                ? "flex items-center gap-2 text-sm font-medium text-red-200"
                : "flex items-center gap-2 text-sm font-medium text-cyan-100"
            }
          >
            <StatusIcon className="size-4" aria-hidden="true" />
            视频处理：{getVideoStatusLabel(info.status)}
            {info.currentStage
              ? ` · ${getVideoStageLabel(info.currentStage)}`
              : ""}
          </p>
          <p className="mt-1 break-all text-xs text-slate-500">
            原始链接：{info.sourceUrl}
          </p>
        </div>
        {canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-400/30 bg-slate-950 px-2.5 text-xs font-medium text-red-200 hover:bg-red-950/60 disabled:text-slate-600"
          >
            <RefreshCw
              className={isRetrying ? "size-3.5 animate-spin" : "size-3.5"}
              aria-hidden="true"
            />
            重新处理
          </button>
        ) : null}
      </div>

      {info.failureReason ? (
        <p className="mt-2 text-xs leading-5 text-red-200">
          失败原因：{info.failureReason}
        </p>
      ) : null}
      {info.diagnosisTitle || info.diagnosisSuggestion ? (
        <div className="mt-2 rounded-md border border-red-400/20 bg-slate-950/70 p-2 text-xs leading-5 text-red-200">
          {info.diagnosisTitle ? (
            <p className="font-medium">{info.diagnosisTitle}</p>
          ) : null}
          {info.diagnosisSuggestion ? (
            <p className="mt-1">建议：{info.diagnosisSuggestion}</p>
          ) : null}
        </div>
      ) : null}

      {info.stages.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {info.stages.slice(-8).map((stage, index) => (
            <div
              key={`${stage.stage}-${stage.status}-${stage.at}-${index}`}
              className="rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-400"
            >
              <p className="font-medium text-slate-200">
                {getVideoStageLabel(stage.stage)} ·{" "}
                {getVideoStatusLabel(stage.status)}
              </p>
              {stage.summary ? (
                  <p className="mt-1 line-clamp-2 text-slate-400">
                  {stage.summary}
                </p>
              ) : null}
              {stage.message ? (
                  <p className="mt-1 line-clamp-2 text-slate-500">
                  {stage.message}
                </p>
              ) : null}
              {stage.diagnosisSuggestion ? (
                  <p className="mt-1 line-clamp-2 text-red-300">
                  建议：{stage.diagnosisSuggestion}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {info.warnings.length > 0 ? (
        <p className="mt-2 text-xs leading-5 text-amber-200">
          部分内容未完整提取：{info.warnings.join("；")}
        </p>
      ) : null}
    </div>
  );
}

function VideoContentSections({
  sections,
}: {
  sections: VideoContentSection[];
}) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <section
          key={`${section.title}-${index}`}
          className="rounded-md border border-slate-800 bg-slate-950 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-100">
            {section.title}
          </h3>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
            {section.content}
          </pre>
        </section>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success" | "info";
}) {
  const toneClass = {
    danger:
      "border-red-400/30 bg-red-400/10 text-red-200",
    default:
      "border-slate-700 bg-slate-950 text-slate-300",
    info:
      "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    success:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warning:
      "border-amber-400/30 bg-amber-400/10 text-amber-200",
  }[tone];

  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-500">
      {text}
    </div>
  );
}
