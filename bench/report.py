"""Compute metrics from raw run output and render the report.

    python -m bench.report --in results/ --out report/

Writes:
    results/<dataset>/metrics_per_sample.csv   every metric, every sample, auditable
    results/<dataset>/metrics_summary.csv      per-model aggregates
    data/benchmark_results.json                what the in-product S10 page renders
    report/BENCHMARK.md                        the written report

What is deliberately NOT computed here: Tier 3 (construct F1, |dPHQ-9|, band-flip, tier-flip).
Spec section 18.5a is explicit that band-flip on AfriSwitchCare is DEGENERATE BY CONSTRUCTION —
12 conversations across 12 conditions, of which one is depression, so eleven gold PHQ-9 totals sit
near zero and no transcription error can move the band. Publishing it as a headline would be worse
than publishing nothing. Tier 3 requires field set C, which carries hand-assigned gold item
vectors and is not yet recorded.
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
from pathlib import Path

from bench.env import ROOT
from bench.metrics.tier1 import cer, wer
from bench.metrics.tier2 import cmi, eesr, lexicon_recall
from bench.normalise import english_spans


def load_lexicon_phrases(filename: str, column: str = "phrase") -> list[str]:
    path = ROOT / "data" / filename
    with path.open(encoding="utf-8") as fh:
        return [row[column].strip() for row in csv.DictReader(fh) if row.get(column, "").strip()]


def analyse(rows: list[dict]) -> list[dict]:
    idiom_phrases = load_lexicon_phrases("idiom_lexicon.csv")
    safety_phrases = load_lexicon_phrases("safety_lexicon.csv")

    out = []
    for row in rows:
        reference = row["reference"]
        hypothesis = row["hypothesis"]
        tagged = row["reference_tagged"]

        e = eesr(tagged, hypothesis)
        cir = lexicon_recall(idiom_phrases, reference, hypothesis)
        spr = lexicon_recall(safety_phrases, reference, hypothesis)

        gold_cmi = float(row["gold_cmi"]) if row.get("gold_cmi") else None
        hyp_cmi = cmi(hypothesis)

        out.append(
            {
                "sample_id": row["sample_id"],
                "model": row["model"],
                "duration_s": float(row["duration_s"]),
                "ref_chars": len(reference),
                "hyp_chars": len(hypothesis),
                "chunks_failed": int(row.get("chunks_failed") or 0),
                "wer": round(wer(reference, hypothesis), 4),
                "cer": round(cer(reference, hypothesis), 4),
                "en_spans_total": e.total,
                "en_spans_recalled": e.recalled,
                "eesr": round(e.eesr, 4) if e.eesr is not None else "",
                "eesr_clinical_total": e.clinical_total,
                "eesr_clinical_recalled": e.clinical_recalled,
                "eesr_clinical": round(e.eesr_clinical, 4) if e.eesr_clinical is not None else "",
                "cir_total": cir.total,
                "cir": round(cir.recall, 4) if cir.recall is not None else "",
                "cir_missed": ";".join(cir.missed),
                "spr_total": spr.total,
                "spr": round(spr.recall, 4) if spr.recall is not None else "",
                "spr_missed": ";".join(spr.missed),
                "gold_cmi": gold_cmi,
                "hyp_cmi": round(hyp_cmi, 2) if hyp_cmi is not None else "",
                "cmi_delta": round(abs(gold_cmi - hyp_cmi), 2) if (gold_cmi and hyp_cmi) else "",
                "latency_ms_mean_per_chunk": row.get("latency_ms_mean_per_chunk", ""),
                "missed_clinical_spans": " | ".join(e.missed_clinical_spans[:8]),
            }
        )
    return out


def _mean(values: list[float]) -> float | None:
    vals = [v for v in values if v is not None]
    return round(statistics.mean(vals), 4) if vals else None


def summarise(per_sample: list[dict]) -> list[dict]:
    by_model: dict[str, list[dict]] = {}
    for row in per_sample:
        by_model.setdefault(row["model"], []).append(row)

    summaries = []
    for model, rows in by_model.items():
        # EESR aggregates over SPANS, not over the mean of per-conversation rates: a conversation
        # with 3 spans should not weigh the same as one with 90.
        en_total = sum(r["en_spans_total"] for r in rows)
        en_recalled = sum(r["en_spans_recalled"] for r in rows)
        clin_total = sum(r["eesr_clinical_total"] for r in rows)
        clin_recalled = sum(r["eesr_clinical_recalled"] for r in rows)
        cir_total = sum(r["cir_total"] for r in rows)
        cir_recalled = sum(int(round((r["cir"] or 0) * r["cir_total"])) for r in rows if r["cir"] != "")
        spr_total = sum(r["spr_total"] for r in rows)
        spr_recalled = sum(int(round((r["spr"] or 0) * r["spr_total"])) for r in rows if r["spr"] != "")

        latencies = [float(r["latency_ms_mean_per_chunk"]) for r in rows if r["latency_ms_mean_per_chunk"]]

        summaries.append(
            {
                "model": model,
                "n_conversations": len(rows),
                "chunks_failed": sum(r["chunks_failed"] for r in rows),
                "wer": _mean([r["wer"] for r in rows]),
                "cer": _mean([r["cer"] for r in rows]),
                "eesr": round(en_recalled / en_total, 4) if en_total else None,
                "en_spans_total": en_total,
                "eesr_clinical": round(clin_recalled / clin_total, 4) if clin_total else None,
                "eesr_clinical_total": clin_total,
                "cir": round(cir_recalled / cir_total, 4) if cir_total else None,
                "cir_total": cir_total,
                "spr": round(spr_recalled / spr_total, 4) if spr_total else None,
                "spr_total": spr_total,
                "cmi_delta": _mean([r["cmi_delta"] for r in rows if r["cmi_delta"] != ""]),
                "latency_ms_mean_per_chunk": round(statistics.mean(latencies)) if latencies else None,
                "latency_ms_p95_per_chunk": round(sorted(latencies)[int(len(latencies) * 0.95) - 1])
                if len(latencies) > 1
                else None,
            }
        )
    return sorted(summaries, key=lambda s: s["model"])


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def fmt(value, pct: bool = False, dash: str = "—") -> str:
    """`dash` is overridable because Windows consoles default to cp1252 and cannot print an
    em-dash; the markdown report still gets the proper character."""
    if value is None or value == "":
        return dash
    if pct:
        return f"{float(value) * 100:.1f}%"
    return f"{float(value):.3f}" if isinstance(value, float) else str(value)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="in_dir", default="results")
    parser.add_argument("--out", dest="out_dir", default="report")
    parser.add_argument("--dataset", default="afriswitchcare_sw")
    args = parser.parse_args()

    raw_dir = ROOT / args.in_dir / args.dataset
    csvs = sorted(p for p in raw_dir.glob("*.csv") if not p.name.startswith("metrics_"))
    if not csvs:
        raise SystemExit(f"No run output in {raw_dir}. Run `python -m bench.run` first.")

    rows: list[dict] = []
    for path in csvs:
        with path.open(encoding="utf-8") as fh:
            rows.extend(csv.DictReader(fh))
    print(f"loaded {len(rows)} rows from {len(csvs)} model file(s)")

    per_sample = analyse(rows)
    summary = summarise(per_sample)

    write_csv(raw_dir / "metrics_per_sample.csv", per_sample)
    write_csv(raw_dir / "metrics_summary.csv", summary)
    print(f"wrote {(raw_dir / 'metrics_per_sample.csv').relative_to(ROOT)}")
    print(f"wrote {(raw_dir / 'metrics_summary.csv').relative_to(ROOT)}")

    # ---- the in-product S10 page renders from this ----
    payload = json.loads((ROOT / "data" / "benchmark_results.json").read_text(encoding="utf-8"))
    payload["_status"] = (
        f"Run on {len({r['sample_id'] for r in per_sample})} AfriSwitchCare Swahili conversations. "
        "Tier 3 (band-flip) is NOT reported: it is degenerate on this dataset by construction "
        "(spec section 18.5a) and requires field set C, which is not yet recorded."
    )
    from datetime import date

    payload["generated_at"] = date.today().isoformat()
    payload["table1"] = [
        {
            "model": s["model"],
            "wer": s["wer"],
            "cer": s["cer"],
            "eesr": s["eesr"],
            "eesr_clinical": s["eesr_clinical"],
            "eesr_clinical_total": s["eesr_clinical_total"],
            "cir": s["cir"],
            "cir_total": s["cir_total"],
            "spr": s["spr"],
            "spr_total": s["spr_total"],
            "cmi_delta": s["cmi_delta"],
            "latency_ms_p95_per_chunk": s["latency_ms_p95_per_chunk"],
            "n": s["n_conversations"],
        }
        for s in summary
    ]
    (ROOT / "data" / "benchmark_results.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print("wrote data/benchmark_results.json  (the in-product S10 page)")

    # ---- console table ----
    print(f"\n{'model':28} {'WER':>7} {'CER':>7} {'EESR':>8} {'EESR-cl':>8} {'CIR':>7} {'CMI-d':>7} {'p95 ms':>8}")
    for s in summary:
        print(
            f"{s['model'][:28]:28} {fmt(s['wer']):>7} {fmt(s['cer']):>7} "
            f"{fmt(s['eesr'], True):>8} {fmt(s['eesr_clinical'], True):>8} "
            f"{fmt(s['cir'], True):>7} {fmt(s['cmi_delta']):>7} {fmt(s['latency_ms_p95_per_chunk']):>8}"
        )

    out_md = ROOT / args.out_dir / "BENCHMARK.md"
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(render_markdown(summary, per_sample), encoding="utf-8")
    print(f"\nwrote {out_md.relative_to(ROOT)}")


def render_markdown(summary: list[dict], per_sample: list[dict]) -> str:
    from datetime import date

    lines: list[str] = []
    add = lines.append

    add("# MAMA-SAUTI — ASR benchmark")
    add("")
    add(f"**Generated** {date.today().isoformat()} · reproduce with `python -m bench.run && python -m bench.report`")
    add("")
    add("## What this benchmark asks")
    add("")
    add("Not *which model has the lowest WER*. The question is whether ASR quality on code-switched")
    add("Swahili **changes the clinical decision this product makes**. If two models differ by 8 WER")
    add("points but produce the same PHQ-9 band on every case, the WER difference is not a product")
    add("fact. If two models differ by 2 points and one flips the band on a fifth of cases, that is")
    add("the headline.")
    add("")
    add("## Dataset")
    add("")
    add("`intronhealth/AfriSwitchCare`, config `swahili`, split `test` — 12 simulated doctor-patient")
    add("consultations, 1.54 h, mean CMI 37.4, the highest switch density of the eight languages in")
    add("that corpus. In-domain for a CHP-mediated screening conversation.")
    add("")
    add("Two properties of this data, both verified rather than taken from the card:")
    add("")
    add("- The card's *Avg. Duration* column is actually the **total**. These are 12 conversations of")
    add("  358–685 s each, not 12 × 92 minutes. Both Whisper's 30 s window and Sahara's 120 s sync cap")
    add("  therefore require chunking.")
    add("- **`num_turns` is null on every Swahili row.** The transcripts carry no speaker markers at")
    add("  all, so a PHQ-9 extraction run over them would attribute the clinician's words to the")
    add("  patient. This is why Tier 3 cannot run here.")
    add("")
    add("## Method")
    add("")
    add("- Chunking is computed **once** from the audio and shared byte-identically by every model.")
    add("  A per-model segmentation would void the comparison.")
    add("- Fixed 75 s windows with 1 s overlap. The spec asks for VAD segmentation; a fixed window is")
    add("  the honest substitute when no VAD dependency is available, and it is declared as such")
    add("  rather than described as VAD. The property that matters — every model sees the same")
    add("  segments — holds either way.")
    add("- A failed chunk is recorded as a **failure**, never as an empty transcript. An empty string")
    add("  would score as a perfect deletion and flatter the model.")
    add("- WER and CER use Intron's normalisation (diacritics removed) for comparability. EESR, CIR")
    add("  and SPR use a **diacritic-preserving** normalisation, because they are lexicon-matching")
    add("  metrics and diacritic stripping collapses distinctions the matcher relies on.")
    add("")
    add("## Table 1 — transcription quality")
    add("")
    add("| Model | WER ↓ | CER ↓ | **EESR ↑** | **EESR-clinical ↑** | CIR ↑ | CMI-Δ ↓ | p95 latency/chunk | Failed chunks |")
    add("|---|---|---|---|---|---|---|---|---|")
    for s in summary:
        add(
            f"| `{s['model']}` | {fmt(s['wer'])} | {fmt(s['cer'])} | "
            f"{fmt(s['eesr'], True)} | {fmt(s['eesr_clinical'], True)} | {fmt(s['cir'], True)} | "
            f"{fmt(s['cmi_delta'])} | {fmt(s['latency_ms_p95_per_chunk'])} ms | {s['chunks_failed']} |"
        )
    add("")
    add(f"EESR is computed over {summary[0]['en_spans_total'] if summary else 0} embedded-English spans")
    add(f"and EESR-clinical over the {summary[0]['eesr_clinical_total'] if summary else 0} of those")
    add("containing an affective term.")
    add("")
    add("## What EESR measures, and why WER alone is misleading")
    add("")
    add("The dominant failure on code-switched speech is **switch-boundary deletion**: the model")
    add("returns fluent monolingual Swahili with the embedded English simply gone. In this setting")
    add("that English carries the *affective* vocabulary — \"stress\", \"depressed\", \"I can't cope\".")
    add("Aggregate WER cannot distinguish losing a filler from losing the only clinical content in")
    add("the sentence.")
    add("")
    add("**EESR** asks, for each gold `[[EN]]` span, whether its token sequence survives in the")
    add("hypothesis. **EESR-clinical** restricts that to spans containing an affective term. The")
    add("general number can look healthy while the clinical subset collapses, and the clinical subset")
    add("is what determines whether the product works.")
    add("")
    add("## Tier 3 is deliberately absent")
    add("")
    add("Construct F1, |ΔPHQ-9|, **band-flip** and referral-tier flip are **not reported here**.")
    add("")
    add("Band-flip on this dataset is degenerate by construction: 12 conversations across 12")
    add("conditions, of which exactly one is depression. For the other eleven the gold PHQ-9 total is")
    add("near zero and the band is *minimal*, so a transcription error would have to invent a great")
    add("deal of symptom content to move it. The number would come out near zero regardless of ASR")
    add("quality and would say nothing at all. Publishing it as a headline would be worse than")
    add("publishing nothing.")
    add("")
    add("Tier 3 requires **field set C** — 28 first-party utterances carrying hand-assigned gold")
    add("PHQ-9/GAD-7 item vectors, deliberately spread across all five severity bands. That set is")
    add("not yet recorded. See `LIMITATIONS.md`.")
    add("")
    add("## Table 5 — not benchmarked, and why")
    add("")
    add("| Excluded | Reason |")
    add("|---|---|")
    add("| **Deepgram** | Terms of Service restriction #9 prohibits use *\"for competitive purposes, including model training, benchmarking and other competitive analysis\"*. Not conditioned on being a competitor. We do not publish numbers we are contractually barred from producing. |")
    add("| **AssemblyAI** | Prohibits \"competitive analysis or benchmarking\", **and** separately prohibits submitting benchmarking material \"not independently created by the Customer\" — which directly implicates evaluating on a third-party corpus like AfriSwitchCare. |")
    add("| **NVIDIA Parakeet / Canary** | Swahili is not supported by any checkpoint. A negative finding, not a benchmark row. |")
    add("| **w2v-BERT 2.0** | `sw` is in its pretraining set, but the card states it is a bare checkpoint without a modeling head. Cannot be benchmarked zero-shot. |")
    add("")
    add("Stating the two ToS exclusions is a deliberate choice. A team that publishes Deepgram numbers")
    add("has either not read the terms or decided not to care.")
    add("")
    add("## Published baselines, so a bad number is a finding rather than a panic")
    add("")
    add("| Source | Result |")
    add("|---|---|")
    add("| shamiriAI (Lilan, Mochama, Osborn et al. 2026, *JMIR AI* 5:e95063) — code-switched English/Kiswahili/Sheng mental-health session audio | **WER 0.34, CER 0.19** — the only peer-reviewed benchmark for exactly our setting, and our realistic ceiling |")
    add("| AfriSwitch, best system, code-switched Swahili | 34.12% WER |")
    add("| Intron MultiBench, **monolingual** accented clinical Swahili, Sahara | 0.068 normalised WER |")
    add("| Common Voice read-speech Swahili | 3–16% WER |")
    add("")
    add("**The gap between 0.068 and 0.34 is the entire story of this competition.** Monolingual")
    add("accented clinical Swahili is close to solved. Code-switched Swahili is not. Do not compare")
    add("against the monolingual number.")
    add("")
    add("## Per-conversation results")
    add("")
    add("| Conversation | Model | WER | EESR | EESR-clinical | CIR |")
    add("|---|---|---|---|---|---|")
    for r in sorted(per_sample, key=lambda r: (r["sample_id"], r["model"])):
        add(
            f"| {r['sample_id']} | `{r['model']}` | {fmt(r['wer'])} | {fmt(r['eesr'], True)} | "
            f"{fmt(r['eesr_clinical'], True)} | {fmt(r['cir'], True)} |"
        )
    add("")
    add("Raw per-sample output, including every hypothesis transcript, is in")
    add("`results/afriswitchcare_sw/`. Every number above is auditable back to a transcript.")
    add("")
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
