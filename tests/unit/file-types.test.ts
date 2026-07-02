import { describe, expect, it } from "vitest";
import {
  detectKnowledgeFileType,
  isSupportedKnowledgeFile,
} from "@/lib/knowledge/file-types";

describe("detectKnowledgeFileType", () => {
  it("accepts document, table, slide, html, and image extensions", () => {
    expect(detectKnowledgeFileType("notes.txt", "")?.type).toBe("text");
    expect(detectKnowledgeFileType("guide.md", "")?.type).toBe("markdown");
    expect(detectKnowledgeFileType("guide.markdown", "")?.type).toBe(
      "markdown",
    );
    expect(detectKnowledgeFileType("manual.pdf", "")?.type).toBe("pdf");
    expect(detectKnowledgeFileType("brief.docx", "")?.type).toBe("docx");
    expect(detectKnowledgeFileType("table.xlsx", "")?.type).toBe("xlsx");
    expect(detectKnowledgeFileType("slides.pptx", "")?.type).toBe("pptx");
    expect(detectKnowledgeFileType("data.csv", "")?.type).toBe("csv");
    expect(detectKnowledgeFileType("page.html", "")?.type).toBe("html");
    expect(detectKnowledgeFileType("screen.png", "")?.type).toBe("image");
  });

  it("maps supported MIME types to knowledge item types", () => {
    expect(detectKnowledgeFileType("upload", "text/plain")?.type).toBe("text");
    expect(detectKnowledgeFileType("upload", "text/markdown")?.type).toBe(
      "markdown",
    );
    expect(detectKnowledgeFileType("upload", "application/pdf")?.type).toBe(
      "pdf",
    );
    expect(
      detectKnowledgeFileType(
        "upload",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )?.type,
    ).toBe("docx");
    expect(
      detectKnowledgeFileType(
        "upload",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      )?.type,
    ).toBe("xlsx");
    expect(detectKnowledgeFileType("upload", "text/html")?.type).toBe("html");
  });

  it("rejects unsupported archive files", () => {
    expect(
      detectKnowledgeFileType(
        "archive.zip",
        "application/zip",
      ),
    ).toBeNull();
    expect(isSupportedKnowledgeFile("archive.zip", "")).toBe(false);
  });
});
