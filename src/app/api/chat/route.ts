import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listChatSessions,
  listMessagesBySession,
} from "@/lib/db/chat-repository";
import { runChatTurn } from "@/lib/chat/chat-service";

const chatRequestSchema = z.object({
  question: z.string().trim().min(1),
  sessionId: z.string().uuid().nullable().optional(),
  style: z.enum(["concise", "detailed"]).default("concise"),
});

const sessionQuerySchema = z.string().uuid().nullable();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedSessionId = sessionQuerySchema.safeParse(searchParams.get("sessionId"));

  if (!parsedSessionId.success) {
    return NextResponse.json({ error: "对话不存在。" }, { status: 400 });
  }

  if (parsedSessionId.data) {
    const messages = await listMessagesBySession(parsedSessionId.data);
    return NextResponse.json({ messages });
  }

  const sessions = await listChatSessions();
  return NextResponse.json({ sessions, messages: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入要询问的问题。" }, { status: 400 });
  }

  const result = await runChatTurn(parsed.data);
  return NextResponse.json(result);
}
