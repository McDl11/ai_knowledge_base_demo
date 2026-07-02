import { describe, expect, it } from "vitest";
import { extractTranscriptionText } from "@/lib/ai/audio-transcription";

describe("extractTranscriptionText", () => {
  it("reads text from the OpenAI transcription object shape", () => {
    expect(extractTranscriptionText({ text: "  hello audio  " })).toBe(
      "hello audio",
    );
  });

  it("reads text when a compatible provider returns a plain string", () => {
    expect(extractTranscriptionText("  hello audio  ")).toBe("hello audio");
  });

  it("throws a clear error when no text is present", () => {
    expect(() => extractTranscriptionText({})).toThrow(
      "Audio transcription response did not include text.",
    );
  });
});
