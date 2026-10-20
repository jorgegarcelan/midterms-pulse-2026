"""
Who is defending each House seat: +1 a Democratic incumbent is on the ballot, −1 a Republican one,
0 open seat (or two incumbents facing each other after a redraw).

An incumbent is anyone who won a House race (regular or special) in the previous two years,
matched by FiveThirtyEight's politician_id, so members who moved to a renumbered district after
redistricting still count. 2026 comes from the project's candidate list (public/data/candidates-2026.json).

Source: FiveThirtyEight election-results (CC BY 4.0), election_results_house.csv (see national.py).

Usage: census-model/.venv/bin/python census-model/incumbency.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
RAW = ROOT / "data" / "raw" / "election_results_house.csv"
AT_LARGE = {"AK", "DE", "ND", "SD", "VT", "WY"}
PARTY = {"DEM": "D", "DFL": "D", "REP": "R"}


def code_of(row):
    number = int(row["office_seat_name"].replace("District ", ""))
    return f"{row['state_abbrev']}-{0 if row['state_abbrev'] in AT_LARGE or number == 0 else number:02d}"


def history():
    rows = pd.read_csv(RAW, dtype=str, low_memory=False)
    rows["cycle"] = rows["cycle"].astype(int)
    rows["code"] = rows.apply(code_of, axis=1)
    rows["party"] = rows["ballot_party"].map(PARTY)
    out = []
    for year in range(2012, 2026, 2):
        winners = set(rows.loc[(rows["winner"] == "true") & rows["cycle"].isin([year - 2, year - 1]), "politician_id"].dropna())
        running = rows[(rows["cycle"] == year) & (rows["special"] != "true") & rows["party"].notna()]
        running = running.assign(incumbent=running["politician_id"].isin(winners))
        flags = running[running["incumbent"]].groupby("code")["party"].agg(lambda p: set(p))
        for code in running["code"].unique():
            parties = flags.get(code, set())
            out.append({"year": year, "code": code, "dem_incumbent": int("D" in parties), "rep_incumbent": int("R" in parties)})
    return pd.DataFrame(out)


def year_2026():
    candidates = pd.DataFrame(json.loads((PROJECT / "public/data/candidates-2026.json").read_text())["candidates"])
    house = candidates[candidates["chamber"] == "house"]
    parties = house[house["incumbent"]].groupby("race")["party"].agg(lambda p: set(p)).reindex(sorted(house["race"].unique()))
    parties = parties.apply(lambda p: p if isinstance(p, set) else set())  # districts with no incumbent on the ballot
    return pd.DataFrame({"year": 2026, "code": parties.index, "dem_incumbent": [int("D" in p) for p in parties],
                         "rep_incumbent": [int("R" in p) for p in parties]})


def main():
    frame = pd.concat([history(), year_2026()], ignore_index=True)
    frame["incumbent"] = frame["dem_incumbent"] - frame["rep_incumbent"]  # both or neither → 0
    frame.to_csv(ROOT / "data" / "incumbency.csv", index=False)
    print(frame.groupby("year").agg(races=("code", "size"), dem=("dem_incumbent", "sum"), rep=("rep_incumbent", "sum"),
                                    open=("incumbent", lambda s: (s == 0).sum())).to_string())


if __name__ == "__main__":
    main()
