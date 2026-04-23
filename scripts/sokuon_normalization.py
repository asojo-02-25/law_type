#!/usr/bin/env python3
"""Shared helpers for conservative historical sokuon normalization.

This module intentionally keeps replacements strict:
- only known forms are replaced
- any remaining candidates are reported for manual review
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple


# Conservative dictionary for historical kana -> modern sokuon.
SOKUON_MODERNIZE_MAP: Dict[str, str] = {
    "あつた": "あった",
    "あつて": "あって",
    "あつても": "あっても",
    "あつては": "あっては",
    "があつた": "があった",
    "がかわつた": "がかわった",
    "のあつた": "のあった",
    "であつた": "であった",
    "であつて": "であって",
    "であつても": "であっても",
    "なつた": "なった",
    "なつて": "なって",
    "とつた": "とった",
    "となつた": "となった",
    "となつて": "となって",
    "なくなつた": "なくなった",
    "しなくなつた": "しなくなった",
    "によつて": "によって",
    "によつてこれを": "によってこれを",
    "によつてその": "によってその",
    "これによつて": "これによって",
    "これらによつて": "これらによって",
    "のみによつてこれを": "のみによってこれを",
    "することによつて": "することによって",
    "めることによつて": "めることによって",
    "さかのぼつて": "さかのぼって",
    "までさかのぼつて": "までさかのぼって",
    "をもつて": "をもって",
    "もつて": "もって",
    "たつて": "たって",
    "たつては": "たっては",
    "たつての": "たっての",
    "だつて": "だって",
    "なかつた": "なかった",
    "しなかつた": "しなかった",
    "されなかつた": "されなかった",
    "できなかつた": "できなかった",
    "めなかつた": "めなかった",
    "らなかつた": "らなかった",
    "かつた": "かった",
    "知つた": "知った",
    "終つた": "終った",
    "失つた": "失った",
    "誤つた": "誤った",
    "怠つた": "怠った",
    "負つて": "負って",
    "払つて": "払って",
    "代わつて": "代わって",
    "従つて": "従って",
    "当たつて": "当って",
    "当たつた": "当たった",
    "会つた": "会った",
    "取つた" : "取った",
    "入つて": "入って",
    "至つた": "至った",
}

SOKUON_MODERNIZE_TERMS: Tuple[str, ...] = tuple(
    sorted(SOKUON_MODERNIZE_MAP.keys(), key=len, reverse=True)
)

# Focus on historical patterns that are very likely to represent old 'っ' notation.
HISTORICAL_SOKUON_CANDIDATE_RE = re.compile(r"[ぁ-ゖー]{0,10}つ[たて][ぁ-ゖー]{0,10}")


def apply_sokuon_modernization(text: str) -> Tuple[str, Dict[str, int]]:
    """Replace known historical forms and return per-term hit counts."""
    updated = text
    hits: Dict[str, int] = {}

    for old in SOKUON_MODERNIZE_TERMS:
        count = updated.count(old)
        if not count:
            continue
        updated = updated.replace(old, SOKUON_MODERNIZE_MAP[old])
        hits[old] = count

    return updated, hits


def detect_historical_sokuon_candidates(text: str) -> List[str]:
    """Return unresolved historical-sokuon candidates for reporting."""
    if not text:
        return []
    return [m.group(0) for m in HISTORICAL_SOKUON_CANDIDATE_RE.finditer(text)]
