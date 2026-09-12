"""Derive the deletion-signature detector's FLOOR from real data (spec section 11.5, FR-32).

    cps = len(transcript.strip()) / audio_duration_seconds
    FLOOR = 5th percentile of cps over GOLD transcripts, minus a safety margin

The spec is explicit twice over (sections 11.5 and 24.11) that this value must be DERIVED and the
derived value recorded in the repo. Until it is, the product reports `calibrated: false` and the
UI tells the CHP the threshold has not been measured. A fabricated threshold that happens to look
plausible is worse than an absent one, because it cannot be argued with.

    python -m bench.derive_floor

Writes data/deletion_floor.json.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import numpy as np

from bench.data import load_afriswitchcare
from bench.env import ROOT, load_env

# How far below the 5th percentile to sit. The detector is NON-BLOCKING and dismissible (it shows
# an amber strip offering a re-record), so a false positive costs one dismissed hint while a false
# negative means extraction runs on a truncated transcript. But an over-eager hint that fires on
# every terse answer trains the CHP to ignore it, which is the failure mode that matters. 10% below
# the 5th percentile keeps it rare.
SAFETY_MARGIN_FRACTION = 0.10


def main() -> None:
    load_env()

    print("Loading AfriSwitchCare[swahili] gold transcripts ...")
    # Audio is not needed: the dataset carries its own `duration` column, verified against
    # soundfile decoding (389.2690 vs 389.2693 s on row 0).
    samples = load_afriswitchcare(decode_audio=False)

    rows = []
    for sample in samples:
        chars = len(sample.transcription.strip())
        cps = chars / sample.duration_s
        rows.append((sample.sample_id, chars, sample.duration_s, cps))

    cps_values = np.array([r[3] for r in rows])

    print(f"\n{'case':36} {'chars':>7} {'dur (s)':>9} {'cps':>7}")
    for name, chars, dur, cps in sorted(rows, key=lambda r: r[3]):
        print(f"{name[:36]:36} {chars:7d} {dur:9.1f} {cps:7.2f}")

    p5 = float(np.percentile(cps_values, 5))
    floor = p5 * (1 - SAFETY_MARGIN_FRACTION)

    print(f"\nn                  {len(cps_values)}")
    print(f"min                {cps_values.min():.2f}")
    print(f"5th percentile     {p5:.2f}")
    print(f"median             {float(np.median(cps_values)):.2f}")
    print(f"max                {cps_values.max():.2f}")
    print(f"safety margin      {SAFETY_MARGIN_FRACTION:.0%}")
    print(f"FLOOR              {floor:.2f}  chars/second")

    payload = {
        "floor": round(floor, 2),
        "derived": True,
        "provenance": (
            "5th percentile of characters-per-second over the 12 gold transcripts of "
            "intronhealth/AfriSwitchCare config 'swahili' split 'test', minus a 10% safety margin. "
            "Durations are the dataset's own `duration` column. Derived by bench/derive_floor.py."
        ),
        "percentile": 5,
        "safety_margin_fraction": SAFETY_MARGIN_FRACTION,
        "p5_cps": round(p5, 2),
        "min_cps": round(float(cps_values.min()), 2),
        "median_cps": round(float(np.median(cps_values)), 2),
        "max_cps": round(float(cps_values.max()), 2),
        "n": len(cps_values),
        "derived_at": date.today().isoformat(),
        "caveat": (
            "These are two-party consultations of 6-11 minutes; the product measures single-speaker "
            "turns of 20-110 seconds. Conversational pauses and turn-taking are included in the "
            "denominator here and are not in a product turn, so this floor is a conservative "
            "estimate rather than a like-for-like one. Recalibrate on field set C once it is "
            "recorded, which is single-speaker and matches the product's unit exactly."
        ),
        "per_case_cps": {name: round(cps, 2) for name, _, _, cps in rows},
    }

    out = ROOT / "data" / "deletion_floor.json"
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {out.relative_to(ROOT)}")
    print("The product will now report calibrated: true.")


if __name__ == "__main__":
    main()
