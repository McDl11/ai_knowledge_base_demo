"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { knowledgeUploadAccept } from "@/lib/knowledge/upload-accept";

interface UploadButtonProps {
  onUploaded: () => Promise<void>;
}

export function UploadButton({ onUploaded }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/knowledge-items", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "上传失败，请稍后再试。");
      }

      await onUploaded();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败。");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={knowledgeUploadAccept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      <button
        type="button"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500"
      >
        <Upload className="size-4" aria-hidden="true" />
        {isUploading ? "上传中" : "上传文档"}
      </button>
      {error ? (
        <div className="absolute right-0 top-12 z-20 w-72 rounded-md border border-red-400/30 bg-slate-950 p-3 text-sm text-red-200 shadow-lg">
          {error}
        </div>
      ) : null}
    </div>
  );
}
