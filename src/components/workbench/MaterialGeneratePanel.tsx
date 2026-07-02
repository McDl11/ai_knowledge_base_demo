"use client";

import { Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeItem } from "@/lib/domain";
import type { MaterialGenerationMode } from "@/lib/generation/material-generator";

interface MaterialGeneratePanelProps {
  items: KnowledgeItem[];
}

const generationOptions: Array<{
  value: MaterialGenerationMode;
  label: string;
}> = [
  { value: "project_plan", label: "项目计划" },
  { value: "feature_list", label: "功能清单" },
  { value: "competitor_analysis", label: "竞品分析" },
  { value: "tool_recommendation", label: "工具推荐" },
];

export function MaterialGeneratePanel({ items }: MaterialGeneratePanelProps) {
  const readyItems = useMemo(
    () => items.filter((item) => item.status === "ready"),
    [items],
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<MaterialGenerationMode>("project_plan");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (selectedIds.length === 0 || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPrompt("");

    try {
      const materials = await Promise.all(
        selectedIds.map(async (id) => {
          const item = readyItems.find((candidate) => candidate.id === id);
          if (!item) {
            throw new Error("选中的资料不存在。");
          }

          const response = await fetch(`/api/materials/${id}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`${item.title} 内容加载失败。`);
          }

          const data = (await response.json()) as { content: string };
          return {
            title: item.title,
            content: data.content.slice(0, 8000),
          };
        }),
      );

      const response = await fetch("/api/materials/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, materials }),
      });
      const data = (await response.json().catch(() => null)) as
        | { prompt?: string; error?: string }
        | null;

      if (!response.ok || !data?.prompt) {
        throw new Error(data?.error ?? "生成失败。");
      }

      setPrompt(data.prompt);
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "生成失败。",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleItem(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  return (
    <section className="border-t border-slate-800 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">素材生成</h2>
          <p className="mt-1 text-sm text-slate-500">
            选择资料，生成可交给 AI 的结构化提示。
          </p>
        </div>
        <Wand2 className="size-5 shrink-0 text-cyan-300" aria-hidden="true" />
      </div>

      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as MaterialGenerationMode)}
        className="mt-3 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-100"
      >
        {generationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {readyItems.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-3 text-sm text-slate-500">
            暂无可用资料。
          </p>
        ) : (
          readyItems.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 bg-slate-950/50 p-2 text-sm hover:border-cyan-400/20 hover:bg-slate-950"
            >
              <input
                type="checkbox"
                aria-label={`选择 ${item.title} 生成素材`}
                checked={selectedIds.includes(item.id)}
                onChange={() => toggleItem(item.id)}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-200">
                  {item.title}
                </span>
                <span className="block text-xs text-slate-500">
                  {item.chunkCount} 段
                </span>
              </span>
            </label>
          ))
        )}
      </div>

      <button
        data-testid="generate-materials-button"
        type="button"
        onClick={() => void generate()}
        disabled={selectedIds.length === 0 || isGenerating}
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        {isGenerating ? "生成中" : "生成提示"}
      </button>

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      {prompt ? (
        <textarea
          data-testid="generated-prompt"
          readOnly
          value={prompt}
          className="mt-3 h-44 w-full resize-none rounded-md border border-slate-700 bg-slate-950 p-2 text-xs leading-5 text-slate-300"
        />
      ) : null}
    </section>
  );
}
