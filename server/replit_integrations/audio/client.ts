import { Buffer } from "node:buffer";
import { spawn, execSync } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

export function isTranscriptionConfigured(): boolean {
  return !!process.env.ASSEMBLYAI_API_KEY;
}

let _ffmpegAvailable: boolean | null = null;

export function isFfmpegAvailable(): boolean {
  if (_ffmpegAvailable === null) {
    try {
      execSync("which ffmpeg", { stdio: "ignore" });
      _ffmpegAvailable = true;
    } catch {
      _ffmpegAvailable = false;
    }
  }
  return _ffmpegAvailable;
}

export type AudioFormat = "wav" | "mp3" | "webm" | "mp4" | "ogg" | "unknown";

/**
 * Detect audio format from buffer magic bytes.
 * Supports: WAV, MP3, WebM (Chrome/Firefox), MP4/M4A/MOV (Safari/iOS), OGG
 */
export function detectAudioFormat(buffer: Buffer): AudioFormat {
  if (buffer.length < 12) return "unknown";

  // WAV: RIFF....WAVE
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return "wav";
  }
  // WebM: EBML header
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "webm";
  }
  // MP3: ID3 tag or frame sync
  if (
    (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa || buffer[1] === 0xf3)) ||
    (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33)
  ) {
    return "mp3";
  }
  // MP4/M4A/MOV: ....ftyp (Safari/iOS records in these containers)
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return "mp4";
  }
  // OGG: OggS
  if (buffer[0] === 0x4f && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
    return "ogg";
  }
  return "unknown";
}

/**
 * Convert any audio/video format to WAV using ffmpeg.
 * Uses temp files instead of pipes because video containers (MP4/MOV)
 * require seeking to find the audio track.
 */
export async function convertToWav(audioBuffer: Buffer): Promise<Buffer> {
  if (!isFfmpegAvailable()) {
    throw new Error("ffmpeg is not installed or not available on PATH. Audio conversion requires ffmpeg.");
  }

  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);

      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on("error", reject);
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Auto-detect and ensure audio is in a compatible format for AssemblyAI.
 * - WAV/MP3/WebM: Pass through (already compatible)
 * - MP4/OGG: Convert to WAV via ffmpeg if available, otherwise pass through directly
 * - Unknown: Convert via ffmpeg if available, otherwise send as webm (best-guess fallback)
 */
export async function ensureCompatibleFormat(
  audioBuffer: Buffer
): Promise<{ buffer: Buffer; format: "wav" | "mp3" | "webm" | "mp4" | "ogg" }> {
  const detected = detectAudioFormat(audioBuffer);
  if (detected === "wav") return { buffer: audioBuffer, format: "wav" };
  if (detected === "mp3") return { buffer: audioBuffer, format: "mp3" };
  if (detected === "webm") return { buffer: audioBuffer, format: "webm" };

  if (detected === "unknown") {
    if (isFfmpegAvailable()) {
      const wavBuffer = await convertToWav(audioBuffer);
      return { buffer: wavBuffer, format: "wav" };
    }
    console.warn(
      "ffmpeg not available and audio format unrecognized; sending to AssemblyAI as webm (best-guess fallback)"
    );
    return { buffer: audioBuffer, format: "webm" };
  }

  if (isFfmpegAvailable()) {
    const wavBuffer = await convertToWav(audioBuffer);
    return { buffer: wavBuffer, format: "wav" };
  }

  console.warn(
    `ffmpeg not available; sending ${detected} audio directly to AssemblyAI without conversion`
  );
  return { buffer: audioBuffer, format: detected };
}

/**
 * Speech-to-Text via AssemblyAI REST API.
 * Uploads audio, starts transcription, polls until complete.
 */
export async function speechToText(audioBuffer: Buffer): Promise<string> {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }

  // Step 1: Upload audio file
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: audioBuffer,
  });
  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    throw new Error(`[AssemblyAI] Upload failed (${uploadRes.status}): ${body}`);
  }
  const { upload_url } = await uploadRes.json() as { upload_url: string };

  // Step 2: Start transcription
  const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audio_url: upload_url, speech_models: ["universal-2"] }),
  });
  if (!transcriptRes.ok) {
    const body = await transcriptRes.text();
    throw new Error(`[AssemblyAI] Transcript request failed (${transcriptRes.status}): ${body}`);
  }
  const { id } = await transcriptRes.json() as { id: string };

  // Step 3: Poll until completed (max 3 minutes)
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${id}`;
  const maxPolls = 120;
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const pollRes = await fetch(pollUrl, {
      headers: { "Authorization": apiKey },
    });
    if (!pollRes.ok) {
      const body = await pollRes.text();
      throw new Error(`[AssemblyAI] Poll failed (${pollRes.status}): ${body}`);
    }
    const result = await pollRes.json() as { status: string; text?: string; error?: string };
    if (result.status === "completed") {
      return result.text ?? "";
    }
    if (result.status === "error") {
      throw new Error(`[AssemblyAI] Transcription error: ${result.error}`);
    }
  }
  throw new Error("Transcription timed out after 3 minutes");
}
