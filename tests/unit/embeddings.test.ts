import { describe, expect, it } from "vitest";
import { createLocalHashEmbedding } from "@/lib/ai/embeddings";

describe("createLocalHashEmbedding", () => {
  it("creates a stable normalized vector with the expected dimensions", () => {
    const first = createLocalHashEmbedding("退款规则和售后政策");
    const second = createLocalHashEmbedding("退款规则和售后政策");

    expect(first).toHaveLength(1536);
    expect(second).toEqual(first);

    const magnitude = Math.sqrt(
      first.reduce((sum, value) => sum + value * value, 0),
    );
    expect(magnitude).toBeCloseTo(1, 8);
  });

  it("keeps empty text searchable with a non-zero vector", () => {
    const embedding = createLocalHashEmbedding("");

    expect(embedding).toHaveLength(1536);
    expect(embedding.some((value) => value !== 0)).toBe(true);
  });
});
