#!/usr/bin/env python3
"""Step 4: Finalize question JSON for app consumption.

Input:
- data/questions_step3_kana.json

Output:
- data/questions.json
- data/finalize_manifest_step4.json
- data/finalize_invalid_kana_step4.json

The final schema is:
{
  "questiondata": [
    {
      "text": "...",
      "kana": "...",
      "field": "...",
      "source": "..."
    }
  ]
}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

from sokuon_normalization import (
    HISTORICAL_SOKUON_CANDIDATE_RE,
    detect_historical_sokuon_candidates,
)


REQUIRED_KEYS = ("text", "kana", "field", "source")
ALLOWED_KANA_CHAR_PATTERN = re.compile(r"[ぁ-ゖゝゞー、。]")
ALLOWED_KANA_DESCRIPTION = "hiragana + ー + 、。"


def ensure_terminal_period(text: str) -> str:
    value = text.strip()
    if not value:
        return value
    if value.endswith("。"):
        return value
    return f"{value}。"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Finalize question JSON from Step 3 output")
    parser.add_argument(
        "--input-json",
        default="data/questions_step3_kana.json",
        help="Step 3 input JSON path",
    )
    parser.add_argument(
        "--output-json",
        default="data/questions.json",
        help="Final output JSON path",
    )
    parser.add_argument(
        "--output-manifest",
        default="data/finalize_manifest_step4.json",
        help="Step 4 summary manifest path",
    )
    parser.add_argument(
        "--output-invalid-kana-json",
        default="data/finalize_invalid_kana_step4.json",
        help="Invalid kana records report path",
    )
    parser.add_argument(
        "--output-unknown-sokuon-json",
        default="data/finalize_unknown_sokuon_step4.json",
        help="Unknown historical sokuon records report path",
    )
    parser.add_argument(
        "--fail-on-unknown-sokuon",
        action="store_true",
        help="Exit with code 1 if unresolved historical sokuon candidates are detected",
    )
    return parser.parse_args()


def sanitize_record(raw: Dict[str, object]) -> Dict[str, str] | None:
    text = ensure_terminal_period(str(raw.get("text", "")).strip())
    kana = ensure_terminal_period(str(raw.get("kana", "")).strip())
    field = str(raw.get("field", "")).strip()
    source = str(raw.get("source", "")).strip()

    if not text or not kana or not field or not source:
        return None

    return {
        "text": text,
        "kana": kana,
        "field": field,
        "source": source,
    }


def find_invalid_kana_chars(kana: str) -> List[str]:
    invalid_chars = {
        char for char in kana
        if not ALLOWED_KANA_CHAR_PATTERN.fullmatch(char)
    }
    return sorted(invalid_chars)


def main() -> int:
    args = parse_args()
    workspace = Path(__file__).resolve().parent.parent

    input_json = (workspace / args.input_json).resolve()
    output_json = (workspace / args.output_json).resolve()
    output_manifest = (workspace / args.output_manifest).resolve()
    output_invalid_kana_json = (workspace / args.output_invalid_kana_json).resolve()
    output_unknown_sokuon_json = (workspace / args.output_unknown_sokuon_json).resolve()

    if not input_json.exists():
        print(f"ERROR: input file not found: {input_json}", file=sys.stderr)
        return 2

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)
    output_invalid_kana_json.parent.mkdir(parents=True, exist_ok=True)
    output_unknown_sokuon_json.parent.mkdir(parents=True, exist_ok=True)

    try:
        raw = json.loads(input_json.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: JSON parse error: {exc}", file=sys.stderr)
        return 2

    if not isinstance(raw, list):
        print("ERROR: Step 3 JSON root must be an array", file=sys.stderr)
        return 2

    sanitized: List[Dict[str, str]] = []
    per_field_counts: Dict[str, int] = {}
    skipped_invalid = 0
    skipped_duplicate = 0
    skipped_invalid_kana = 0
    seen: set[Tuple[str, str, str]] = set()
    invalid_kana_records: List[Dict[str, object]] = []
    invalid_char_counts: Dict[str, int] = {}
    unknown_sokuon_records: List[Dict[str, object]] = []
    unknown_sokuon_record_count = 0
    unknown_sokuon_pattern_counts: Dict[str, int] = {}

    for item in raw:
        if not isinstance(item, dict):
            skipped_invalid += 1
            continue

        rec = sanitize_record(item)
        if rec is None:
            skipped_invalid += 1
            continue

        invalid_chars = find_invalid_kana_chars(rec["kana"])
        if invalid_chars:
            skipped_invalid_kana += 1
            invalid_kana_records.append(
                {
                    "field": rec["field"],
                    "source": rec["source"],
                    "text": rec["text"],
                    "kana": rec["kana"],
                    "invalid_chars": invalid_chars,
                }
            )
            for char in rec["kana"]:
                if char in invalid_chars:
                    invalid_char_counts[char] = invalid_char_counts.get(char, 0) + 1
            continue

        dedupe_key = (rec["field"], rec["source"], rec["text"])
        if dedupe_key in seen:
            skipped_duplicate += 1
            continue
        seen.add(dedupe_key)

        text_unknown_candidates = detect_historical_sokuon_candidates(rec["text"])
        if text_unknown_candidates:
            unknown_sokuon_record_count += 1
            for candidate in text_unknown_candidates:
                unknown_sokuon_pattern_counts[candidate] = unknown_sokuon_pattern_counts.get(candidate, 0) + 1

            unknown_sokuon_records.append(
                {
                    "field": rec["field"],
                    "source": rec["source"],
                    "text": rec["text"],
                    "kana": rec["kana"],
                    "text_unknown_patterns": sorted(set(text_unknown_candidates)),
                }
            )

        sanitized.append(rec)
        per_field_counts[rec["field"]] = per_field_counts.get(rec["field"], 0) + 1

    payload = {
        "questiondata": sanitized,
    }
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    invalid_kana_payload = {
        "invalid_kana_records": invalid_kana_records,
    }
    output_invalid_kana_json.write_text(
        json.dumps(invalid_kana_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    unknown_sokuon_payload = {
        "unknown_sokuon_records": unknown_sokuon_records,
    }
    output_unknown_sokuon_json.write_text(
        json.dumps(unknown_sokuon_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    sorted_invalid_char_counts = dict(
        sorted(
            invalid_char_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )
    )
    sorted_unknown_sokuon_pattern_counts = dict(
        sorted(
            unknown_sokuon_pattern_counts.items(),
            key=lambda item: (-item[1], item[0]),
        )
    )

    summary = {
        "input_count": len(raw),
        "output_count": len(sanitized),
        "skipped_invalid": skipped_invalid,
        "skipped_invalid_kana": skipped_invalid_kana,
        "skipped_duplicate": skipped_duplicate,
        "per_field_counts": per_field_counts,
    }

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "input_json": str(input_json.relative_to(workspace)).replace("\\", "/"),
        "output_json": str(output_json.relative_to(workspace)).replace("\\", "/"),
        "required_keys": list(REQUIRED_KEYS),
        "kana_validation": {
            "enabled": True,
            "allowed_chars": ALLOWED_KANA_DESCRIPTION,
            "invalid_kana_output_json": str(output_invalid_kana_json.relative_to(workspace)).replace("\\", "/"),
            "invalid_kana_record_count": skipped_invalid_kana,
            "invalid_char_frequency": sorted_invalid_char_counts,
            "invalid_kana_examples": invalid_kana_records[:20],
        },
        "sokuon_validation": {
            "enabled": True,
            "candidate_regex": HISTORICAL_SOKUON_CANDIDATE_RE.pattern,
            "unknown_sokuon_output_json": str(output_unknown_sokuon_json.relative_to(workspace)).replace("\\", "/"),
            "unknown_sokuon_record_count": unknown_sokuon_record_count,
            "unknown_sokuon_pattern_frequency": sorted_unknown_sokuon_pattern_counts,
            "unknown_sokuon_examples": unknown_sokuon_records[:20],
        },
        "summary": summary,
    }
    output_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== Step 4 finalize summary ===")
    print(f"Input json      : {input_json}")
    print(f"Output json     : {output_json}")
    print(f"Output manifest : {output_manifest}")
    print(f"Invalid kana report: {output_invalid_kana_json}")
    print(f"Unknown sokuon report: {output_unknown_sokuon_json}")
    print(f"Input count     : {len(raw)}")
    print(f"Output count    : {len(sanitized)}")
    print(f"Skipped invalid : {skipped_invalid}")
    print(f"Skipped invalid kana: {skipped_invalid_kana}")
    print(f"Skipped duplicate: {skipped_duplicate}")
    print(f"Unknown sokuon records: {unknown_sokuon_record_count}")
    if sorted_invalid_char_counts:
        print("Invalid kana chars:")
        for char, count in sorted_invalid_char_counts.items():
            print(f"- {char}: {count}")
    for field, count in sorted(per_field_counts.items()):
        print(f"- {field}: {count}")

    if not sanitized:
        print("ERROR: no usable records in final output", file=sys.stderr)
        return 2

    if args.fail_on_unknown_sokuon and unknown_sokuon_record_count > 0:
        print(
            "ERROR: unresolved historical sokuon candidates detected. "
            "Check data/finalize_unknown_sokuon_step4.json.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
