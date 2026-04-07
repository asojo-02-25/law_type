#!/usr/bin/env python3
"""Step 3: Convert normalized law text to hiragana problem data.

Input:
- data/normalized_questions_step2.json

Output:
- data/questions_step3_kana.json
- data/kana_manifest_step3.json

Rules:
1. Normalize source text with NFKC before conversion
2. Apply custom reading map priority before kana conversion
3. Convert to hiragana with pykakasi
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from pykakasi import kakasi
except ImportError as exc:
    raise SystemExit(
        "pykakasi is required. Install with: pip install pykakasi"
    ) from exc


CUSTOM_READING_MAP: Dict[str, str] = {
    "遺言": "いごん",
    "競売": "けいばい",
    "瑕疵": "かし",
    "勾留": "こうりゅう",
}


def normalize_nfkc(text: str) -> str:
    return unicodedata.normalize("NFKC", text)


def mask_custom_terms(text: str) -> Tuple[str, Dict[str, str], Dict[str, int]]:
    """Replace target terms with placeholders to enforce custom readings."""
    masked = text
    placeholders: Dict[str, str] = {}
    hits: Dict[str, int] = {}

    for idx, term in enumerate(sorted(CUSTOM_READING_MAP.keys(), key=len, reverse=True)):
        count = masked.count(term)
        if count == 0:
            continue
        placeholder = f"__R{idx}__"
        masked = masked.replace(term, placeholder)
        placeholders[placeholder] = CUSTOM_READING_MAP[term]
        hits[term] = count

    return masked, placeholders, hits


def apply_placeholders(kana_text: str, placeholders: Dict[str, str]) -> str:
    restored = kana_text
    for marker, reading in placeholders.items():
        restored = restored.replace(marker, reading)
        restored = restored.replace(marker.lower(), reading)
        restored = restored.replace(marker.upper(), reading)
    return restored


def convert_to_hiragana(text: str, converter) -> Tuple[str, Dict[str, int]]:
    normalized = normalize_nfkc(text)
    masked, placeholders, hits = mask_custom_terms(normalized)

    converted = converter.convert(masked)
    kana = "".join(token.get("hira", "") for token in converted)
    kana = apply_placeholders(kana, placeholders)
    kana = normalize_nfkc(kana)
    kana = re.sub(r"\s+", "", kana)

    return kana, hits


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert normalized law text into kana data (Step 3)")
    parser.add_argument(
        "--input-json",
        default="data/normalized_questions_step2.json",
        help="Step 2 normalized input JSON",
    )
    parser.add_argument(
        "--output-json",
        default="data/questions_step3_kana.json",
        help="Step 3 kana output JSON",
    )
    parser.add_argument(
        "--output-manifest",
        default="data/kana_manifest_step3.json",
        help="Step 3 summary manifest JSON",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    workspace = Path(__file__).resolve().parent.parent

    input_json = (workspace / args.input_json).resolve()
    output_json = (workspace / args.output_json).resolve()
    output_manifest = (workspace / args.output_manifest).resolve()

    if not input_json.exists():
        print(f"ERROR: input json not found: {input_json}", file=sys.stderr)
        return 2

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)

    try:
        records = json.loads(input_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: input json parse error: {exc}", file=sys.stderr)
        return 2

    if not isinstance(records, list):
        print("ERROR: input JSON root must be a list", file=sys.stderr)
        return 2

    converter = kakasi()

    output_records: List[Dict[str, str]] = []
    custom_hits_total: Dict[str, int] = {key: 0 for key in CUSTOM_READING_MAP.keys()}
    skipped_invalid = 0

    for rec in records:
        if not isinstance(rec, dict):
            skipped_invalid += 1
            continue

        raw_text = str(rec.get("text", "")).strip()
        field = str(rec.get("field", "")).strip()
        source = str(rec.get("source", "")).strip()

        if not raw_text or not field or not source:
            skipped_invalid += 1
            continue

        text = normalize_nfkc(raw_text)
        kana, hits = convert_to_hiragana(text, converter)

        for term, count in hits.items():
            custom_hits_total[term] = custom_hits_total.get(term, 0) + count

        output_records.append(
            {
                "text": text,
                "kana": kana,
                "field": field,
                "source": source,
            }
        )

    output_json.write_text(json.dumps(output_records, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "input_count": len(records),
        "output_count": len(output_records),
        "skipped_invalid": skipped_invalid,
        "custom_reading_hits_total": sum(custom_hits_total.values()),
        "custom_reading_hits_by_term": custom_hits_total,
    }

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "input_json": str(input_json.relative_to(workspace)).replace("\\", "/"),
        "output_json": str(output_json.relative_to(workspace)).replace("\\", "/"),
        "rules": {
            "normalize_nfkc": True,
            "custom_reading_map": CUSTOM_READING_MAP,
            "converter": "pykakasi",
        },
        "summary": summary,
    }

    output_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== Step 3 kana conversion summary ===")
    print(f"Input json      : {input_json}")
    print(f"Output json     : {output_json}")
    print(f"Output manifest : {output_manifest}")
    print(f"Input count     : {len(records)}")
    print(f"Output count    : {len(output_records)}")
    print(f"Skipped invalid : {skipped_invalid}")
    print("Custom reading hits:")
    for term, count in custom_hits_total.items():
        print(f"- {term}: {count}")

    if not output_records:
        print("ERROR: no output records", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
