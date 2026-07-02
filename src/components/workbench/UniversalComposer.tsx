"use client";

import { BookmarkPlus, LinkIcon, Paperclip, Send } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { knowledgeUploadAccept } from "@/lib/knowledge/upload-accept";
import { extractFirstHttpUrl } from "@/lib/knowledge/url-utils";

interface UniversalComposerProps {
  disabled: boolean;
  onAsk: (question: string) => Promise<void>;
  onSaveIdea: (content: string) => Promise<void>;
  onSaveLink: (url: string, content?: string) => Promise<void>;
  onUploadFiles: (files: File[]) => Promise<void>;
}

export function UniversalComposer({
  disabled,
  onAsk,
  onSaveIdea,
  onSaveLink,
  onUploadFiles,
}: UniversalComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");

  const trimmedValue = value.trim();
  const detectedUrl = extractFirstUrl(trimmedValue);
  const isLink = Boolean(detectedUrl);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedValue || isBusy) {
      return;
    }

    await runAction(async () => {
      await onAsk(trimmedValue);
      setValue("");
    }, "正在发送...");
  }

  async function saveMaterial() {
    if (!trimmedValue || isBusy) {
      return;
    }

    await runAction(async () => {
      if (isLink) {
        await onSaveLink(detectedUrl ?? trimmedValue, trimmedValue);
      } else {
        await onSaveIdea(trimmedValue);
      }
      setValue("");
    }, isLink ? "正在保存链接..." : "正在保存想法...");
  }

  async function uploadFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    if (selectedFiles.length === 0 || isBusy) {
      return;
    }

    await runAction(async () => {
      await onUploadFiles(selectedFiles);
    }, "正在上传文件...");
  }

  async function runAction(action: () => Promise<void>, label: string) {
    setIsBusy(true);
    setBusyLabel(label);
    try {
      await action();
    } finally {
      setIsBusy(false);
      setBusyLabel("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <form
      className="rounded-lg border border-cyan-400/20 bg-slate-900 p-3 shadow-lg shadow-cyan-950/20"
      onSubmit={submit}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        void uploadFiles(event.dataTransfer.files);
      }}
      onPaste={(event) => {
        if (event.clipboardData.files.length > 0) {
          event.preventDefault();
          void uploadFiles(event.clipboardData.files);
        }
      }}
    >
      <textarea
        data-testid="universal-composer-input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入问题、想法、链接，或拖拽文件到这里"
        rows={2}
        className="min-h-12 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={knowledgeUploadAccept}
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              void uploadFiles(event.target.files);
            }
          }}
        />

        <div className="flex items-center gap-2">
          <button
            data-testid="upload-file-button"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
            aria-label="上传文件"
            title="上传文件"
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:border-cyan-400/50 hover:bg-slate-800 hover:text-cyan-200 disabled:text-slate-700"
          >
            <Paperclip className="size-4" aria-hidden="true" />
          </button>
          <button
            data-testid="save-material-button"
            type="button"
            onClick={() => void saveMaterial()}
            disabled={!trimmedValue || isBusy}
            aria-label={isLink ? "保存链接" : "保存想法"}
            title={isLink ? "保存链接" : "保存想法"}
            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:border-cyan-400/50 hover:bg-slate-800 hover:text-cyan-200 disabled:text-slate-700"
          >
            {isLink ? (
              <LinkIcon className="size-4" aria-hidden="true" />
            ) : (
              <BookmarkPlus className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {busyLabel ? (
          <span className="text-xs text-cyan-200" role="status">
            {busyLabel}
          </span>
        ) : null}

        <button
          data-testid="send-question-button"
          type="submit"
          disabled={!trimmedValue || isBusy || disabled}
          aria-label="发送"
          title="发送"
          className="inline-flex size-10 items-center justify-center rounded-md bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function extractFirstUrl(value: string): string | null {
  const matchedUrl = extractFirstHttpUrl(value);
  if (!matchedUrl) {
    return null;
  }

  try {
    const url = new URL(matchedUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
