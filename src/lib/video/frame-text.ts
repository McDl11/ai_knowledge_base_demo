import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractImageText } from "@/lib/ai/image-text";
import type { FrameText } from "@/lib/video/video-types";

export async function extractFrameTexts(framePaths: string[]): Promise<FrameText[]> {
  const results: FrameText[] = [];

  for (const [index, framePath] of framePaths.entries()) {
    try {
      const buffer = await readFile(framePath);
      const text = await extractImageText({
        buffer,
        fileName: basename(framePath),
        mimeType: "image/jpeg",
      });

      if (text.trim()) {
        results.push({
          index: index + 1,
          framePath,
          text: text.trim(),
        });
      }
    } catch {
      // One weak frame should not block the whole video knowledge extraction.
    }
  }

  return results;
}
