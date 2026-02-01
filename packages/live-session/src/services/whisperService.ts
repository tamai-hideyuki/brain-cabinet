import pino from "pino";

const log = pino({ name: "whisper-service" });

const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || "http://localhost:8178";

/**
 * whisper.cppサーバーにWAV音声を送って文字起こしを取得
 */
export async function transcribe(wavBuffer: Buffer): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(wavBuffer)], { type: "audio/wav" }),
    "audio.wav"
  );
  formData.append("response_format", "json");
  formData.append("language", "ja");

  const res = await fetch(`${WHISPER_SERVER_URL}/inference`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper server error: ${res.status} ${body}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  log.info({ textLength: text.length }, "Whisper transcription complete");
  return { text };
}

/**
 * whisper.cppサーバーの死活確認
 */
export async function checkWhisperHealth(): Promise<boolean> {
  try {
    const res = await fetch(WHISPER_SERVER_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
