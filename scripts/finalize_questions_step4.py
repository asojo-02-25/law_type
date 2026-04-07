#!/usr/bin/env python3
"""Step 4: Finalize question JSON for app consumption.

Input:
- data/questions_step3_kana.json

Output:
- data/questions.json
- data/finalize_manifest_step4.json

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
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


REQUIRED_KEYS = ("text", "kana", "field", "source")


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


def main() -> int:
    args = parse_args()
    workspace = Path(__file__).resolve().parent.parent

    input_json = (workspace / args.input_json).resolve()
    output_json = (workspace / args.output_json).resolve()
    output_manifest = (workspace / args.output_manifest).resolve()

    if not input_json.exists():
        print(f"ERROR: input file not found: {input_json}", file=sys.stderr)
        return 2

    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_manifest.parent.mkdir(parents=True, exist_ok=True)

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
    seen: set[Tuple[str, str, str]] = set()

    for item in raw:
        if not isinstance(item, dict):
            skipped_invalid += 1
            continue

        rec = sanitize_record(item)
        if rec is None:
            skipped_invalid += 1
            continue

        dedupe_key = (rec["field"], rec["source"], rec["text"])
        if dedupe_key in seen:
            skipped_duplicate += 1
            continue
        seen.add(dedupe_key)

        sanitized.append(rec)
        per_field_counts[rec["field"]] = per_field_counts.get(rec["field"], 0) + 1

    payload = {
        "questiondata": sanitized,
    }
    output_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    summary = {
        "input_count": len(raw),
        "output_count": len(sanitized),
        "skipped_invalid": skipped_invalid,
        "skipped_duplicate": skipped_duplicate,
        "per_field_counts": per_field_counts,
    }

    manifest = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "input_json": str(input_json.relative_to(workspace)).replace("\\", "/"),
        "output_json": str(output_json.relative_to(workspace)).replace("\\", "/"),
        "required_keys": list(REQUIRED_KEYS),
        "summary": summary,
    }
    output_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== Step 4 finalize summary ===")
    print(f"Input json      : {input_json}")
    print(f"Output json     : {output_json}")
    print(f"Output manifest : {output_manifest}")
    print(f"Input count     : {len(raw)}")
    print(f"Output count    : {len(sanitized)}")
    print(f"Skipped invalid : {skipped_invalid}")
    print(f"Skipped duplicate: {skipped_duplicate}")
    for field, count in sorted(per_field_counts.items()):
        print(f"- {field}: {count}")

    if not sanitized:
        print("ERROR: no usable records in final output", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
