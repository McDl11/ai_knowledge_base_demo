import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { prepareKnowledgeChunks } from "@/lib/knowledge/ingestion";

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    DATABASE_PROVIDER: "local",
    LOCAL_DB_PATH: dbPath,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    OPENAI_API_KEY: "openai-key",
    OPENAI_BASE_URL: "https://example.com/v1",
    OPENAI_WIRE_API: "responses",
    OPENAI_DISABLE_RESPONSE_STORAGE: true,
    OPENAI_CHAT_MODEL: "gpt-4o-mini",
    OPENAI_REASONING_EFFORT: "medium",
    OPENAI_EMBEDDING_MODEL: "local-hash-embedding-v1",
    RAG_MATCH_THRESHOLD: 0.78,
    RAG_MATCH_COUNT: 5,
  }),
}));

vi.mock("@/lib/ai/image-text", () => ({
  extractImageText: vi
    .fn()
    .mockResolvedValue("可见文字：上传流程\n内容说明：一张关于资料自动分类的流程图。"),
}));

let directory: string;
let dbPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "docpilot-ingestion-"));
  dbPath = join(directory, "local-db.json");
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("prepareKnowledgeChunks", () => {
  it("splits text into chunks that can receive embeddings", () => {
    const chunks = prepareKnowledgeChunks("第一段内容。\n\n第二段内容。", {
      maxChars: 10,
      overlapChars: 2,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      content: expect.any(String),
      tokenCount: expect.any(Number),
    });
  });

  it("keeps the refund rule from the sample FAQ inside a chunk", () => {
    const text = `# 售后 FAQ

## 退款规则

本产品支持签收后 7 天内无理由退款。超过 7 天后，如果产品存在质量问题，用户可以联系客服申请售后处理。

## 换货规则

产品外包装破损、配件缺失或功能异常时，用户可以在签收后 15 天内申请换货。`;

    const chunks = prepareKnowledgeChunks(text);

    expect(chunks.some((chunk) => chunk.content.includes("7 天内无理由退款"))).toBe(
      true,
    );
  });
});

describe("ingestKnowledgeFile", () => {
  it("ingests a text-based PDF into the local knowledge store", async () => {
    const { ingestKnowledgeFile } = await import("@/lib/knowledge/ingestion");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestKnowledgeFile({
      fileName: "hello.pdf",
      mimeType: "application/pdf",
      buffer: createTextPdfBuffer(),
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("Hello PDF"),
      query: "Hello PDF",
      threshold: 0.1,
      count: 1,
    });

    expect(item).toMatchObject({
      title: "hello.pdf",
      type: "pdf",
      status: "ready",
      chunkCount: 1,
    });
    expect(matches[0]?.content).toContain("Hello PDF");
  });

  it("ingests an XLSX spreadsheet into the local knowledge store", async () => {
    const { ingestKnowledgeFile } = await import("@/lib/knowledge/ingestion");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestKnowledgeFile({
      fileName: "tools.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await createXlsxBuffer([
        ["工具", "用途"],
        ["DocPilot", "资料中枢"],
      ]),
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("资料中枢"),
      query: "资料中枢",
      threshold: 0.1,
      count: 1,
    });

    expect(item).toMatchObject({
      title: "tools.xlsx",
      type: "xlsx",
      status: "ready",
    });
    expect(matches[0]?.content).toContain("DocPilot");
  });

  it("ingests an HTML page into the local knowledge store", async () => {
    const { ingestKnowledgeFile } = await import("@/lib/knowledge/ingestion");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    await ingestKnowledgeFile({
      fileName: "page.html",
      mimeType: "text/html",
      buffer: Buffer.from("<h1>资料中枢</h1><p>网页正文可以入库。</p>", "utf8"),
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("网页正文"),
      query: "网页正文",
      threshold: 0.1,
      count: 1,
    });

    expect(matches[0]?.content).toContain("网页正文");
  });

  it("ingests an image through AI visual text extraction", async () => {
    const { ingestKnowledgeFile } = await import("@/lib/knowledge/ingestion");
    const { matchKnowledgeChunks } = await import("@/lib/db/knowledge-repository");
    const { createLocalHashEmbedding } = await import("@/lib/ai/embeddings");

    const item = await ingestKnowledgeFile({
      fileName: "flow.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake image bytes"),
    });

    const matches = await matchKnowledgeChunks({
      embedding: createLocalHashEmbedding("资料自动分类"),
      query: "资料自动分类",
      threshold: 0.1,
      count: 1,
    });

    expect(item).toMatchObject({
      title: "flow.png",
      type: "image",
      status: "ready",
      metadata: expect.objectContaining({ materialType: "image" }),
    });
    expect(matches[0]?.content).toContain("资料自动分类");
  });
});

function createTextPdfBuffer(): Buffer {
  const stream = "BT /F1 24 Tf 100 700 Td (Hello PDF) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "ascii"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body, "ascii");
}

async function createXlsxBuffer(rows: string[][]): Promise<Buffer> {
  const sharedStrings = [...new Set(rows.flat())];
  const sharedIndex = new Map(
    sharedStrings.map((value, index) => [value, index] as const),
  );
  const sheetRows = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, cellIndex) => {
            const column = String.fromCharCode("A".charCodeAt(0) + cellIndex);
            return `<c r="${column}${rowIndex + 1}" t="s"><v>${sharedIndex.get(
              cell,
            )}</v></c>`;
          })
          .join("")}</row>`,
    )
    .join("");

  const zip = new JSZip();
  zip.file(
    "xl/workbook.xml",
    '<workbook><sheets><sheet name="清单" sheetId="1" r:id="rId1"/></sheets></workbook>',
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<sst>${sharedStrings
      .map((value) => `<si><t>${escapeXml(value)}</t></si>`)
      .join("")}</sst>`,
  );
  zip.file("xl/worksheets/sheet1.xml", `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
