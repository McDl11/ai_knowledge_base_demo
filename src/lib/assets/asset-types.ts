export type MaterialType =
  | "document"
  | "image"
  | "link"
  | "video_link"
  | "idea"
  | "project_doc"
  | "tool";

export interface ToolProfile {
  name: string;
  website?: string;
  purpose?: string;
  scenario?: string;
  pros?: string[];
  cons?: string[];
  pricing?: string;
  alternatives?: string[];
  worthExploring?: boolean;
}

export interface ProjectSpace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialCard {
  id: string;
  knowledgeItemId?: string;
  title: string;
  type: MaterialType;
  source: string;
  summary: string;
  tags: string[];
  projectId?: string;
  tool?: ToolProfile;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export function normalizeTags(input: string[]): string[] {
  const tags = input
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  return [...new Set(tags)];
}

export function isToolMaterial(input: { type: string }): boolean {
  return input.type === "tool";
}
