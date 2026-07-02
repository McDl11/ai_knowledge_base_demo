import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteChatSession,
  renameChatSession,
} from "@/lib/db/chat-repository";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const renameRequestSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = renameRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "请输入 1 到 80 个字的对话标题。" },
      { status: 400 },
    );
  }

  try {
    const session = await renameChatSession(id, parsed.data.title);
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "对话重命名失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    await deleteChatSession(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "对话删除失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
