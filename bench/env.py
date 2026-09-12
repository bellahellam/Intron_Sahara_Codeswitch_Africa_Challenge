"""Load .env and .env.local, the same precedence Next.js uses.

The harness shares credentials with the product deliberately: the thing being benchmarked must be
literally the thing the product calls, or the benchmark is decorative.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    for name in (".env", ".env.local"):  # .env.local wins
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            match = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line)
            if not match:
                continue
            key, value = match.group(1), match.group(2).strip().strip('"').strip("'")
            if value:
                os.environ[key] = value
