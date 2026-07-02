import { describe, expect, it } from "vitest";
import {
  getNoAnswerMessage,
  shouldUseNoAnswer,
} from "@/lib/rag/answer-policy";
import type { Citation } from "@/lib/domain";

function citation(similarity: number): Citation {
  return {
    chunkId: "chunk-id",
    itemId: "item-id",
    itemTitle: "售后 FAQ.md",
    chunkIndex: 0,
    content: "本产品支持 7 天内退款。",
    summary: "本产品支持 7 天内退款。",
    similarity,
  };
}

describe("answer policy", () => {
  it("uses no-answer message when there are no citations", () => {
    expect(shouldUseNoAnswer([], 0.78)).toBe(true);
  });

  it("uses no-answer message when all citations are below threshold", () => {
    expect(shouldUseNoAnswer([citation(0.4), citation(0.77)], 0.78)).toBe(true);
  });

  it("allows answers when at least one citation is above threshold", () => {
    expect(shouldUseNoAnswer([citation(0.4), citation(0.8)], 0.78)).toBe(false);
  });

  it("returns the exact no-answer message", () => {
    expect(getNoAnswerMessage()).toBe(
      "根据当前已上传的资料，我没有找到足够依据回答这个问题。\n你可以补充相关文档后再试。",
    );
  });
});
