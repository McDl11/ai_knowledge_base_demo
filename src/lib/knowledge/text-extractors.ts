import { PDFParse } from "pdf-parse";
import * as cheerio from "cheerio";
import JSZip from "jszip";
import mammoth from "mammoth";
import { extractImageText } from "@/lib/ai/image-text";
import type { KnowledgeItemType } from "@/lib/domain";

export async function extractTextFromBuffer(
  type: KnowledgeItemType,
  buffer: Buffer,
  options?: { fileName?: string; mimeType?: string },
): Promise<string> {
  if (type === "text" || type === "markdown") {
    return buffer.toString("utf8").trim();
  }

  if (type === "csv") {
    return buffer.toString("utf8").trim();
  }

  if (type === "html") {
    return extractHtmlText(buffer.toString("utf8"));
  }

  if (type === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  if (type === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (type === "xlsx") {
    return extractSpreadsheetText(buffer);
  }

  if (type === "pptx") {
    return extractPresentationText(buffer);
  }

  if (type === "image") {
    const text = await extractImageText({
      buffer,
      fileName: options?.fileName ?? "image",
      mimeType: options?.mimeType ?? "image/png",
    });
    if (!text) {
      throw new Error("图片内容识别失败，请换一张更清晰的图片再试。");
    }

    return text;
  }

  throw new Error(`Unsupported knowledge item type: ${type}`);
}

export function extractHtmlText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const title = $("title").first().text().trim();
  const headings = $("h1, h2, h3")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);
  const paragraphs = $("p, li, th, td")
    .map((_, element) => $(element).text().trim())
    .get()
    .filter(Boolean);

  return [title, ...headings, ...paragraphs].join("\n").trim();
}

async function extractSpreadsheetText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await readSharedStrings(zip);
  const sheetNames = await readWorkbookSheetNames(zip);
  const worksheetFiles = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(compareSheetNames);

  const sheets = await Promise.all(
    worksheetFiles.map(async (name, index) => {
      const file = zip.file(name);
      if (!file) {
        return "";
      }

      const xml = await file.async("string");
      const rows = extractSheetRows(xml, sharedStrings);
      const title = sheetNames[index] ?? `Sheet ${index + 1}`;
      return [`# ${title}`, ...rows].join("\n").trim();
    }),
  );

  return sheets
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function extractPresentationText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort(compareSlideNames);

  const slides = await Promise.all(
    slideFiles.map(async (name, index) => {
      const file = zip.file(name);
      if (!file) {
        return "";
      }

      const xml = await file.async("string");
      const text = extractXmlText(xml);
      return text ? `# Slide ${index + 1}\n${text}` : "";
    }),
  );

  return slides.filter(Boolean).join("\n\n").trim();
}

function extractXmlText(xml: string): string {
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXmlEntities(match[1] ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const file = zip.file("xl/sharedStrings.xml");
  if (!file) {
    return [];
  }

  const xml = await file.async("string");
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    extractSpreadsheetTextTags(match[1] ?? ""),
  );
}

async function readWorkbookSheetNames(zip: JSZip): Promise<string[]> {
  const file = zip.file("xl/workbook.xml");
  if (!file) {
    return [];
  }

  const xml = await file.async("string");
  return [...xml.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map((match) =>
    decodeXmlEntities(match[1] ?? ""),
  );
}

function extractSheetRows(xml: string, sharedStrings: string[]): string[] {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)]
    .map((rowMatch) => {
      const cells = [
        ...(rowMatch[1] ?? "").matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g),
      ]
        .map((cellMatch) =>
          extractCellValue(cellMatch[1] ?? "", cellMatch[2] ?? "", sharedStrings),
        )
        .filter((cell) => cell.length > 0);

      return cells.join(",");
    })
    .filter((row) => row.length > 0);
}

function extractCellValue(
  attributes: string,
  cellXml: string,
  sharedStrings: string[],
): string {
  const inlineString = cellXml.match(/<is>([\s\S]*?)<\/is>/);
  if (inlineString) {
    return extractSpreadsheetTextTags(inlineString[1] ?? "");
  }

  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  if (!value) {
    return "";
  }

  if (/\bt="s"/.test(attributes)) {
    return sharedStrings[Number(value)] ?? "";
  }

  return decodeXmlEntities(value);
}

function extractSpreadsheetTextTags(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXmlEntities(match[1] ?? "").trim())
    .filter(Boolean)
    .join("");
}

function decodeXmlEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function compareSlideNames(left: string, right: string): number {
  return getSlideNumber(left) - getSlideNumber(right);
}

function getSlideNumber(name: string): number {
  const match = name.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function compareSheetNames(left: string, right: string): number {
  return getSheetNumber(left) - getSheetNumber(right);
}

function getSheetNumber(name: string): number {
  const match = name.match(/sheet(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}
