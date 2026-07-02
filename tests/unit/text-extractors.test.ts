import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractTextFromBuffer } from "@/lib/knowledge/text-extractors";

describe("extractTextFromBuffer", () => {
  it("extracts text from a text-based PDF buffer", async () => {
    const text = await extractTextFromBuffer("pdf", createTextPdfBuffer());

    expect(text).toContain("Hello PDF");
  });

  it("extracts clean text from HTML", async () => {
    const text = await extractTextFromBuffer(
      "html",
      Buffer.from(
        "<html><head><title>网页标题</title><style>.x{}</style></head><body><h1>主标题</h1><p>正文内容</p><script>bad()</script></body></html>",
        "utf8",
      ),
    );

    expect(text).toContain("网页标题");
    expect(text).toContain("正文内容");
    expect(text).not.toContain("bad()");
  });

  it("extracts spreadsheet rows from XLSX", async () => {
    const buffer = await createXlsxBuffer([
      ["名称", "用途"],
      ["DocPilot", "资料中枢"],
    ]);

    const text = await extractTextFromBuffer("xlsx", buffer);

    expect(text).toContain("# 工具");
    expect(text).toContain("DocPilot");
    expect(text).toContain("资料中枢");
  });

  it("extracts slide text from PPTX", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      '<p:sld><p:cSld><p:spTree><a:t>第一页标题</a:t><a:t>关键结论</a:t></p:spTree></p:cSld></p:sld>',
    );
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const text = await extractTextFromBuffer("pptx", buffer);

    expect(text).toContain("# Slide 1");
    expect(text).toContain("第一页标题");
    expect(text).toContain("关键结论");
  });

  it("extracts raw CSV text", async () => {
    const text = await extractTextFromBuffer(
      "csv",
      Buffer.from("name,value\nDocPilot,AI资料", "utf8"),
    );

    expect(text).toContain("DocPilot");
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
    '<workbook><sheets><sheet name="工具" sheetId="1" r:id="rId1"/></sheets></workbook>',
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
