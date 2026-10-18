"""
Join ACS district profiles with House results: one row per district and election year.

Each ACS release is tabulated on the district lines its election was fought on (see LINES), so
features and result describe the same territory. NC 2020 is dropped: the state redrew in 2019,
after the 116th Congress lines the ACS uses.

Target: two-party Democratic margin, 100 * (D - R) / (D + R), in races with both parties on the
ballot. Uncontested seats stay in the file (contested = 0) for seat counts, without a margin.

Usage: census-model/.venv/bin/python census-model/build_dataset.py
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
DATA = ROOT / "data"

# ACS 5-year release -> Congress whose district lines it uses (Gazetteer vintage).
LINES = {2012: "2013_Gaz_113CDs", 2014: "2015_Gaz_114CDs", 2016: "2017_Gaz_115CDs", 2018: "2019_Gaz_116CDs",
         2020: "2019_Gaz_116CDs", 2022: "2023_Gaz_118CDs", 2024: "2024_Gaz_119CDs"}
SKIP = {(2020, "NC")}

FIPS = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "12": "FL", "13": "GA",
    "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
    "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
    "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
    "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
}
# Census divisions: the only geography the model sees besides the district's own profile.
DIVISION = {
    "New England": "CT ME MA NH RI VT", "Mid-Atlantic": "NJ NY PA", "East North Central": "IL IN MI OH WI",
    "West North Central": "IA KS MN MO NE ND SD", "South Atlantic": "DE FL GA MD NC SC VA WV",
    "East South Central": "AL KY MS TN", "West South Central": "AR LA OK TX", "Mountain": "AZ CO ID MT NV NM UT WY",
    "Pacific": "AK CA HI OR WA",
}
STATE_DIVISION = {state: division for division, states in DIVISION.items() for state in states.split()}


def area(vintage):
    frame = pd.read_csv(DATA / "gazetteer" / f"{vintage}_national.txt", sep="\t", dtype={"GEOID": str})
    frame.columns = frame.columns.str.strip()
    frame["code"] = frame["USPS"] + "-" + frame["GEOID"].str[2:]
    return frame.set_index("code")["ALAND_SQMI"]


def features(acs):
    pct = lambda part, whole: 100 * acs[part] / acs[whole]
    out = pd.DataFrame(index=acs.index)
    out["log_density"] = np.log10(acs["pop"] / acs["land_sqmi"])
    out["median_age"] = acs["median_age"]
    # Dollar amounts are nominal: compare each district with the median district of its release.
    out["income_index"] = np.log(acs["median_income"] / acs["median_income"].median())
    out["home_value_index"] = np.log(acs["median_home_value"] / acs["median_home_value"].median())
    out["poverty"] = pct("poverty", "poverty_universe")
    out["bachelors"] = pct("bachelors", "edu_universe")
    out["hs_or_less"] = pct("hs_or_less", "edu_universe")
    out["white_noncollege"] = 100 * (acs["white_nh_edu_universe"] - acs["white_nh_bachelors"]) / acs["edu_universe"]
    out["white_college"] = pct("white_nh_bachelors", "edu_universe")
    out["white"] = pct("white_nh", "race_universe")
    out["black"] = pct("black_nh", "race_universe")
    out["hispanic"] = pct("hispanic", "race_universe")
    out["asian"] = pct("asian_nh", "race_universe")
    out["unemployment"] = pct("unemployed", "labor_force")
    out["owner"] = pct("owner", "tenure_universe")
    out["foreign_born"] = pct("foreign_born", "nativity_universe")
    out["veterans"] = pct("veterans", "vet_universe")
    out["public_transport"] = pct("public_transport", "commute_universe")
    out["work_from_home"] = pct("work_from_home", "commute_universe")
    out["married"] = pct("married", "marital_universe")
    out["age_18_29"] = pct("age_18_29", "pop")
    out["age_65_plus"] = pct("age_65_plus", "pop")
    return out


def load_acs(year):
    acs = pd.read_csv(DATA / "acs" / f"acs5_{year}_cd.csv", dtype={"state": str, "cd": str})
    acs = acs[acs["state"].isin(FIPS) & ~acs["cd"].isin(["ZZ", "98"])].copy()
    acs["code"] = acs["state"].map(FIPS) + "-" + acs["cd"]
    acs = acs.set_index("code")
    acs["land_sqmi"] = area(LINES[year]).reindex(acs.index)
    return acs


def load_results():
    rows = []
    for file in sorted((PROJECT / "public/data/history/house").glob("*.json")):
        for code, results in json.loads(file.read_text())["districts"].items():
            for result in results:
                rows.append({"code": code, "year": result["y"], "dp": result["dp"], "rp": result["rp"], "winner": result["w"], "unopposed": "u" in result})
    return pd.DataFrame(rows)


def main():
    results = load_results()
    frames = []
    for year in LINES:
        acs = load_acs(year)
        frame = features(acs)
        frame.insert(0, "year", year)
        frame.insert(1, "state", frame.index.str[:2])
        frame.insert(2, "division", frame["state"].map(STATE_DIVISION))
        frames.append(frame.reset_index())
    data = pd.concat(frames, ignore_index=True)
    data = data[[(year, state) not in SKIP for year, state in zip(data["year"], data["state"])]]

    data = data.merge(results, on=["code", "year"], how="left")
    contested = (data["dp"] > 0) & (data["rp"] > 0) & ~data["unopposed"].fillna(False).astype(bool)
    data["contested"] = contested.astype(int)
    data["margin"] = np.where(contested, 100 * (data["dp"] - data["rp"]) / (data["dp"] + data["rp"]), np.nan)
    data = data.drop(columns=["dp", "rp", "unopposed"])

    data.to_csv(DATA / "dataset.csv", index=False)
    summary = data.groupby("year").agg(districts=("code", "size"), contested=("contested", "sum"), no_result=("winner", lambda s: s.isna().sum()),
                                       dem_seats=("winner", lambda s: (s == "D").sum()), mean_margin=("margin", "mean"))
    print(summary.round(1).to_string())
    print("feature gaps:", int(data.drop(columns=["margin", "winner"]).isna().sum().sum()))


if __name__ == "__main__":
    main()
