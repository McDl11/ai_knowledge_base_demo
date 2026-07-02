export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export interface ChunkTextOptions {
  maxChars?: number;
  overlapChars?: number;
}

const defaultMaxChars = 1200;
const defaultOverlapChars = 180;

export function chunkText(
  text: string,
  options: ChunkTextOptions = {},
): TextChunk[] {
  const maxChars = options.maxChars ?? defaultMaxChars;
  const overlapChars = Math.min(options.overlapChars ?? defaultOverlapChars, maxChars - 1);
  const normalizedText = text.trim();
  if (!normalizedText) {
    return [];
  }

  const chunks: string[] = [];
  const paragraphs = normalizedText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongText(paragraph, maxChars, overlapChars));
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.map((content, chunkIndex) => ({
    chunkIndex,
    content,
    tokenCount: estimateTokenCount(content),
  }));
}

function splitLongText(
  text: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) {
      break;
    }
    start = end - overlapChars;
  }

  return chunks.filter(Boolean);
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 1.6);
}
