#!/usr/bin/env python3
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from engine.orchestrator_w08 import analyze_chart


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the W08 four-profile analysis pipeline.")
    parser.add_argument("--chart", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--stage", choices=["natal", "luck", "annual"], default="natal")
    parser.add_argument("--luck-cycle-id")
    parser.add_argument("--annual-id")
    parser.add_argument("--compare-schools", action="store_true", help="Include the optional cross-school comparison view.")
    parser.add_argument("--public-only", action="store_true", help="Write only the reader-facing school-separated result.")
    args = parser.parse_args()
    chart = json.loads(args.chart.read_text(encoding="utf-8"))
    result = analyze_chart(chart, stage=args.stage, luck_cycle_id=args.luck_cycle_id, annual_id=args.annual_id, include_comparison=args.compare_schools)
    document = result["public_output"] if args.public_only else result
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "analysis_id": result["analysis_id"],
        "profile_count": len(result["profile_runs"]),
        "finding_count": result["finding_count"],
        "comparison_count": len(result["comparisons"]),
        "output": str(args.out),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
