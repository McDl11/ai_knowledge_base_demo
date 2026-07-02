"use client";

import { useState } from "react";
import type { Citation } from "@/lib/domain";

interface CitationPanelProps {
  sources: Citation[];
}

export function CitationPanel({ sources }: CitationPanelProps) {
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);

  return (
    <aside className="min-h-0 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold">引用来源</h2>
        <p className="mt-1 text-sm text-slate-500">原文片段和相关性</p>
      </div>

      <div className="space-y-3 overflow-y-auto p-3">
        {sources.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            暂无引用。回答返回后会显示来源片段。
          </div>
        ) : (
          sources.map((source) => {
            const isExpanded = expandedChunkId === source.chunkId;
            return (
              <div
                key={source.chunkId}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {source.itemTitle}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      相关性 {Math.round(source.similarity * 100)}%
                    </p>
                  </div>
                  <span className="rounded bg-white px-2 py-1 text-xs text-slate-500">
                    #{source.chunkIndex + 1}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {isExpanded ? source.content : source.summary}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedChunkId(isExpanded ? null : source.chunkId)
                  }
                  className="mt-3 text-sm font-medium text-[#1d4ed8] hover:text-[#1e40af]"
                >
                  {isExpanded ? "收起原文" : "展开原文"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
