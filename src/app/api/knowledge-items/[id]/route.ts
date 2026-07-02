import { NextResponse } from "next/server";
import { deleteKnowledgeItem } from "@/lib/db/knowledge-repository";

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
