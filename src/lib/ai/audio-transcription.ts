import { createReadStream } from "node:fs";
import { createOpenAIClient } from "@/lib/ai/openai-client";
import { getServerEnv } from "@/lib/env";
import { toVideoProcessingError } from "@/lib/video/video-types";

export async function transcribeAudioFile(audioPath: string): Promise<string> {
  const env = getServerEnv();
  const client = createOpenAIClient();

  try {
    const response = await client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: env.VIDEO_AUDIO_TRANSCRIPTION_MODEL,
      response_format: "json",
      temperature: 0,
    });

    return extractTranscriptionText(response);
  } catch (error) {
    throw toVideoProcessingError(error, {
      stage: "transcription",
      code: "audio_transcription_failed",
      message: "Audio transcription failed.",
    });
  }
}

export function extractTranscriptionText(response: unknown): string {
  if (typeof response === "string") {
    return response.trim();
  }

  if (response && typeof response === "object" && "text" in response) {
    const text = (response as { text?: unknown }).text;
    if (typeof text === "string") {
      return text.trim();
    }
  }

  throw new Error("Audio transcription response did not include text.");
}
