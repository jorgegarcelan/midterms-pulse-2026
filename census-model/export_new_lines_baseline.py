"""
Baseline for the districts of the nine states that vote on new maps in November 2026:
src/data/pres-2024-new-lines.json.

The forecast feed's 2024 baseline is the House result of the old district with the same number,
which for these states is different territory. No House race was ever held on the new lines, so
the site shows the 2024 presidential two-party D − R margin measured on them instead
(data/pres-lean.csv, year 2026, lines 120; built by pres_by_cd.py).

Usage: census-model/.venv/bin/python census-model/export_new_lines_baseline.py
"""
import csv
import json
from pathlib import Path

from redistrict import REDRAWN_2026

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "src" / "data" / "pres-2024-new-lines.json"


def main():
    with open(ROOT / "data" / "pres-lean.csv", newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if row["year"] == "2026" and row["lines"] == "120" and row["code"][:2] in REDRAWN_2026]
    margins = {row["code"]: round(float(row["pres_margin"]), 1) for row in sorted(rows, key=lambda row: row["code"])}
    imputed = [row["code"] for row in rows if row["imputed"] == "1"]
    assert not imputed, f"imputed districts: {imputed}"
    assert {code[:2] for code in margins} == set(REDRAWN_2026)
    payload = {"source": "The Downballot, 2024 presidential results by congressional district (120th Congress maps)", "states": REDRAWN_2026, "margins": margins}
    OUT.write_text(json.dumps(payload, indent=1) + "\n")
    print(f"{OUT.relative_to(ROOT.parent)}: {len(margins)} districts")


if __name__ == "__main__":
    main()
