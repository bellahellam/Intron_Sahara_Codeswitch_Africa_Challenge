"""Benchmark runner.

    python -m bench.run --dataset afriswitchcare_sw --models sahara-off,sahara-on --out results/

Design commitments that make the comparison valid rather than decorative:

  - CHUNKING IS COMPUTED ONCE and shared by every model. Segment boundaries are derived from the
    audio alone, never per-adapter. If one model saw different segments the comparison would be
    void.
  - The adapter called here is the SAME CLASS the product calls, with the same configuration
    flags. Benchmarking a different code path than the one that ships is how a benchmark becomes
    marketing.
  - Raw per-sample output is written to CSV before any metric runs, so every number in the report
    is auditable back to a transcript.
  - Rate limiting is honoured. Sahara's sync endpoint is 30 req/min; calls are paced and serialised.

Results land in results/<dataset>/<model>.csv with a `hypothesis` column — NOT `prediction`.
Intron's evaluations.py asserts `"hypothesis" in data.columns`, and its results README documents
the wrong name (spec section 18.7).
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

from bench.data import chunk_audio, load_afriswitchcare
from bench.env import ROOT, load_env

# Sahara sync is 30 req/min. 2.2 s between calls leaves headroom for jitter without wasting
# wall-clock on a corpus this size.
SAHARA_MIN_INTERVAL_S = 2.2


def build_adapter(key: str):
    from bench.adapters.sahara import SaharaAdapter

    if key == "sahara-off":
        return SaharaAdapter(disable_llm_corrections=True)
    if key == "sahara-on":
        return SaharaAdapter(disable_llm_corrections=False)
    if key.startswith("whisper"):
        from bench.adapters.whisper import WhisperAdapter

        size = "large-v3"
        if ":" in key:
            key, size = key.split(":", 1)
        return WhisperAdapter(model_size=size, force_language=not key.endswith("auto"))
    if key == "jacaranda":
        from bench.adapters.jacaranda import JacarandaAdapter

        return JacarandaAdapter()
    raise SystemExit(
        f"Unknown model key '{key}'. Known: sahara-off, sahara-on, whisper-sw, whisper-auto, "
        f"whisper-sw:small, jacaranda"
    )


def run_model(model_key: str, samples, out_dir: Path, limit: int | None, chunk_s: float) -> Path:
    adapter = build_adapter(model_key)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{adapter.name}.csv"

    paced = model_key.startswith("sahara")
    last_call = 0.0

    rows = []
    for sample_idx, sample in enumerate(samples):
        if limit is not None and sample_idx >= limit:
            break
        assert sample.audio is not None, "audio must be decoded for a benchmark run"

        pieces: list[str] = []
        latencies: list[int] = []
        errors: list[str] = []

        chunks = list(chunk_audio(sample.audio, sample.sampling_rate, target_s=chunk_s))
        for chunk_idx, chunk_audio_array, start_s, end_s in chunks:
            if paced:
                wait = SAHARA_MIN_INTERVAL_S - (time.perf_counter() - last_call)
                if wait > 0:
                    time.sleep(wait)
            try:
                result = adapter.transcribe(chunk_audio_array, sample.sampling_rate, lang="sw")
                pieces.append(result.text.strip())
                latencies.append(result.latency_ms)
            except Exception as exc:  # noqa: BLE001
                # A failed chunk is recorded as a FAILURE, never as an empty transcript. An empty
                # string would be scored as a perfect deletion and flatter the model.
                kind = getattr(exc, "kind", type(exc).__name__)
                errors.append(f"chunk{chunk_idx}:{kind}")
                print(f"    ! chunk {chunk_idx} failed: {kind}: {str(exc)[:120]}")
            finally:
                last_call = time.perf_counter()

            print(
                f"  [{adapter.name}] {sample.sample_id[:22]:22} "
                f"chunk {chunk_idx + 1}/{len(chunks)} ({start_s:.0f}-{end_s:.0f}s)",
                end="\r",
            )

        hypothesis = " ".join(p for p in pieces if p).strip()
        rows.append(
            {
                "sample_id": sample.sample_id,
                "model": adapter.name,
                "hypothesis": hypothesis,
                "reference": sample.transcription,
                "reference_tagged": sample.transcription_tagged,
                "duration_s": round(sample.duration_s, 2),
                "gold_cmi": sample.cmi,
                "gold_switch_points": sample.num_switch_points,
                "chunks": len(chunks),
                "chunks_failed": len(errors),
                "errors": ";".join(errors),
                "latency_ms_total": sum(latencies),
                "latency_ms_mean_per_chunk": round(sum(latencies) / len(latencies)) if latencies else "",
            }
        )
        done = len(rows)
        print(
            f"  [{adapter.name}] {sample.sample_id[:22]:22} done "
            f"({done}/{min(limit or len(samples), len(samples))})  "
            f"{len(hypothesis)} chars, {len(errors)} failed chunks" + " " * 20
        )

    with out_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"  wrote {out_path.relative_to(ROOT)}")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="MAMA-SAUTI ASR benchmark")
    parser.add_argument("--dataset", default="afriswitchcare_sw")
    parser.add_argument(
        "--models",
        default="sahara-off,sahara-on",
        help="comma-separated: sahara-off, sahara-on, whisper-sw, whisper-auto, whisper-sw:small, jacaranda",
    )
    parser.add_argument("--out", default="results")
    parser.add_argument("--limit", type=int, default=None, help="first N conversations only (smoke runs)")
    parser.add_argument("--chunk-seconds", type=float, default=75.0)
    args = parser.parse_args()

    load_env()

    if args.dataset != "afriswitchcare_sw":
        raise SystemExit(
            "Only afriswitchcare_sw is wired up. Dataset B (AfriSwitch) is cut per spec section "
            "24.11: 650 utterances x N configs exceeds the credit budget, and it is the robustness "
            "set rather than the primary one. Field set C is not yet recorded."
        )

    print(f"Loading {args.dataset} ...")
    samples = load_afriswitchcare(decode_audio=True)
    print(f"  {len(samples)} conversations, {sum(s.duration_s for s in samples) / 3600:.2f} h total\n")

    out_dir = ROOT / args.out / args.dataset
    for model_key in [m.strip() for m in args.models.split(",") if m.strip()]:
        print(f"--- {model_key} ---")
        started = time.perf_counter()
        run_model(model_key, samples, out_dir, args.limit, args.chunk_seconds)
        print(f"  elapsed {time.perf_counter() - started:.0f}s\n")

    print("Now run:  python -m bench.report --in results/ --out report/")


if __name__ == "__main__":
    main()
