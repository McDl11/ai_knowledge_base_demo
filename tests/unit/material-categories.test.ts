import { describe, expect, it } from "vitest";
import { parseMaterialCategoryReply } from "@/lib/knowledge/material-categories";

describe("parseMaterialCategoryReply", () => {
  it("detects category names from natural replies", () => {
    expect(parseMaterialCategoryReply("这是工具")).toBe("tool");
    expect(parseMaterialCategoryReply("归到项目资料")).toBe("project_doc");
    expect(parseMaterialCategoryReply("这个算竞品")).toBe("competitor");
    expect(parseMaterialCategoryReply("先当待办任务")).toBe("todo");
  });

  it("returns null when the reply does not mention a category", () => {
    expect(parseMaterialCategoryReply("我再看看")).toBeNull();
  });
});
