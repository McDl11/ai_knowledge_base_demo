import { createOpenAIClient } from "@/lib/ai/openai-client";
import { getServerEnv } from "@/lib/env";

interface ExtractImageTextInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export async function extractImageText({
  buffer,
  mimeType,
  fileName,
}: ExtractImageTextInput): Promise<string> {
  const env = getServerEnv();
  const client = createOpenAIClient();
  const imageUrl = `data:${normalizeImageMimeType(mimeType, fileName)};base64,${buffer.toString(
    "base64",
  )}`;
  const prompt =
    "请读取这张图片，提取图片中的可见文字，并概括图片表达的信息。输出中文 Markdown，包含“可见文字”和“内容说明”两部分。不要添加图片里没有的事实。";

  if (env.OPENAI_WIRE_API === "responses") {
    const response = await client.responses.create({
      model: env.OPENAI_CHAT_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageUrl, detail: "auto" },
          ],
        },
      ],
      store: !env.OPENAI_DISABLE_RESPONSE_STORAGE,
      temperature: 0,
    });

    return response.output_text.trim();
  }

  const response = await client.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    temperature: 0,
  });

  return response.choices[0]?.message.content?.trim() ?? "";
}

function normalizeImageMimeType(mimeType: string, fileName: string): string {
  const normalizedMimeType = mimeType.toLowerCase().trim();
  if (normalizedMimeType.startsWith("image/")) {
    return normalizedMimeType;
  }

  const normalizedFileName = fileName.toLowerCase();
  if (normalizedFileName.endsWith(".jpg") || normalizedFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedFileName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}
