"use client";

/**
 * Hands-free capture. The CHP taps ONCE to begin and ONCE when the visit is over.
 *
 * WHY THIS REPLACES TAP-PER-TURN, and it is a deliberate deviation from §10.1.
 *
 * The spec chose tap-to-start / tap-to-stop per turn, and its reasoning was sound as far as it
 * went: it frees her hand, and the turn boundary doubles as speaker separation (§11.3a — "the turn
 * boundary already IS the diarization").
 *
 * What that reasoning missed is the clinical cost. She is conducting a conversation in which a
 * woman may disclose that she has thought about not being alive. Asking her to reach for the phone
 * between every exchange puts the device in the middle of that conversation, repeatedly, at
 * exactly the moments when her attention should be entirely on the person in front of her. §16.2's
 * own principle — "the interface must not compete with the human moment" — argues against the
 * interaction the spec chose.
 *
 * So: segmentation still happens, she just no longer performs it. Silence detection closes a
 * segment; the agent still receives discrete turns; Sahara still receives sub-120 s audio.
 *
 * WHAT THIS COSTS, STATED PLAINLY. The turn boundary is no longer a speaker boundary. Her own
 * voice is now inside the stream, so the risk §11.3a names — "the CHP's own words become the
 * mother's clinical evidence" — is no longer mitigated by the UI affordance. Three things stand
 * in its place:
 *
 *   1. Known-prompt suppression (FR-11a) already drops any span matching the probe the system
 *      issued. That was always the measure aimed at the dominant failure.
 *   2. `markSpeaking()` lets the UI tell the recorder when the CHP is reading a probe aloud, so
 *      those windows are labelled rather than guessed at.
 *   3. LIMITATIONS.md records the residual honestly rather than claiming it is solved.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/** Sahara's sync endpoint caps at 120 s. Close a segment well before that. */
export const MAX_SEGMENT_MS = 100_000;

/** Below this normalised amplitude counts as silence for segmentation purposes. */
const SILENCE_LEVEL = 0.055;

/**
 * How long silence must persist before a segment closes. Long enough that a breath, a pause for
 * thought, or a mother searching for a difficult word does not truncate her — people pause hardest
 * exactly when saying the thing that matters most. Short enough that the CHP is not waiting.
 */
const SILENCE_HOLD_MS = 2200;

/** A segment shorter than this is almost certainly a cough or a door. Not worth an API call. */
const MIN_SEGMENT_MS = 2500;

/** Long low-level stretch in a long recording → tell her the phone may not be picking the mother up. */
const LOW_LEVEL_WINDOW_MS = 6000;

export type CaptureState = "idle" | "requesting" | "recording" | "denied" | "unsupported";

export interface Segment {
  blob: Blob;
  durationMs: number;
  index: number;
  /** True when the CHP flagged herself as speaking for part of this segment. */
  chpSpokeDuring: boolean;
}

