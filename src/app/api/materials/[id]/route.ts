import { NextResponse } from "next/server";
import {
  deleteKnowledgeItem,
  listKnowledgeChunksByItem,
} from "@/lib/db/knowledge-repository";
import { confirmMaterialCategory } from "@/lib/knowledge/classification-confirmation";
import {
  addMaterialAnnotation,
  updateMaterialUserNote,
} from "@/lib/knowledge/material-notes";
import { isMaterialCategory } from "@/lib/knowledge/material-categories";
import { retryVideoKnowledgeItem } from "@/lib/knowledge/video-link-ingestion";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await deleteKnowledgeItem(id);

  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const chunks = await listKnowledgeChunksByItem(id);
  const content = chunks.map((chunk) => chunk.content).join("\n\n");

  return NextResponse.json({ chunks, content });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        action?: unknown;
        category?: unknown;
        userNote?: unknown;
        annotation?: { quote?: unknown; note?: unknown };
      }
    | null;

  try {
    if (body?.action === "retryVideoProcessing") {
      const item = await retryVideoKnowledgeItem(id);
      return NextResponse.json({ item });
    }

    if (typeof body?.userNote === "string") {
      const item = await updateMaterialUserNote(id, body.userNote);
      return NextResponse.json({ item });
    }

    if (
      typeof body?.annotation?.quote === "string" &&
      typeof body.annotation.note === "string"
    ) {
      const item = await addMaterialAnnotation({
        itemId: id,
        quote: body.annotation.quote,
        note: body.annotation.note,
      });
      return NextResponse.json({ item });
    }

    const category = body?.category;
    if (!isMaterialCategory(category) || category === "unknown") {
      return NextResponse.json(
        { error: "请选择一个明确的资料分类。" },
        { status: 400 },
      );
    }

    const item = await confirmMaterialCategory({ itemId: id, category });
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "资料更新失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
