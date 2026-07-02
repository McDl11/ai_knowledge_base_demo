import { createOpenAIClient } from "@/lib/ai/openai-client";
import { getServerEnv } from "@/lib/env";
import type { FrameText } from "@/lib/video/video-types";

interface CreateVideoKnowledgeNoteInput {
  url: string;
  transcript: string;
  frameTexts: FrameText[];
  userContext?: string;
}

export async function createVideoKnowledgeNote(
  input: CreateVideoKnowledgeNoteInput,
): Promise<string> {
  const env = getServerEnv();
  const client = createOpenAIClient();
  const instructions =
    "You turn short-video content into a reusable knowledge-base note. Write in Simplified Chinese. Use only the transcript, frame OCR/vision notes, and user context. Do not invent title, author, metrics, or facts that are not present. Keep useful details, concrete claims, steps, examples, warnings, and terminology.";
  const prompt = [
    "Create a Markdown note for this video.",
    "",
    "Required structure:",
    "1. # 视频内容知识笔记",
    "2. ## 核心内容",
    "3. ## 关键知识点",
    "4. ## 可用于回答的问题",
    "5. ## 画面补充",
    "6. ## 原始转写",
    "",
    `Source URL: ${input.url}`,
    input.userContext ? `User context:\n${input.userContext}` : "",
    input.transcript
      ? `Transcript:\n${truncateText(input.transcript, 20_000)}`
      : "Transcript: (empty)",
    input.frameTexts.length > 0
      ? `Frame OCR / vision notes:\n${formatFrameTexts(input.frameTexts, 12_000)}`
      : "Frame OCR / vision notes: (empty)",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (env.OPENAI_WIRE_API === "responses") {
    const response = await client.responses.create({
      model: env.OPENAI_CHAT_MODEL,
      instructions,
      input: prompt,
      store: !env.OPENAI_DISABLE_RESPONSE_STORAGE,
      temperature: 0.1,
    });

    return response.output_text.trim();
  }

  const response = await client.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
  });

  return response.choices[0]?.message.content?.trim() ?? "";
}

export function composeFallbackVideoKnowledgeNote(input: {
  url: string;
  transcript: string;
  frameTexts: FrameText[];
  userContext?: string;
}): string {
  const sections = [
    "# 视频内容知识笔记",
    "",
    "## 核心内容",
    input.userContext?.trim() ? input.userContext.trim() : "已保存视频内容，等待后续整理。",
    "",
    "## 关键知识点",
    input.transcript.trim()
      ? truncateText(input.transcript.trim(), 4000)
      : "音频转写为空。",
    "",
    "## 画面补充",
    input.frameTexts.length > 0
      ? input.frameTexts
          .map((frame) => `- 第 ${frame.index} 帧：${frame.text}`)
          .join("\n")
      : "没有识别到可用画面文字。",
    "",
    "## 原始转写",
    input.transcript.trim() || "无",
    "",
    "## 来源",
    input.url,
  ];

  return sections.join("\n").trim();
}

function formatFrameTexts(frameTexts: FrameText[], maxLength: number): string {
  return truncateText(
    frameTexts
      .map((frame) => `[frame ${frame.index}]\n${frame.text}`)
      .join("\n\n"),
    maxLength,
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[内容过长，已截断]`;
}