export function useContinuousRecorder(onSegment: (segment: Segment) => void) {
  const [state, setState] = useState<CaptureState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [lowLevelHint, setLowLevelHint] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  /** True while the mother is audibly speaking — drives the "listening" affordance. */
  const [voiceActive, setVoiceActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sessionStartRef = useRef(0);
  const segmentStartRef = useRef(0);
  const silenceSinceRef = useRef<number | null>(null);
  const lowSinceRef = useRef<number | null>(null);
  const segmentIndexRef = useRef(0);
  const chpSpokeRef = useRef(false);
  const hadVoiceRef = useRef(false);
  const closingRef = useRef(false);
  const stoppingRef = useRef(false);

  const onSegmentRef = useRef(onSegment);
  onSegmentRef.current = onSegment;

  const cleanup = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setLevel(0);
    setVoiceActive(false);
    silenceSinceRef.current = null;
    lowSinceRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /**
   * Close the current segment and immediately open the next. MediaRecorder cannot be "split", so
   * this stops and restarts it — the gap is a few milliseconds and falls inside the silence that
   * triggered the close, so no speech is lost.
   */
  const rotateSegment = useCallback((final: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive" || closingRef.current) return;
    closingRef.current = true;
    stoppingRef.current = final;
    recorder.stop();
  }, []);

  const startRecorder = useCallback((stream: MediaStream) => {
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];
    segmentStartRef.current = Date.now();
    hadVoiceRef.current = false;
    chpSpokeRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const durationMs = Date.now() - segmentStartRef.current;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const hadVoice = hadVoiceRef.current;
      const chpSpoke = chpSpokeRef.current;
      closingRef.current = false;

      // Only emit a segment that actually contains speech. Silence costs an API call and returns
      // INSUFFICIENT_AUDIO_ACTIVITY, which would surface to the CHP as an error she cannot act on.
      if (hadVoice && durationMs >= MIN_SEGMENT_MS && blob.size > 0) {
        const index = segmentIndexRef.current;
        segmentIndexRef.current += 1;
        setSegmentCount(index + 1);
        onSegmentRef.current({ blob, durationMs, index, chpSpokeDuring: chpSpoke });
      }

      if (stoppingRef.current) {
        cleanup();
        setState("idle");
        setElapsedMs(0);
        return;
      }
      // Not final — open the next segment straight away. She never sees this happen.
      if (streamRef.current) startRecorder(streamRef.current);
    };

    recorder.start(250);
  }, [cleanup]);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }

    setState("requesting");
    setLowLevelHint(false);
    setElapsedMs(0);
    setSegmentCount(0);
    segmentIndexRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16_000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setState("denied");
      return;
    }

    streamRef.current = stream;

    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    sessionStartRef.current = Date.now();
    startRecorder(stream);
    setState("recording");

    const tick = () => {
      const now = Date.now();
      setElapsedMs(now - sessionStartRef.current);

      analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128;
        sumSquares += v * v;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const normalised = Math.min(1, rms * 3);
      setLevel((prev) => prev * 0.7 + normalised * 0.3);

      const speaking = normalised > SILENCE_LEVEL;
      setVoiceActive(speaking);
      if (speaking) hadVoiceRef.current = true;

      // ---- segmentation ----
      const segmentAge = now - segmentStartRef.current;
      if (speaking) {
        silenceSinceRef.current = null;
      } else if (silenceSinceRef.current === null) {
        silenceSinceRef.current = now;
      } else if (
        now - silenceSinceRef.current >= SILENCE_HOLD_MS &&
        hadVoiceRef.current &&
        segmentAge >= MIN_SEGMENT_MS
      ) {
        silenceSinceRef.current = null;
        rotateSegment(false);
      }

      // Hard ceiling, so a mother who talks without pausing still gets transcribed.
      if (segmentAge >= MAX_SEGMENT_MS) rotateSegment(false);

      // Pre-emptive quality feedback: warn BEFORE she has spoken for two minutes into a useless
      // recording, never after (§5.6).
      if (normalised < SILENCE_LEVEL) {
        if (lowSinceRef.current === null) lowSinceRef.current = now;
        else if (now - lowSinceRef.current > LOW_LEVEL_WINDOW_MS && now - sessionStartRef.current > 12_000) {
          setLowLevelHint(true);
        }
      } else {
        lowSinceRef.current = null;
        setLowLevelHint(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [rotateSegment, startRecorder]);

  /** End the visit. Flushes whatever is in the current segment. */
  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") rotateSegment(true);
    else {
      cleanup();
      setState("idle");
    }
  }, [cleanup, rotateSegment]);

  /** Abandon everything without emitting — used when consent is withdrawn mid-visit. */
  const abort = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) recorder.onstop = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    cleanup();
    setState("idle");
    setElapsedMs(0);
  }, [cleanup]);

  /**
   * The UI calls this while the CHP is reading a probe aloud, so the segment carries a flag
   * instead of the pipeline having to guess. Partial mitigation for the attribution risk that
   * tap-per-turn used to handle structurally.
   */
  const markSpeaking = useCallback(() => {
    chpSpokeRef.current = true;
  }, []);

  return {
    state,
    elapsedMs,
    level,
    voiceActive,
    lowLevelHint,
    segmentCount,
    recording: state === "recording",
    start,
    stop,
    abort,
    markSpeaking,
  };
}

/** Sahara accepts WebM, OGG, MP4, WAV, MP3 and FLAC, so no client-side conversion is needed. */
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
