"""
National House popular vote, two-party D − R margin, 2000–2024 regular elections.

This is the national level of the model. The mean margin of contested districts is not used: it
moves with which seats the parties contest (in 2018 Democrats ran almost everywhere, so the mean
said D+4.4 while the country voted D+8.7).

Source: FiveThirtyEight election-results (CC BY 4.0), election_results_house.csv. General elections
plus Louisiana's November jungle primary, first ranked-choice round, specials excluded.

Usage: census-model/.venv/bin/python census-model/national.py
"""
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw" / "election_results_house.csv"
OUT = ROOT / "data" / "national-house-vote.csv"
URL = "https://raw.githubusercontent.com/fivethirtyeight/election-results/main/election_results_house.csv"


def main():
    if not RAW.exists():
        RAW.parent.mkdir(parents=True, exist_ok=True)
        RAW.write_bytes(requests.get(URL, timeout=120).content)
    rows = pd.read_csv(RAW, dtype=str, low_memory=False)
    rows = rows[rows["stage"].isin(["general", "jungle primary"]) & (rows["special"] != "true")]
    rows["cycle"] = rows["cycle"].astype(int)
    rows = rows[(rows["cycle"] >= 2000) & (rows["cycle"] % 2 == 0)]
    rows = rows[pd.to_numeric(rows["ranked_choice_round"], errors="coerce").fillna(1) == 1]
    rows["votes"] = pd.to_numeric(rows["votes"], errors="coerce").fillna(0)
    rows["party"] = rows["ballot_party"].map({"DEM": "D", "DFL": "D", "REP": "R"})
    votes = rows.groupby(["cycle", "party"])["votes"].sum().unstack()
    out = pd.DataFrame({"year": votes.index, "dem_votes": votes["D"].astype(int), "rep_votes": votes["R"].astype(int),
                        "margin": (100 * (votes["D"] - votes["R"]) / (votes["D"] + votes["R"])).round(2)})
    out.to_csv(OUT, index=False)
    print(out.to_string(index=False))


if __name__ == "__main__":
    main()
