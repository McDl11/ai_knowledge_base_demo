import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupStaleVideoTempDirs,
  videoTempPrefix,
} from "@/lib/video/temp-cleanup";

const createdPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdPaths.map((path) => rm(path, { recursive: true, force: true })),
  );
  createdPaths.length = 0;
});

describe("cleanupStaleVideoTempDirs", () => {
  it("removes stale DocPilot video temp directories only", async () => {
    const staleDir = await mkdtemp(join(tmpdir(), videoTempPrefix));
    const freshDir = await mkdtemp(join(tmpdir(), videoTempPrefix));
    const unrelatedDir = await mkdtemp(join(tmpdir(), "docpilot-other-"));
    createdPaths.push(staleDir, freshDir, unrelatedDir);

    await writeFile(join(staleDir, "video.mp4"), "stale");
    await writeFile(join(freshDir, "video.mp4"), "fresh");
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await utimes(staleDir, oldDate, oldDate);

    const result = await cleanupStaleVideoTempDirs(24 * 60 * 60 * 1000);

    expect(result.removed).toContain(staleDir);
    expect(result.removed).not.toContain(freshDir);
    expect(result.removed).not.toContain(unrelatedDir);
  });
});
