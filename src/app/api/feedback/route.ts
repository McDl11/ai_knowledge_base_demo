import { NextResponse } from "next/server";
import { z } from "zod";
import { saveFeedback } from "@/lib/db/chat-repository";

const feedbackRequestSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(["helpful", "not_helpful"]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = feedbackRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "反馈参数不正确。" }, { status: 400 });
  }

  await saveFeedback(parsed.data.messageId, parsed.data.rating);
  return NextResponse.json({ ok: true });
}
