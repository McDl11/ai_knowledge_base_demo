import { describe, expect, it } from "vitest";
import { isToolMaterial, normalizeTags } from "@/lib/assets/asset-types";

describe("asset types", () => {
  it("normalizes duplicated tags", () => {
    expect(normalizeTags([" AI ", "工具", "ai", "工具"])).toEqual([
      "ai",
      "工具",
    ]);
  });

  it("detects tool materials", () => {
    expect(isToolMaterial({ type: "tool" })).toBe(true);
    expect(isToolMaterial({ type: "idea" })).toBe(false);
  });
});
