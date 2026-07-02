import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/knowledge/chunk-text";

describe("chunkText", () => {
  it("splits paragraphs into multiple chunks", () => {
    const chunks = chunkText("第一段内容。\n\n第二段内容。", {
      maxChars: 10,
      overlapChars: 2,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
  });

  it("splits long text by fixed length", () => {
    const chunks = chunkText("a".repeat(25), {
      maxChars: 10,
      overlapChars: 2,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.content).toHaveLength(10);
    expect(chunks[1]?.content.length).toBeLessThanOrEqual(10);
  });

  it("keeps overlap when splitting long text", () => {
    const chunks = chunkText("abcdefghijklmnopqrstuvwxyz", {
      maxChars: 10,
      overlapChars: 3,
    });

    expect(chunks[0]?.content.slice(-3)).toBe(chunks[1]?.content.slice(0, 3));
  });
});
