"""
Census profiles for district lines the ACS does not publish (the 2026 mid-decade maps).

ACS 2024 5-year counts are downloaded by census tract. Every block group is placed in a district,
by its block assignment when the plan publishes one (share of 2020 block population), otherwise
by its 2020 centre of population. Each tract's counts are then split between districts in
proportion to the 2020 population of its block groups on each side. Medians are averaged with
population weights; land area is the sum of the block groups' land area.

The 2026 plans come from the Census Bureau's 120th Congress block equivalency file (cd120.zip,
regenerated 7 Oct 2026 with every plan in force in November). Missouri's 2025 map is blocked by a
referendum, so Missouri keeps its 2022 lines and is not rebuilt.

Commands:
  validate      rebuild the 2024 (119th) districts of the redrawn states from block-group centres
                and compare with the official ACS district tables: the error of the method itself
  check-blocks  rebuild Missouri from the 120th file; its lines did not change, so this checks the
                block path against the official tables
  build-2026    write data/acs/acs5_2024_cd2026.csv: ACS profiles of the redrawn states' 2026 districts

Usage: census-model/.venv/bin/python census-model/redistrict.py <command>
"""
import io
import json
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import shapefile
from pyproj import CRS, Transformer
from shapely import STRtree, points
from shapely.geometry import shape

import fetch_acs
from build_dataset import FIPS, features

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
GEO = ROOT / "data" / "geo"
TRACTS = ROOT / "data" / "acs_tract"
ABBR = {abbr: fips for fips, abbr in FIPS.items()}
REDRAWN_2026 = ["AL", "CA", "FL", "LA", "NC", "OH", "TN", "TX", "UT"]  # Missouri's 2025 map is blocked for 2026
VALIDATION_STATES = REDRAWN_2026 + ["MO"]
BEF_120 = "https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2027/120-congressional-district-befs/cd120.zip"
MEDIANS = {"median_age": "pop", "median_income": "pop", "median_home_value": "owner"}  # median → weight


