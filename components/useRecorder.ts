"use client";

/**
 * Audio capture (§17.4, FR-04, FR-05).
 *
 * Tap-to-start / tap-to-stop, turn-based. Hold-to-talk was ruled out on a physical constraint,
 * not a preference: Grace is holding a phone, a baby sling, and sometimes a register. A held
 * finger for ninety seconds is not available.
 *
 * The live amplitude meter is not decoration. It is the only element that proves the microphone
 * is picking her up, and it does that job for the mother watching the screen as much as for the
 * CHP — which is why §16.5a calls it the affordance that matters. It never leaves the browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Sahara's sync endpoint caps at 120 s. 110 s hard stop with a 100 s warning gives headroom. */
export const MAX_DURATION_MS = 110_000;
export const WARN_AT_MS = 100_000;

/** Below this normalised amplitude for LOW_LEVEL_WINDOW_MS, we hint. Non-blocking, always. */
const LOW_LEVEL_FLOOR = 0.08;
const LOW_LEVEL_WINDOW_MS = 5_000;
const MIN_DURATION_FOR_HINT_MS = 8_000;

export type RecorderState = "idle" | "requesting" | "recording" | "denied" | "unsupported";

export interface RecorderResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
}

export function useRecorder(onComplete: (result: RecorderResult) => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  /** 0–1, smoothed. Drives the 12-segment meter. */
  const [level, setLevel] = useState(0);
  const [lowLevelHint, setLowLevelHint] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const lowSinceRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setLevel(0);
    lowSinceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }

    setState("requesting");
    setLowLevelHint(false);
    setElapsedMs(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // 16 kHz mono target (§17.4). Browsers may ignore these; Sahara accepts what we send.
          channelCount: 1,
          sampleRate: 16_000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      // FR-04: mic-permission denial produces a specific instruction card, never a generic error.
      setState("denied");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      cleanup();
      setState("idle");
      setElapsedMs(0);
      onCompleteRef.current({ blob, durationMs, mimeType: recorder.mimeType || "audio/webm" });
    };

    // AnalyserNode drives the meter. This audio never leaves the browser.
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    startedAtRef.current = Date.now();
    recorder.start(250);
    setState("recording");

    const tick = () => {
      const now = Date.now();
      const elapsed = now - startedAtRef.current;
      setElapsedMs(elapsed);

      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      // Smoothed so the meter reads as a level, not a strobe.
      setLevel((prev) => prev * 0.7 + Math.min(1, rms * 3) * 0.3);

      // Pre-emptive quality feedback (§5.6): warn BEFORE the mother has spoken for two minutes
      // into a useless recording, never after.
      if (rms < LOW_LEVEL_FLOOR) {
        if (lowSinceRef.current === null) lowSinceRef.current = now;
        else if (now - lowSinceRef.current > LOW_LEVEL_WINDOW_MS && elapsed > MIN_DURATION_FOR_HINT_MS) {
          setLowLevelHint(true);
        }
      } else {
        lowSinceRef.current = null;
      }

      if (elapsed >= MAX_DURATION_MS) {
        // Auto-stop. The turn is preserved and the CHP is prompted to continue in a new turn —
        // it is never discarded.
        stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [cleanup, stop]);

  /** Abandon the turn without producing a result — used when consent is withdrawn mid-record. */
  const abort = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) rec.onstop = null;
    if (rec && rec.state !== "inactive") rec.stop();
    cleanup();
    setState("idle");
    setElapsedMs(0);
  }, [cleanup]);

  return {
    state,
    elapsedMs,
    level,
    lowLevelHint,
    nearLimit: elapsedMs >= WARN_AT_MS,
    remainingMs: Math.max(0, MAX_DURATION_MS - elapsedMs),
    start,
    stop,
    abort,
  };
}

/** Sahara accepts WAV, MP3, MP4, M4A, OGG, WebM and FLAC, so no client-side conversion is needed. */
function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
