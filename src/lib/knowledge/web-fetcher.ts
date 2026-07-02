import * as cheerio from "cheerio";
import { extractHtmlText } from "@/lib/knowledge/text-extractors";

const maxHtmlBytes = 1_000_000;

export interface FetchedWebPage {
  url: string;
  title?: string;
  text: string;
}

export async function fetchWebPageText(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedWebPage | null> {
  const parsedUrl = parseHttpUrl(url);
  if (!parsedUrl) {
    return null;
  }

  const response = await fetchImpl(parsedUrl.toString(), {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "DocPilot/1.0 (+local knowledge ingestion)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().includes("text/html")) {
    return null;
  }

  const html = await readLimitedText(response);
  const text = extractHtmlText(html);
  if (!text) {
    return null;
  }

  return {
    url: response.url || parsedUrl.toString(),
    title: extractTitle(html),
    text,
  };
}

function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    totalLength += value.byteLength;
    if (totalLength > maxHtmlBytes) {
      throw new Error("网页内容过大，暂时无法自动抓取。");
    }
    chunks.push(value);
  }

  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

function extractTitle(html: string): string | undefined {
  const $ = cheerio.load(html);
  const title =
    $("meta[property='og:title']").attr("content") ??
    $("meta[name='twitter:title']").attr("content") ??
    $("title").first().text();

  return title?.trim() || undefined;
}