def download(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(url, timeout=300)
        response.raise_for_status()
        path.write_bytes(response.content)
    return path


def block_groups(fips):
    """2020 block groups: centre of population, 2020 population and land area."""
    centres = pd.read_csv(download(f"https://www2.census.gov/geo/docs/reference/cenpop2020/blkgrp/CenPop2020_Mean_BG{fips}.txt",
                                   GEO / f"CenPop2020_Mean_BG{fips}.txt"), dtype=str, encoding="utf-8-sig")
    centres["geoid"] = centres["STATEFP"] + centres["COUNTYFP"] + centres["TRACTCE"] + centres["BLKGRPCE"]
    archive = download(f"https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_{fips}_bg_500k.zip", GEO / f"cb_2024_{fips}_bg_500k.zip")
    with zipfile.ZipFile(archive) as zipped:
        dbf = next(name for name in zipped.namelist() if name.endswith(".dbf"))
        reader = shapefile.Reader(dbf=io.BytesIO(zipped.read(dbf)))
        land = pd.DataFrame([dict(zip([f[0] for f in reader.fields[1:]], record)) for record in reader.records()])
    out = centres.merge(land[["GEOID", "ALAND"]].rename(columns={"GEOID": "geoid", "ALAND": "aland"}), on="geoid", how="left")
    out["pop2020"] = out["POPULATION"].astype(float)
    out["lat"], out["lon"] = out["LATITUDE"].astype(float), out["LONGITUDE"].astype(float)
    out["aland"] = out["aland"].fillna(0).astype(float)
    out["tract"] = out["geoid"].str[:11]
    return out[["geoid", "tract", "pop2020", "aland", "lat", "lon"]]


def tract_profiles(fips, key=None):
    path = TRACTS / f"acs5_2024_{fips}.csv"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        fetch_acs.fetch_year(2024, key or fetch_acs.api_key(), ("tract:*", f"state:{fips}")).to_csv(path, index=False)
    frame = pd.read_csv(path, dtype={"state": str, "county": str, "tract": str})
    frame["tract"] = frame["state"] + frame["county"] + frame["tract"]
    return frame.drop(columns=["state", "county", "acs_year"])


def assign_by_points(groups, districts, crs=None):
    """districts: {code: shapely geometry} in `crs` (lon/lat when None). Block group → district (nearest when outside all)."""
    codes, geoms = list(districts), list(districts.values())
    tree = STRtree(geoms)
    x, y = groups["lon"].to_numpy(), groups["lat"].to_numpy()
    if crs is not None and not CRS(crs).is_geographic:
        x, y = Transformer.from_crs("EPSG:4326", CRS(crs), always_xy=True).transform(x, y)
    pts = points(x, y)
    hits = tree.query(pts, predicate="within")
    code = np.full(len(groups), None, dtype=object)
    code[hits[0]] = np.array(codes, dtype=object)[hits[1]]
    missing = np.where(code == None)[0]  # noqa: E711 — points on the coast or in water slivers
    if len(missing):
        code[missing] = np.array(codes, dtype=object)[tree.nearest(pts[missing])]
    return pd.Series(code, index=groups["geoid"].to_numpy())


def block_population(fips, key):
    """2020 census population of every block in the state (P.L. 94-171)."""
    path = GEO / f"blocks2020_{fips}.csv"
    if not path.exists():
        response = requests.get("https://api.census.gov/data/2020/dec/pl", timeout=300,
                                params={"get": "P1_001N", "for": "block:*", "in": f"state:{fips} county:*", "key": key})
        response.raise_for_status()
        rows = response.json()
        frame = pd.DataFrame(rows[1:], columns=rows[0])
        frame["block"] = frame["state"] + frame["county"] + frame["tract"] + frame["block"]
        frame[["block", "P1_001N"]].rename(columns={"P1_001N": "pop"}).to_csv(path, index=False)
    return pd.read_csv(path, dtype={"block": str})


def assign_by_blocks(blocks, plan):
    """plan: DataFrame(block, code). Returns (geoid, code, share): each block group's population split."""
    joined = blocks.merge(plan, on="block", how="inner")
    joined["geoid"] = joined["block"].str[:12]
    pop = joined.groupby(["geoid", "code"])["pop"].sum().reset_index()
    count = joined.groupby(["geoid", "code"]).size().rename("n").reset_index()
    pop = pop.merge(count, on=["geoid", "code"])
    totals = pop.groupby("geoid")[["pop", "n"]].transform("sum")
    pop["share"] = np.where(totals["pop"] > 0, pop["pop"] / totals["pop"].where(totals["pop"] > 0, 1), pop["n"] / totals["n"])
    return pop[["geoid", "code", "share"]]


def shapes_from_zip(archive, abbr, district_of):
    """District polygons and their CRS (WKT) from a zipped shapefile; district_of(record dict) → district number."""
    with zipfile.ZipFile(archive) as zipped:
        stem = next(name[:-4] for name in zipped.namelist() if name.lower().endswith(".shp") and "__macosx" not in name.lower())
        member = lambda ext: next((n for n in zipped.namelist() if n.lower() == f"{stem}.{ext}".lower()), None)
        files = {ext: io.BytesIO(zipped.read(member(ext))) for ext in ("shp", "dbf", "shx")}
        crs = zipped.read(member("prj")).decode() if member("prj") else None
    reader = shapefile.Reader(**files)
    names = [f[0] for f in reader.fields[1:]]
    out = {}
    for item in reader.shapeRecords():
        number = int(district_of(dict(zip(names, item.record))))
        out[f"{abbr}-{number:02d}"] = shape(item.shape.__geo_interface__)
    return out, crs


def aggregate(tracts, groups, assignment):
    """assignment: DataFrame(geoid, code, share) — the share of each block group's population in a district."""
    parts = groups.merge(assignment, on="geoid")
    parts["pop_part"] = parts["pop2020"] * parts["share"]
    parts["land_part"] = parts["aland"] * parts["share"]
    by_tract = parts.groupby(["tract", "code"]).agg(pop_part=("pop_part", "sum"), groups=("share", "sum"), land=("land_part", "sum")).reset_index()
    totals = by_tract.groupby("tract")[["pop_part", "groups"]].transform("sum")
    # Unpopulated tracts (parks, water, airports) are split by number of block groups instead.
    by_tract["weight"] = np.where(totals["pop_part"] > 0, by_tract["pop_part"] / totals["pop_part"].where(totals["pop_part"] > 0, 1), by_tract["groups"] / totals["groups"])

    split = by_tract.merge(tracts, on="tract", how="left")
    counts = [c for c in tracts.columns if c not in {"tract", *MEDIANS}]
    out = split[counts].mul(split["weight"], axis=0).groupby(split["code"]).sum()
    for median, base in MEDIANS.items():
        weight = (split[base] * split["weight"]).where(split[median].notna(), 0)
        out[median] = (split[median].fillna(0) * weight).groupby(split["code"]).sum() / weight.groupby(split["code"]).sum()
    out["land_sqmi"] = by_tract.groupby("code")["land"].sum() / 2589988.11
    return out


def profiles_from_points(states, districts_of):
    """districts_of(abbr) → {code: geometry}. Returns ACS-like rows indexed by district code."""
    key = fetch_acs.api_key()
    frames = []
    for abbr in states:
        fips = ABBR[abbr]
        groups, tracts = block_groups(fips), tract_profiles(fips, key)
        assignment = assign_by_points(groups, districts_of(abbr)).rename("code").rename_axis("geoid").reset_index().assign(share=1.0)
        frames.append(aggregate(tracts, groups, assignment))
    return pd.concat(frames)


def districts_119(abbr):
    geojson = json.loads((PROJECT / "public/data/congressional-districts-119.geojson").read_text())
    return {f"{abbr}-{f['properties']['CD119FP']}": shape(f["geometry"]) for f in geojson["features"] if f["properties"]["STATEFP"] == ABBR[abbr]}


def plan_120(states):
    """Block → district for the given states, from the Census 120th Congress national file."""
    archive = download(BEF_120, ROOT / "data" / "raw" / "cd120.zip")
    with zipfile.ZipFile(archive) as zipped:
        plan = pd.read_csv(zipped.open("NationalCD120.txt"), dtype=str, usecols=["GEOID", "STATEFP", "CDFP"])
    plan = plan[plan["STATEFP"].isin([ABBR[a] for a in states])]
    return pd.DataFrame({"block": plan["GEOID"], "code": plan["STATEFP"].map(FIPS) + "-" + plan["CDFP"]})


def profiles_from_blocks(states, plan):
    key = fetch_acs.api_key()
    frames = []
    for abbr in states:
        fips = ABBR[abbr]
        groups, tracts = block_groups(fips), tract_profiles(fips, key)
        state_plan = plan[plan["code"].str[:2] == abbr]
        frames.append(aggregate(tracts, groups, assign_by_blocks(block_population(fips, key), state_plan)))
    return pd.concat(frames)


def official_2024(states):
    official = pd.read_csv(ROOT / "data/acs/acs5_2024_cd.csv", dtype={"state": str, "cd": str})
    official = official[official["state"].isin([ABBR[a] for a in states]) & (official["cd"] != "ZZ")]
    official.index = official["state"].map(FIPS) + "-" + official["cd"]
    gazetteer = pd.read_csv(ROOT / "data/gazetteer/2024_Gaz_119CDs_national.txt", sep="\t", dtype={"GEOID": str})
    gazetteer.columns = gazetteer.columns.str.strip()
    area = dict(zip(gazetteer["USPS"] + "-" + gazetteer["GEOID"].str[2:], gazetteer["ALAND_SQMI"]))
    official["land_sqmi"] = official.index.map(area)
    return official


def compare(rebuilt, official, name):
    rebuilt = rebuilt.reindex(official.index)
    a, b = features(rebuilt), features(official)
    error = (a - b).abs()
    report = pd.DataFrame({"mean_abs_error": error.mean(), "p90_abs_error": error.quantile(0.9), "official_sd": b.std()})
    report["error_vs_spread"] = report["mean_abs_error"] / report["official_sd"]
    print(f"{len(official)} districts, population rebuilt / official: {rebuilt['pop'].sum() / official['pop'].sum():.4f}")
    print(report.round(3).to_string())
    report.to_csv(ROOT / "output" / f"redistrict-{name}.csv")
    return rebuilt, official


def validate():
    return compare(profiles_from_points(VALIDATION_STATES, districts_119), official_2024(VALIDATION_STATES), "validation")


def check_blocks():
    return compare(profiles_from_blocks(["MO"], plan_120(["MO"])), official_2024(["MO"]), "check-blocks")


def build_2026():
    plan = plan_120(REDRAWN_2026)
    profiles = profiles_from_blocks(REDRAWN_2026, plan)
    out = profiles.rename_axis("code").reset_index()
    out.insert(0, "acs_year", 2024)
    out.to_csv(ROOT / "data" / "acs" / "acs5_2024_cd2026.csv", index=False)
    seats = out["code"].str[:2].value_counts().sort_index()
    print(f"{len(out)} districts: " + ", ".join(f"{state} {n}" for state, n in seats.items()))
    print(f"population: {out['pop'].sum():,.0f}; smallest/largest district: {out['pop'].min():,.0f} / {out['pop'].max():,.0f}")
    return out


if __name__ == "__main__":
    commands = {"validate": validate, "check-blocks": check_blocks, "build-2026": build_2026}
    commands[sys.argv[1]]()
