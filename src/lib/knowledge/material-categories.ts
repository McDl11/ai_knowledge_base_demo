export const materialCategoryValues = [
  "project_doc",
  "tool",
  "idea",
  "competitor",
  "knowledge_note",
  "todo",
  "unknown",
] as const;

export type MaterialCategory = (typeof materialCategoryValues)[number];

export const confirmableMaterialCategories = [
  "project_doc",
  "tool",
  "idea",
  "competitor",
  "knowledge_note",
  "todo",
] as const satisfies readonly MaterialCategory[];

export const materialCategoryLabel: Record<MaterialCategory, string> = {
  project_doc: "项目资料",
  tool: "工具",
  idea: "灵感",
  competitor: "竞品",
  knowledge_note: "知识笔记",
  todo: "待办",
  unknown: "未确认",
};

const categoryAliases: Record<MaterialCategory, string[]> = {
  project_doc: ["项目资料", "项目", "需求", "方案", "prd", "roadmap"],
  tool: ["工具", "软件", "插件", "tool", "saas"],
  idea: ["灵感", "想法", "idea", "点子"],
  competitor: ["竞品", "对标", "竞争", "competitor"],
  knowledge_note: ["知识笔记", "知识", "笔记", "资料", "文档", "教程"],
  todo: ["待办", "任务", "行动项", "下一步", "todo"],
  unknown: ["不确定", "未知", "未确认"],
};

export function isMaterialCategory(value: unknown): value is MaterialCategory {
  return materialCategoryValues.some((category) => category === value);
}

export function parseMaterialCategoryReply(
  input: string,
): MaterialCategory | null {
  const normalized = input.normalize("NFKC").toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  for (const category of confirmableMaterialCategories) {
    if (categoryAliases[category].some((alias) => normalized.includes(alias))) {
      return category;
    }
  }

  return null;
}
