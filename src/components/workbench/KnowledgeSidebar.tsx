"use client";

import { AlertCircle, FileText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeItem } from "@/lib/domain";
import {
  getMaterialCategoryLabel,
  getMaterialKind,
  getMaterialKindLabel,
  getMaterialSummary,
  getMaterialTags,
  needsMaterialReview,
} from "@/lib/knowledge/material-view";

interface KnowledgeSidebarProps {
  items: KnowledgeItem[];
  isLoading: boolean;
  onDelete: (itemId: string) => Promise<void>;
}

const statusLabel: Record<KnowledgeItem["status"], string> = {
  processing: "处理中",
  ready: "可用",
  failed: "失败",
};

const typeLabel: Record<KnowledgeItem["type"], string> = {
  text: "文本",
  markdown: "Markdown",
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PPT",
  csv: "CSV",
  html: "网页",
  image: "图片",
  video: "视频",
  audio: "音频",
};

const filterOptions = [
  { value: "all", label: "全部类型" },
  { value: "idea", label: "想法" },
  { value: "link", label: "链接" },
  { value: "document", label: "文件" },
] as const;

type FilterValue = (typeof filterOptions)[number]["value"];

export function KnowledgeSidebar({
  items,
  isLoading,
  onDelete,
}: KnowledgeSidebarProps) {
  const [filter, setFilter] = useState<FilterValue>("all");
  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [filter, items],
  );

  return (
    <aside className="min-h-0 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">资料库</h2>
        <p className="mt-1 text-sm text-slate-500">{filteredItems.length} 条资料</p>
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as FilterValue)}
          className="mt-3 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
        >
          {filterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            正在加载资料
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            还没有符合条件的资料。
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {getMaterialKindLabel(item)} · {item.fileName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{typeLabel[item.type]}</span>
                    <span>{statusLabel[item.status]}</span>
                    <span>{item.chunkCount} 段</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                      {getMaterialCategoryLabel(item)}
                    </span>
                    {needsMaterialReview(item) ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        待确认
                      </span>
                    ) : null}
                  </div>
                  {getMaterialSummary(item) ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                      {getMaterialSummary(item)}
                    </p>
                  ) : null}
                  {getMaterialTags(item).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {getMaterialTags(item).slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(item.id)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-red-600"
                  aria-label={`删除 ${item.title}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function matchesFilter(item: KnowledgeItem, filter: FilterValue): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "document") {
    return getMaterialKind(item) === "document";
  }

  return getMaterialKind(item) === filter;
}
