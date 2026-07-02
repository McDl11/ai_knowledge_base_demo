import type { AnswerStyle, Citation } from "@/lib/domain";
import { createOpenAIClient } from "@/lib/ai/openai-client";
import { getServerEnv } from "@/lib/env";

export type EvidenceMode = "grounded" | "weak" | "none";

interface GenerateGroundedAnswerInput {
  question: string;
  citations: Citation[];
  style: AnswerStyle;
  evidenceMode?: EvidenceMode;
  libraryContext?: string;
}

export async function generateGroundedAnswer({
  question,
  citations,
  style,
  evidenceMode = citations.length > 0 ? "grounded" : "none",
  libraryContext = "",
}: GenerateGroundedAnswerInput): Promise<string> {
  const env = getServerEnv();
  const client = createOpenAIClient();
  const styleInstruction =
    style === "detailed"
      ? "请给出结构清晰、信息充分的回答。"
      : "请给出简洁直接的回答。";
  const context = formatCitations(citations);
  const instructions = buildAnswerInstructions(evidenceMode);
  const input = [
    styleInstruction,
    "",
    `用户问题：${question}`,
    "",
    libraryContext ? `资料库概况：\n${libraryContext}` : "",
    citations.length > 0
      ? `可用资料片段：\n${context}`
      : "可用资料片段：没有检索到直接相关片段。",
    "",
    "请回答用户的问题。",
  ]
    .filter(Boolean)
    .join("\n");

  if (env.OPENAI_WIRE_API === "responses") {
    const reasoning = env.OPENAI_REASONING_EFFORT
      ? { effort: env.OPENAI_REASONING_EFFORT }
      : undefined;
    const response = await client.responses.create({
      model: env.OPENAI_CHAT_MODEL,
      instructions,
      input,
      reasoning,
      store: !env.OPENAI_DISABLE_RESPONSE_STORAGE,
      temperature: evidenceMode === "grounded" ? 0.2 : 0.35,
    });

    return response.output_text.trim();
  }

  const response = await client.chat.completions.create({
    model: env.OPENAI_CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: instructions,
      },
      {
        role: "user",
        content: input,
      },
    ],
    temperature: evidenceMode === "grounded" ? 0.2 : 0.35,
  });

  return response.choices[0]?.message.content?.trim() ?? "";
}

function buildAnswerInstructions(evidenceMode: EvidenceMode): string {
  const shared =
    "你是 DocPilot 的智能资料问答助手。优先使用用户资料库里的内容回答，并把资料里的具体信息转成自然、有帮助的结论。不要编造资料中没有的具体事实、数字、作者、标题或来源。回答末尾可以用一小句说明依据情况。";

  if (evidenceMode === "grounded") {
    return `${shared}\n当前问题有可用资料依据。请直接回答，必要时引用资料片段里的具体说法；如果资料内部有缺口，指出缺口，但不要因为缺口而拒绝回答。`;
  }

  if (evidenceMode === "weak") {
    return `${shared}\n当前只找到弱相关资料。请先说明“我找到的资料只能部分支撑这个问题”，然后基于资料做谨慎归纳；可以给出合理的 AI 分析和下一步建议，但必须明确哪些是资料依据，哪些是推断。不要只回答“资料不足”。`;
  }

  return `${shared}\n当前没有检索到直接相关资料。仍然要尽量帮助用户：先说明资料库里没有直接依据，然后基于常识和问题本身给出可执行的分析框架、可能答案或下一步建议。必须明确这部分不是来自资料库，避免伪装成已上传资料。不要只回答“资料不足”。`;
}

function formatCitations(citations: Citation[]): string {
  return citations
    .map(
      (citation, index) =>
        `[${index + 1}] 文档：${citation.itemTitle}\n相关度：${citation.similarity.toFixed(
          2,
        )}\n片段：${citation.content}`,
    )
    .join("\n\n");
}
