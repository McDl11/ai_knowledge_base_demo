import { describe, expect, it } from "vitest";
import {
  createRuleBasedPlan,
  planRetrievalQuery,
} from "@/lib/rag/query-planner";
import { parseServerEnv } from "@/lib/env";

const env = parseServerEnv({
  OPENAI_API_KEY: "openai-key",
  RAG_AI_QUERY_PLANNING: "true",
});

describe("query planner", () => {
  it("creates a rule-based search query from the question", () => {
    const plan = createRuleBasedPlan("怎么上传图片并分类？");

    expect(plan.usedAi).toBe(false);
    expect(plan.searchQuery).toContain("图片");
    expect(plan.searchQuery).toContain("分类");
  });

  it("uses AI query planning when available", async () => {
    const plan = await planRetrievalQuery("抖音链接能入库吗？", {
      env,
      createAiPlan: async () => ({
        originalQuestion: "抖音链接能入库吗？",
        searchQuery: "抖音 链接 入库 视频链接",
        keywords: ["抖音", "链接", "入库"],
        usedAi: true,
        reason: "expanded platform and storage intent",
      }),
    });

    expect(plan).toMatchObject({
      usedAi: true,
      searchQuery: "抖音 链接 入库 视频链接",
    });
  });

  it("falls back to rules when AI planning fails", async () => {
    const plan = await planRetrievalQuery("资料库怎么检索？", {
      env,
      createAiPlan: async () => {
        throw new Error("model unavailable");
      },
    });

    expect(plan.usedAi).toBe(false);
    expect(plan.searchQuery).toContain("资料库");
  });
});
