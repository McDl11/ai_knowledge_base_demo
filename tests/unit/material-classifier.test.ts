import { describe, expect, it } from "vitest";
import { classifyMaterial } from "@/lib/knowledge/material-classifier";

describe("classifyMaterial", () => {
  it("classifies tool material from text signals", () => {
    const result = classifyMaterial({
      title: "AI 插件集合",
      text: "这个工具可以整理网页资料，适合做知识库。",
      materialType: "link",
      sourceKind: "link",
    });

    expect(result).toMatchObject({
      category: "tool",
      needsReview: false,
    });
    expect(result.tags).toContain("工具");
  });

  it("marks unclear material for review", () => {
    const result = classifyMaterial({
      title: "untitled",
      text: "random note",
      materialType: "document",
      sourceKind: "file",
    });

    expect(result.needsReview).toBe(true);
  });
});
