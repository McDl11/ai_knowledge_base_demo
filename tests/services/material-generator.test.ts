import { describe, expect, it } from "vitest";
import { buildMaterialGenerationPrompt } from "@/lib/generation/material-generator";

describe("material generator", () => {
  it("builds a prompt for project plans", () => {
    const prompt = buildMaterialGenerationPrompt({
      mode: "project_plan",
      materials: [
        {
          title: "AI 插件导航",
          content: "收集国产 AI 插件，按用途分类。",
        },
      ],
    });

    expect(prompt).toContain("项目计划");
    expect(prompt).toContain("AI 插件导航");
    expect(prompt).toContain("不要编造");
  });
});
