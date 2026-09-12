"""ASR adapters. The Python twin of Contract 1 (docs/contracts.md).

Same rules as the TypeScript side, restated because they are the contract and not style:
  - errors RAISE, they never return an empty string ("she said nothing" != "we do not know")
  - the adapter NEVER retries; retry policy lives in the caller
  - `text` is returned unmodified; normalisation is the metric's job
  - model ids use hyphens only (Intron's harness splits filenames on "_")
"""
from .base import ASRAdapter, ASRError, TranscribeResult  # noqa: F401
