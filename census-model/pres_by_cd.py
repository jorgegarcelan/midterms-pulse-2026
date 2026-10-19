"""
Presidential lean of each district: the last presidential result on the lines the House race is
fought on, as two-party D − R margin minus the national two-party margin of that election.

Source: The Downballot's presidential results by congressional district (one public Google Sheet
per map, "Vote totals" tab), https://www.the-downballot.com/p/the-downballots-calculations-of-presidential
Write-ins are mostly excluded, so totals run slightly below official counts.

Gaps in the source (California for 2008, Florida for 2012 on the 2016 lines) are filled from
the district's census profile with a Ridge fit on the same year's districts, and flagged.

Usage: census-model/.venv/bin/python census-model/pres_by_cd.py
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "data" / "raw" / "pres"

SHEETS = {  # map → (sheet id, vote-totals gid)
    "113": ("1xn6nCNM97oFDZ4M-HQgoUT3X4paOiSDsRMSuxbaOBdg", "1653614940"),
    "115": ("1VfkHtzBTP5gf4jAu8tcVQgsBJ1IDvXEHjuMqYlOgYbA", "1445854919"),
    "116": ("1zLNAuRqPauss00HDz4XbTH2HqsCzMe0pR8QmD1K8jk8", "470496023"),
    "118": ("1CKngqOp8fzU22JOlypoxNsxL6KSAH920Whc-rd7ebuM", "1913458313"),
    "119": ("1ng1i_Dm_RMDnEvauH44pgE6JCUsapcuu8F2pCfeLWFo", "1491069057"),
    "120": ("1eZfaFI-c-PFOoKx1-zZA2MP0_dxRq_LVK0re3BOQqy0", "1491069057"),
}
# (House election, map sheet, presidential year, column of the Democratic vote, its header).
# The Republican vote is the next column. 2026 also gets the 2024 lines (119), so the effect of
# the new maps can be measured with the same presidential election on both sets of lines.
PAIRS = [
    (2012, "113", 2008, 10, "Obama"),
    (2014, "113", 2012, 4, "Obama"),
    (2016, "115", 2012, 10, "Obama"),
    (2018, "116", 2016, 10, "Clinton"),
    (2020, "116", 2016, 10, "Clinton"),
    (2022, "118", 2020, 3, "Biden"),
    (2024, "119", 2020, 10, "Biden"),
    (2026, "120", 2024, 4, "Harris"),
    (2026, "119", 2024, 3, "Harris"),
]
# National two-party margins, from the complete sheets; 2008 (California missing everywhere) is official.
NATIONAL_2008 = 100 * (69_498_516 - 59_948_323) / (69_498_516 + 59_948_323)
COMPLETE = {2012: ("113", 4), 2016: ("116", 10), 2020: ("118", 3), 2024: ("119", 3)}
DISTRICT = re.compile(r"^[A-Z]{2}-(AL|\d\d)$")


def sheet(name):
    path = RAW / f"l{name}.csv"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet_id, gid = SHEETS[name]
        response = requests.get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}", timeout=120)
        response.raise_for_status()
        path.write_bytes(response.content)
    rows = pd.read_csv(path, header=None, dtype=str, keep_default_na=False)
    return rows


def votes(rows, column, header=None):
    if header:
        assert (rows.iloc[:6, column] == header).any(), f"column {column} is not {header}"
    body = rows[rows[0].str.match(DISTRICT)]
    number = lambda c: pd.to_numeric(body[c].str.replace(",", ""), errors="coerce")
    code = body[0].str.replace("-AL", "-00")
    return pd.DataFrame({"code": code.to_numpy(), "dem": number(column).to_numpy(), "rep": number(column + 1).to_numpy()})


def national(year):
    if year == 2008:
        return NATIONAL_2008
    name, column = COMPLETE[year]
    v = votes(sheet(name), column)
    assert v[["dem", "rep"]].notna().all().all() and len(v) == 435
    return 100 * (v["dem"].sum() - v["rep"].sum()) / (v["dem"].sum() + v["rep"].sum())


def impute(frame, dataset):
    """Fill missing leans from the census profile, fitted on the same House year."""
    features = [c for c in dataset.columns if c not in {"code", "year", "state", "division", "winner", "contested", "margin"}]
    filled = []
    for (year, _), group in frame.groupby(["year", "lines"]):
        group = group.copy()
        missing = group["pres_lean"].isna()
        if missing.any():
            x = dataset[dataset["year"] == (year if year != 2026 else 2024)].set_index("code").reindex(group["code"])[features]
            model = make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 20))).fit(x[~missing.to_numpy()], group.loc[~missing, "pres_lean"])
            group.loc[missing, "pres_lean"] = model.predict(x[missing.to_numpy()])
        group["imputed"] = missing.astype(int)
        filled.append(group)
    return pd.concat(filled)


def main():
    frames = []
    for house_year, name, pres_year, column, header in PAIRS:
        v = votes(sheet(name), column, header)
        v.insert(1, "lines", name)
        v["pres_margin"] = 100 * (v["dem"] - v["rep"]) / (v["dem"] + v["rep"])
        v["pres_lean"] = v["pres_margin"] - national(pres_year)
        v.insert(0, "year", house_year)
        v.insert(2, "pres_year", pres_year)
        frames.append(v.drop(columns=["dem", "rep"]))
    out = pd.concat(frames, ignore_index=True)
    out = impute(out, pd.read_csv(ROOT / "data" / "dataset.csv"))
    out.round(2).to_csv(ROOT / "data" / "pres-lean.csv", index=False)
    print(out.groupby(["year", "lines"]).agg(districts=("code", "size"), imputed=("imputed", "sum"), pres_year=("pres_year", "first"),
                                  mean_lean=("pres_lean", "mean")).round(2).to_string())
    print({year: round(national(year), 2) for year in [2008, 2012, 2016, 2020, 2024]})


if __name__ == "__main__":
    main()
