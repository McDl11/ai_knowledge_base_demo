import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMaterialGenerationPrompt } from "@/lib/generation/material-generator";

const requestSchema = z.object({
  mode: z.enum([
    "project_plan",
    "feature_list",
    "competitor_analysis",
    "tool_recommendation",
  ]),
  materials: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        content: z.string().trim().min(1),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "请选择要生成的资料。" },
      { status: 400 },
    );
  }

  const prompt = buildMaterialGenerationPrompt(parsed.data);
  return NextResponse.json({ prompt });
}
