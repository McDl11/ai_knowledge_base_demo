import { describe, expect, it } from "vitest";
import { parseKnowledgeSource } from "@/lib/knowledge/source-parser";

describe("parseKnowledgeSource", () => {
  it("parses a manual idea as searchable text", async () => {
    const result = await parseKnowledgeSource({
      kind: "idea",
      title: "AI 插件导航想法",
      content: "我想做一个收集国产 AI 插件的网站，后面可以生成周报。",
    });

    expect(result.title).toBe("AI 插件导航想法");
    expect(result.text).toContain("国产 AI 插件");
    expect(result.materialType).toBe("idea");
    expect(result.knowledgeType).toBe("text");
  });

  it("parses a link as a saved source when body is manually provided", async () => {
    const result = await parseKnowledgeSource({
      kind: "link",
      url: "https://example.com/tool",
      title: "Example Tool",
      content: "一个用于演示的工具页面。",
    });

    expect(result.source).toBe("https://example.com/tool");
    expect(result.materialType).toBe("link");
    expect(result.text).toContain("演示");
  });
});
