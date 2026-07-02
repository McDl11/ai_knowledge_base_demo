import { describe, expect, it } from "vitest";
import { formatCitationSummary } from "@/lib/rag/citations";

describe("formatCitationSummary", () => {
  it("truncates long citations", () => {
    expect(formatCitationSummary("这是一段很长很长的引用内容", 8)).toBe(
      "这是一段很...",
    );
  });

  it("does not truncate short citations", () => {
    expect(formatCitationSummary("短引用", 8)).toBe("短引用");
  });

  it("collapses repeated whitespace", () => {
    expect(formatCitationSummary("本产品   支持\n退款", 20)).toBe(
      "本产品 支持 退款",
    );
  });
});
