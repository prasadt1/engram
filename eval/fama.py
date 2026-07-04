"""FAMA: Forgetting-Aware Memory Accuracy.

FAMA = max(0, MPA - lambda * (1 - FAA))
  MPA (Memory Presence Accuracy)  = fraction of currently-valid memories correctly surfaced
  FAA (Forgetting Accuracy)       = fraction of obsolete/superseded memories correctly excluded
  lambda = N_forget / (N_presence + N_forget), derived from the trace set (disclosed with results)
"""

from __future__ import annotations


def compute_fama(*, valid_surfaced: int, valid_total: int, obsolete_excluded: int, obsolete_total: int) -> dict:
    mpa = valid_surfaced / valid_total if valid_total else 1.0
    faa = obsolete_excluded / obsolete_total if obsolete_total else 1.0
    lam = obsolete_total / (valid_total + obsolete_total) if (valid_total + obsolete_total) else 0.0
    fama = max(0.0, mpa - lam * (1 - faa))
    return {"mpa": round(mpa, 4), "faa": round(faa, 4), "lambda": round(lam, 4), "fama": round(fama, 4)}
