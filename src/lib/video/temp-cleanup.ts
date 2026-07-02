import { readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

export const videoTempPrefix = "docpilot-video-";
const defaultMaxAgeMs = 24 * 60 * 60 * 1000;

export interface CleanupVideoTempDirsResult {
  scanned: number;
  removed: string[];
  failed: Array<{ path: string; message: string }>;
}

export async function cleanupStaleVideoTempDirs(
  maxAgeMs = defaultMaxAgeMs,
  now = Date.now(),
): Promise<CleanupVideoTempDirsResult> {
  const result: CleanupVideoTempDirsResult = {
    scanned: 0,
    removed: [],
    failed: [],
  };

  let entries: string[] = [];
  try {
    entries = await readdir(tmpdir());
  } catch (error) {
    result.failed.push({
      path: tmpdir(),
      message: error instanceof Error ? error.message : "Cannot read temp dir.",
    });
    return result;
  }

  for (const entry of entries) {
    if (!entry.startsWith(videoTempPrefix)) {
      continue;
    }

    const fullPath = join(tmpdir(), entry);
    result.scanned += 1;

    try {
      const info = await stat(fullPath);
      if (!info.isDirectory() || now - info.mtimeMs < maxAgeMs) {
        continue;
      }

      await rm(fullPath, { recursive: true, force: true });
      result.removed.push(fullPath);
    } catch (error) {
      result.failed.push({
        path: fullPath,
        message:
          error instanceof Error
            ? error.message
            : `Failed to remove ${basename(fullPath)}.`,
      });
    }
  }

  return result;
}
