import { NextResponse } from "next/server";
import { listKnowledgeItems } from "@/lib/db/knowledge-repository";
import { ingestKnowledgeFile } from "@/lib/knowledge/ingestion";

export async function GET() {
  const items = await listKnowledgeItems();
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "请选择要上传的文件。" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await ingestKnowledgeFile({
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    return NextResponse.json({ item });
  } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "这个文件暂时不支持，请上传纯文本、标记文档或便携式文档。";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
