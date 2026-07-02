export type MaterialGenerationMode =
  | "project_plan"
  | "feature_list"
  | "competitor_analysis"
  | "tool_recommendation";

interface BuildMaterialGenerationPromptInput {
  mode: MaterialGenerationMode;
  materials: Array<{
    title: string;
    content: string;
  }>;
}

const modeTitle: Record<MaterialGenerationMode, string> = {
  project_plan: "项目计划",
  feature_list: "产品功能清单",
  competitor_analysis: "竞品分析",
  tool_recommendation: "工具推荐清单",
};

export function buildMaterialGenerationPrompt(
  input: BuildMaterialGenerationPromptInput,
): string {
  const materials = input.materials
    .map(
      (material, index) =>
        `资料 ${index + 1}：${material.title}\n${material.content}`,
    )
    .join("\n\n");

  return [
    `请基于以下资料生成一份${modeTitle[input.mode]}。`,
    "要求：结构清晰、不要编造资料外的事实、保留可执行步骤，并标明使用了哪些资料。",
    materials,
  ].join("\n\n");
}
