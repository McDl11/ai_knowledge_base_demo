"use client";

import type { AnswerStyle } from "@/lib/domain";

interface SettingsDialogProps {
  isOpen: boolean;
  style: AnswerStyle;
  onStyleChange: (style: AnswerStyle) => void;
  onClose: () => void;
}

export function SettingsDialog({
  isOpen,
  style,
  onStyleChange,
  onClose,
}: SettingsDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 px-4">
      <div className="w-full max-w-md rounded-lg border border-cyan-400/20 bg-slate-900 p-5 shadow-xl shadow-cyan-950/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">设置</h2>
            <p className="mt-1 text-sm text-slate-400">回答风格和模型配置</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            关闭
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-300">回答风格</p>
            <div className="mt-2 grid grid-cols-2 rounded-md border border-slate-700 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => onStyleChange("concise")}
                className={
                  style === "concise"
                    ? "rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                    : "rounded px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }
              >
                简洁
              </button>
              <button
                type="button"
                onClick={() => onStyleChange("detailed")}
                className={
                  style === "detailed"
                    ? "rounded bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
                    : "rounded px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }
              >
                详细
              </button>
            </div>
          </div>

          <div className="rounded-md border border-slate-700 bg-slate-950 p-3 text-sm text-slate-400">
            模型和密钥由环境变量配置，不在页面中填写。
          </div>
        </div>
      </div>
    </div>
  );
}
