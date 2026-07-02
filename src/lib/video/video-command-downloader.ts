import { access, readdir, stat } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { getServerEnv } from "@/lib/env";
import { runCommand } from "@/lib/video/command-runner";
import type { DownloadedVideo } from "@/lib/video/video-types";
import { VideoProcessingError, toVideoProcessingError } from "@/lib/video/video-types";

const mediaExtensions = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".mkv",
  ".webm",
  ".avi",
  ".mp3",
  ".m4a",
  ".wav",
  ".aac",
  ".ogg",
]);

export interface DownloadVideoInput {
  url: string;
  outputDir: string;
}

export async function downloadVideoWithCommand({
  url,
  outputDir,
}: DownloadVideoInput): Promise<DownloadedVideo> {
  const env = getServerEnv();
  const command = env.DOUYIN_VIDEO_COMMAND?.trim();
  if (!command) {
    throw new VideoProcessingError({
      stage: "configuration",
      code: "douyin_downloader_not_configured",
      message:
        "Douyin downloader is not configured. Set DOUYIN_VIDEO_COMMAND to enable video extraction.",
    });
  }

  const args = buildDownloaderArgs(env.DOUYIN_VIDEO_COMMAND_ARGS, {
    url,
    outputDir,
  });

  try {
    const result = await runCommand(command, args, {
      cwd: process.cwd(),
      timeoutMs: env.DOUYIN_VIDEO_COMMAND_TIMEOUT_MS,
    });
    const fromStdout = await findMediaPathInOutput(result.stdout, outputDir);
    const videoPath = fromStdout ?? (await findNewestMediaFile(outputDir));

    if (!videoPath) {
      throw new VideoProcessingError({
        stage: "download",
        code: "douyin_video_file_not_found",
        message:
          "The downloader finished, but no video or audio file was found in the output directory.",
      });
    }

    return {
      videoPath,
      source: "command",
      stdout: trimForMetadata(result.stdout),
    };
  } catch (error) {
    throw toVideoProcessingError(error, {
      stage: "download",
      code: "douyin_download_failed",
      message: "Douyin video download failed.",
    });
  }
}

export function buildDownloaderArgs(
  rawArgs: string | undefined,
  values: { url: string; outputDir: string },
): string[] {
  const template = parseArgsTemplate(rawArgs);
  return template.map((arg) =>
    arg
      .replaceAll("{url}", values.url)
      .replaceAll("{outputDir}", values.outputDir),
  );
}

function parseArgsTemplate(rawArgs: string | undefined): string[] {
  const trimmed = rawArgs?.trim();
  if (!trimmed) {
    return ["{url}", "{outputDir}"];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (
      Array.isArray(parsed) &&
      parsed.every((value): value is string => typeof value === "string")
    ) {
      return parsed;
    }
  } catch {
    // Fall through to shell-like splitting for simple local setups.
  }

  return splitArgs(trimmed);
}

function splitArgs(input: string): string[] {
  const args: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  for (const match of input.matchAll(pattern)) {
    args.push(match[1] ?? match[2] ?? match[0]);
  }
  return args;
}

async function findMediaPathInOutput(
  output: string,
  outputDir: string,
): Promise<string | null> {
  for (const line of output.split(/\r?\n/).map((item) => item.trim())) {
    const cleaned = line.replace(/^["']|["']$/g, "");
    if (!cleaned || !isMediaPath(cleaned)) {
      continue;
    }

    const candidate = isAbsolute(cleaned)
      ? cleaned
      : resolve(outputDir, cleaned);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function findNewestMediaFile(directory: string): Promise<string | null> {
  const files = await collectMediaFiles(directory);
  if (files.length === 0) {
    return null;
  }

  const withStats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      modifiedAt: (await stat(filePath)).mtimeMs,
    })),
  );

  return withStats.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]
    ?.filePath ?? null;
}

async function collectMediaFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectMediaFiles(entryPath);
      }

      return isMediaPath(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

function isMediaPath(path: string): boolean {
  return mediaExtensions.has(extname(path).toLowerCase());
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function trimForMetadata(output: string): string | undefined {
  const trimmed = output.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length <= 1000) {
    return trimmed;
  }

  return `...${trimmed.slice(-1000)}`;
}
