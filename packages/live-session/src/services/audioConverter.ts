import { execFile } from "child_process";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import os from "os";

/**
 * webm/opus → 16kHz mono WAV に変換（whisper.cpp用）
 * ffmpegが必要
 */
export async function webmToWav(webmBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = randomUUID();
  const inputPath = join(tmpDir, `whisper-${id}.webm`);
  const outputPath = join(tmpDir, `whisper-${id}.wav`);

  await writeFile(inputPath, webmBuffer);

  await new Promise<void>((resolve, reject) => {
    execFile(
      "ffmpeg",
      [
        "-i", inputPath,
        "-ar", "16000",   // 16kHz（whisper.cppの要求）
        "-ac", "1",        // モノラル
        "-sample_fmt", "s16", // 16-bit PCM
        "-f", "wav",
        "-y",
        outputPath,
      ],
      { timeout: 10000 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`ffmpeg error: ${stderr || err.message}`));
        } else {
          resolve();
        }
      }
    );
  });

  const wavBuffer = await readFile(outputPath);

  // cleanup
  await unlink(inputPath).catch(() => {});
  await unlink(outputPath).catch(() => {});

  return wavBuffer;
}
