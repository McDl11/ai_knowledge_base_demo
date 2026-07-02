import { NextResponse } from "next/server";
import { z } from "zod";
import { listKnowledgeItems } from "@/lib/db/knowledge-repository";
import { ingestIdea } from "@/lib/knowledge/idea-ingestion";
import { ingestLink } from "@/lib/knowledge/link-parser";

const materialRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("idea"),
    title: z.string().trim().optional(),
    content: z.string().trim().min(1),
  }),
  z.object({
    kind: z.literal("link"),
    url: z.string().trim().url(),
    title: z.string().trim().optional(),
    content: z.string().trim().optional(),
  }),
]);

export async function GET() {
  const items = await listKnowledgeItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = materialRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "请填写要保存的想法或有效链接。" },
      { status: 400 },
    );
  }

  try {
    const item =
      parsed.data.kind === "idea"
        ? await ingestIdea(parsed.data)
        : await ingestLink(parsed.data);

    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "资料保存失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
