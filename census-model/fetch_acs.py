"""
Download ACS 5-year estimates for every congressional district, one file per release.

Each release is tabulated on the districts of a given Congress, so it is paired with the
House election fought on those lines (see YEARS). The key is read from CENSUS_API_KEY in the
environment or in the project's .env.local and is never printed.

Usage: census-model/.venv/bin/python census-model/fetch_acs.py [year ...]
"""
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data" / "acs"

# ACS 5-year release -> House election it describes (same district lines).
YEARS = {2012: 2012, 2014: 2014, 2016: 2016, 2018: 2018, 2020: 2020, 2022: 2022, 2024: 2024}


def r(table, *cells):
    return [f"{table}_{cell:03d}E" for cell in cells]


# Raw counts; rates are derived in build_dataset.py.
VARIABLES = {
    "pop": r("B01003", 1),
    "median_age": r("B01002", 1),
    "median_income": r("B19013", 1),
    "median_home_value": r("B25077", 1),
    "poverty_universe": r("B17001", 1),
    "poverty": r("B17001", 2),
    "edu_universe": r("B15002", 1),
    "bachelors": r("B15002", 15, 16, 17, 18, 32, 33, 34, 35),
    "hs_or_less": r("B15002", *range(3, 12), *range(20, 29)),
    "white_nh_edu_universe": r("C15002H", 1),
    "white_nh_bachelors": r("C15002H", 6, 11),
    "race_universe": r("B03002", 1),
    "white_nh": r("B03002", 3),
    "black_nh": r("B03002", 4),
    "asian_nh": r("B03002", 6),
    "hispanic": r("B03002", 12),
    "labor_force": r("B23025", 3),
    "unemployed": r("B23025", 5),
    "tenure_universe": r("B25003", 1),
    "owner": r("B25003", 2),
    "nativity_universe": r("B05002", 1),
    "foreign_born": r("B05002", 13),
    "vet_universe": r("B21001", 1),
    "veterans": r("B21001", 2),
    "commute_universe": r("B08301", 1),
    "public_transport": r("B08301", 10),
    "work_from_home": r("B08301", 21),
    "marital_universe": r("B12001", 1),
    "married": r("B12001", 4, 13),
    "age_18_29": r("B01001", *range(7, 12), *range(31, 36)),
    "age_65_plus": r("B01001", *range(20, 26), *range(44, 50)),
}


def api_key():
    if os.environ.get("CENSUS_API_KEY"):
        return os.environ["CENSUS_API_KEY"].strip()
    env = ROOT.parent / ".env.local"
    for line in env.read_text().splitlines():
        if line.startswith("CENSUS_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("CENSUS_API_KEY not found in the environment or .env.local")


def fetch(year, codes, key, geography=("congressional district:*", "state:*")):
    url = f"https://api.census.gov/data/{year}/acs/acs5"
    params = {"get": ",".join(codes), "for": geography[0], "in": geography[1], "key": key}
    for attempt in range(4):
        response = requests.get(url, params=params, timeout=60)
        if response.ok:
            rows = response.json()
            return pd.DataFrame(rows[1:], columns=rows[0])
        if response.status_code < 500:
            raise RuntimeError(f"{year}: HTTP {response.status_code} {response.text[:200]}")
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{year}: Census API kept failing")


def fetch_year(year, key, geography=("congressional district:*", "state:*")):
    """Every VARIABLES count for one geography; congressional districts unless told otherwise."""
    codes = sorted({code for cells in VARIABLES.values() for code in cells})
    frames = []
    for start in range(0, len(codes), 45):  # the API takes at most 50 variables per call
        frame = fetch(year, codes[start:start + 45], key, geography)
        frames.append(frame.set_index([c for c in frame.columns if c not in codes]))
    raw = pd.concat(frames, axis=1).apply(pd.to_numeric, errors="coerce")
    raw[raw < -100000] = pd.NA  # Census sentinels for suppressed / not applicable values
    out = pd.DataFrame({name: raw[cells].sum(axis=1, min_count=len(cells)) for name, cells in VARIABLES.items()})
    out = out.reset_index().rename(columns={"congressional district": "cd"})
    out.insert(0, "acs_year", year)
    return out


def main():
    key = api_key()
    OUT.mkdir(parents=True, exist_ok=True)
    years = [int(arg) for arg in sys.argv[1:]] or list(YEARS)
    for year in years:
        frame = fetch_year(year, key)
        frame.to_csv(OUT / f"acs5_{year}_cd.csv", index=False)
        print(f"{year}: {len(frame)} districts, {frame.isna().sum().sum()} missing cells")


if __name__ == "__main__":
    main()
