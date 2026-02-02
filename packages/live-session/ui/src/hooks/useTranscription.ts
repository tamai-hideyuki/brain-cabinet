import { useRef, useState, useCallback } from "react";
import { API_BASE } from "../config";

export type TranscriptionEngine = "whisper" | "webspeech";
export type AudioSource = "mic" | "system" | "both";

interface TranscriptionCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string, confidence: number) => void;
  onError: (error: string) => void;
  onAudioChunk: (blob: Blob) => void;
}

/**
 * 音声文字起こしhook
 * - whisper: MediaRecorderで30秒チャンク → サーバーのWhisper.cppで処理（高精度）
 * - webspeech: Web Speech API（フォールバック）
 */
export function useTranscription(callbacks: TranscriptionCallbacks) {
  const [isListening, setIsListening] = useState(false);
  const [engine, setEngine] = useState<TranscriptionEngine>("whisper");
  const [source, setSource] = useState<AudioSource>("mic");
  const isListeningRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const callbacksRef = useRef(callbacks);
  const streamRef = useRef<MediaStream | null>(null);
  const extraStreamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  callbacksRef.current = callbacks;

  // === Whisperモード: MediaRecorderで30秒チャンク ===

  const captureChunk = useCallback(() => {
    if (!isListeningRef.current || !streamRef.current) return;

    let mimeType = "audio/webm;codecs=opus";
    if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "audio/webm";
    }

    const recorder = new MediaRecorder(streamRef.current, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && isListeningRef.current) {
        callbacksRef.current.onAudioChunk(e.data);
        callbacksRef.current.onInterim("文字起こし中...");
      }
    };

    recorder.onstop = () => {
      if (isListeningRef.current) {
        captureChunk();
      }
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 30000);
  }, []);

  const startWhisper = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      startTimeRef.current = Date.now();
      isListeningRef.current = true;
      setIsListening(true);
      setEngine("whisper");
      setSource("mic");
      captureChunk();
    } catch (err) {
      callbacksRef.current.onError(
        `マイクアクセスエラー: ${(err as Error).message}`
      );
    }
  }, [captureChunk]);

  // === Web Speech APIモード（フォールバック） ===

  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      callbacksRef.current.onError(
        "Web Speech APIがサポートされていません（Chromeを使用してください）"
      );
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          callbacksRef.current.onFinal(text, confidence);
        } else {
          callbacksRef.current.onInterim(text);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      callbacksRef.current.onError(`音声認識エラー: ${event.error}`);
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        setTimeout(() => {
          if (isListeningRef.current) {
            const newRecognition = createRecognition();
            if (newRecognition) {
              recognitionRef.current = newRecognition;
              newRecognition.start();
            }
          }
        }, 100);
      }
    };

    return recognition;
  }, []);

  const startWebSpeech = useCallback(() => {
    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    startTimeRef.current = Date.now();
    isListeningRef.current = true;
    setIsListening(true);
    setEngine("webspeech");
    recognition.start();
  }, [createRecognition]);

  // === システム音声モード: getDisplayMediaで画面音声をキャプチャ ===

  const startSystemAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // 音声トラックを先に取り出してから映像を停止
      const audioTracks = stream.getAudioTracks();
      const audioStream = new MediaStream(audioTracks);
      stream.getVideoTracks().forEach((t) => t.stop());

      if (audioTracks.length === 0) {
        callbacksRef.current.onError(
          "システム音声が選択されませんでした。共有時に「タブの音声」を有効にしてください。"
        );
        return;
      }

      streamRef.current = audioStream;
      startTimeRef.current = Date.now();
      isListeningRef.current = true;
      setIsListening(true);
      setEngine("whisper");
      setSource("system");
      captureChunk();

      audioTracks[0].onended = () => {
        isListeningRef.current = false;
      };
    } catch (err) {
      callbacksRef.current.onError(
        `システム音声キャプチャエラー: ${(err as Error).message}`
      );
    }
  }, [captureChunk]);

  // === 両方モード: マイク + システム音声をミックス ===

  const startBoth = useCallback(async () => {
    console.log("[startBoth] called");
    try {
      // 1. マイク取得
      console.log("[startBoth] requesting mic...");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      console.log("[startBoth] mic OK, tracks:", micStream.getAudioTracks().length);
      // 2. システム音声取得
      console.log("[startBoth] requesting displayMedia...");
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      console.log("[startBoth] displayMedia OK, audio:", displayStream.getAudioTracks().length, "video:", displayStream.getVideoTracks().length);
      // 音声トラックを先に取り出してから映像を停止
      const systemAudioTracks = displayStream.getAudioTracks();
      displayStream.getVideoTracks().forEach((t) => t.stop());
      if (systemAudioTracks.length === 0) {
        micStream.getTracks().forEach((t) => t.stop());
        callbacksRef.current.onError(
          "システム音声が選択されませんでした。共有時に「タブの音声」を有効にしてください。"
        );
        return;
      }

      // 3. AudioContextでミックス
      const ctx = new AudioContext();
      await ctx.resume(); // ブラウザがsuspendしている場合に必要
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(micStream).connect(dest);
      ctx.createMediaStreamSource(new MediaStream(systemAudioTracks)).connect(dest);

      console.log("[startBoth] AudioContext state:", ctx.state, "dest tracks:", dest.stream.getAudioTracks().length);
      audioContextRef.current = ctx;
      extraStreamsRef.current = [micStream, displayStream];
      streamRef.current = dest.stream;
      startTimeRef.current = Date.now();
      isListeningRef.current = true;
      setIsListening(true);
      setEngine("whisper");
      setSource("both");
      console.log("[startBoth] starting captureChunk");
      captureChunk();

      // システム音声共有停止時
      systemAudioTracks[0].onended = () => {
        isListeningRef.current = false;
      };
    } catch (err) {
      console.error("[startBoth] error:", err);
      callbacksRef.current.onError(
        `音声キャプチャエラー: ${(err as Error).message}`
      );
    }
  }, [captureChunk]);

  // === 公開API ===

  const stop = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    for (const s of extraStreamsRef.current) {
      s.getTracks().forEach((t) => t.stop());
    }
    extraStreamsRef.current = [];

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const start = useCallback(async (audioSource: AudioSource = "mic") => {
    console.log("[start] called with:", audioSource);
    if (audioSource === "both") {
      await startBoth();
      return;
    }
    if (audioSource === "system") {
      await startSystemAudio();
      return;
    }

    // Whisperサーバーが利用可能か確認
    try {
      const res = await fetch(`${API_BASE}/whisper/health`);
      const data = (await res.json()) as { available: boolean };
      if (data.available) {
        await startWhisper();
        return;
      }
    } catch {
      // ignore
    }
    callbacksRef.current.onError(
      "Whisperサーバー未起動 → Web Speech APIで文字起こし中"
    );
    startWebSpeech();
  }, [startWhisper, startWebSpeech, startSystemAudio, startBoth]);

  const getElapsedMs = useCallback(() => {
    return Date.now() - startTimeRef.current;
  }, []);

  return { isListening, engine, source, start, stop, getElapsedMs };
}
