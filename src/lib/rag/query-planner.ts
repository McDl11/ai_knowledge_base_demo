import { createOpenAIClient } from "@/lib/ai/openai-client";
import type { JsonRecord } from "@/lib/domain";
import type { ServerEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env";

export interface RetrievalQueryPlan {
  originalQuestion: string;
  searchQuery: string;
  keywords: string[];
  usedAi: boolean;
  reason: string;
}

export interface PlanRetrievalQueryDependencies {
  env: ServerEnv;
  createAiPlan: (question: string, env: ServerEnv) => Promise<RetrievalQueryPlan>;
}

export async function planRetrievalQuery(
  question: string,
  dependencies: Partial<PlanRetrievalQueryDependencies> = {},
): Promise<RetrievalQueryPlan> {
  const env = dependencies.env ?? getServerEnv();
  const createAiPlan = dependencies.createAiPlan ?? createOpenAIQueryPlan;

  if (!env.RAG_AI_QUERY_PLANNING) {
    return createRuleBasedPlan(question, "AI query planning disabled");
  }

  try {
    return await createAiPlan(question, env);
  } catch {
    return createRuleBasedPlan(question, "AI query planning failed, used rules");
  }
}

export function createRuleBasedPlan(
  question: string,
  reason = "rule based query plan",
): RetrievalQueryPlan {
  const keywords = collectKeywords(question);
  const searchQuery = [...new Set([question.trim(), ...keywords])].join(" ");

  return {
    originalQuestion: question,
    searchQuery: searchQuery || question,
    keywords,
    usedAi: false,
    reason,
  };
}

async function createOpenAIQueryPlan(
  question: string,
  env: ServerEnv,
): Promise<RetrievalQueryPlan> {
  const client = createOpenAIClient();
  const instructions =
    "你是知识库检索规划器。把用户的口语问题改写成更适合在个人资料库里检索的查询文本。只输出 JSON，不回答问题，不引入外部事实。JSON 字段：searchQuery(string), keywords(string[]), reason(string)。";
  const input = `用户问题：${question}\n\n要求：保留核心名词、同义词、可能的资料标题词；如果问题已经清楚，保持简洁。`;
  let output = "";

  if (env.OPENAI_WIRE_API === "responses") {
    const response = await client.responses.create({
      model: env.OPENAI_CHAT_MODEL,
      instructions,
      input,
      store: !env.OPENAI_DISABLE_RESPONSE_STORAGE,
      temperature: 0,
    });
    output = response.output_text;
  } else {
    const response = await client.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: input },
      ],
      temperature: 0,
    });
    output = response.choices[0]?.message.content ?? "";
  }

  const parsed = parseQueryPlanJson(output);
  const fallback = createRuleBasedPlan(question);
  const searchQuery =
    typeof parsed.searchQuery === "string" && parsed.searchQuery.trim()
      ? parsed.searchQuery.trim()
      : fallback.searchQuery;
  const keywords = normalizeKeywords(
    Array.isArray(parsed.keywords) ? parsed.keywords : fallback.keywords,
  );
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : "AI query planning";

  return {
    originalQuestion: question,
    searchQuery: [...new Set([searchQuery, ...keywords])].join(" "),
    keywords,
    usedAi: true,
    reason,
  };
}

function parseQueryPlanJson(output: string): JsonRecord {
  const trimmed = output.trim();
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
  const parsed = JSON.parse(jsonText) as unknown;

  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as JsonRecord;
  }

  return {};
}

function collectKeywords(text: string): string[] {
  const normalized = text.normalize("NFKC").toLowerCase();
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const keywords = new Set<string>();

  for (const word of words) {
    if (word.length >= 2 && !stopWords.has(word)) {
      keywords.add(word);
    }
  }

  for (const phrase of domainPhrases) {
    if (normalized.includes(phrase)) {
      keywords.add(phrase);
    }
  }

  return [...keywords].slice(0, 12);
}

function normalizeKeywords(input: unknown[]): string[] {
  return [
    ...new Set(
      input
        .filter((keyword): keyword is string => typeof keyword === "string")
        .map((keyword) => keyword.normalize("NFKC").toLowerCase().trim())
        .filter((keyword) => keyword.length > 0),
    ),
  ].slice(0, 12);
}

const domainPhrases = [
  "资料库",
  "知识库",
  "上传",
  "分类",
  "链接",
  "图片",
  "项目",
  "工具",
  "竞品",
  "待办",
  "退款",
  "售后",
];

const stopWords = new Set([
  "这个",
  "那个",
  "请问",
  "是否",
  "可以",
  "什么",
  "怎么",
  "如何",
  "一下",
  "里面",
  "关于",
  "吗",
]);
