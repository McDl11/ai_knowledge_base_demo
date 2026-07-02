import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getServerEnv } from "@/lib/env";
import { runCommand } from "@/lib/video/command-runner";
import { toVideoProcessingError } from "@/lib/video/video-types";

export async function extractAudioFromVideo(input: {
  videoPath: string;
  outputDir: string;
}): Promise<string> {
  const env = getServerEnv();
  const audioPath = join(input.outputDir, "audio.mp3");

  try {
    await runCommand(
      env.VIDEO_FFMPEG_PATH,
      [
        "-y",
        "-i",
        input.videoPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        audioPath,
      ],
      { timeoutMs: 120_000 },
    );
    return audioPath;
  } catch (error) {
    throw toVideoProcessingError(error, {
      stage: "audio",
      code: "audio_extraction_failed",
      message:
        "Audio extraction failed. Make sure ffmpeg is installed and VIDEO_FFMPEG_PATH is correct.",
    });
  }
}

export async function extractVideoFrames(input: {
  videoPath: string;
  outputDir: string;
  intervalSeconds: number;
  maxFrames: number;
}): Promise<string[]> {
  if (input.maxFrames <= 0) {
    return [];
  }

  const env = getServerEnv();
  const framesDir = join(input.outputDir, "frames");
  const outputPattern = join(framesDir, "frame-%03d.jpg");
  await mkdir(framesDir, { recursive: true });

  try {
    await runCommand(
      env.VIDEO_FFMPEG_PATH,
      [
        "-y",
        "-i",
        input.videoPath,
        "-vf",
        `fps=1/${input.intervalSeconds},scale=960:-1`,
        "-frames:v",
        String(input.maxFrames),
        "-q:v",
        "3",
        outputPattern,
      ],
      { timeoutMs: 120_000 },
    );
  } catch (error) {
    throw toVideoProcessingError(error, {
      stage: "frames",
      code: "frame_extraction_failed",
      message:
        "Video frame extraction failed. The video may be audio-only or ffmpeg cannot decode it.",
    });
  }

  const { readdir } = await import("node:fs/promises");
  const files = await readdir(framesDir);
  return files
    .filter((file) => /^frame-\d+\.jpg$/i.test(file))
    .sort()
    .map((file) => join(framesDir, file));
}
