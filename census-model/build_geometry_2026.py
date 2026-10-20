"""
District boundaries for November 2026: public/data/congressional-districts-2026.geojson.

States that kept their lines (including Missouri, whose 2025 map is blocked) are copied from the
119th Congress cartographic file the site already uses. The nine redrawn states come from the
Census TIGER/Line 2026 120th Congress shapefiles, clipped to the state's land outline (the union
of its 119th Congress cartographic districts, so coasts and lakes match the rest of the map) and
simplified to about 100 m. Properties follow the 119th file (GEOID, STATEFP, CD119FP), with
CD119FP holding the district number of the 2026 plan.

Usage: census-model/.venv/bin/python census-model/build_geometry_2026.py
"""
import io
import json
import zipfile
from pathlib import Path

import shapefile
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from redistrict import ABBR, REDRAWN_2026, download

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
SOURCE = PROJECT / "public" / "data" / "congressional-districts-119.geojson"
OUT = PROJECT / "public" / "data" / "congressional-districts-2026.geojson"
TOLERANCE = 0.001  # degrees, ~100 m: below a pixel even at state zoom


def rounded(geometry, digits=5):
    def walk(value):
        return [walk(item) for item in value] if isinstance(value[0], (list, tuple)) else [round(value[0], digits), round(value[1], digits)]
    return {"type": geometry["type"], "coordinates": walk(geometry["coordinates"])}


def tiger_districts(fips):
    archive = download(f"https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_{fips}_cd120.zip", ROOT / "data" / "geo" / "tiger2026" / f"tl_2026_{fips}_cd120.zip")
    with zipfile.ZipFile(archive) as zipped:
        files = {ext: io.BytesIO(zipped.read(f"tl_2026_{fips}_cd120.{ext}")) for ext in ("shp", "shx", "dbf")}
    reader = shapefile.Reader(**files)
    names = [field[0] for field in reader.fields[1:]]
    for item in reader.shapeRecords():
        record = dict(zip(names, item.record))
        yield record["CD120FP"], shape(item.shape.__geo_interface__)


def main():
    source = json.loads(SOURCE.read_text())
    redrawn_fips = {ABBR[state] for state in REDRAWN_2026}
    features = [feature for feature in source["features"] if feature["properties"]["STATEFP"] not in redrawn_fips]
    for fips in sorted(redrawn_fips):
        old = [shape(f["geometry"]) for f in source["features"] if f["properties"]["STATEFP"] == fips]
        land = unary_union(old).buffer(0)
        old_vertices = sum(len(json.dumps(f["geometry"])) for f in source["features"] if f["properties"]["STATEFP"] == fips)
        added = []
        for number, district in tiger_districts(fips):
            clipped = district.buffer(0).simplify(TOLERANCE, preserve_topology=True).intersection(land)
            if clipped.is_empty:
                continue
            clipped = clipped.simplify(TOLERANCE / 2, preserve_topology=True)
            if clipped.geom_type == "GeometryCollection":
                clipped = unary_union([part for part in clipped.geoms if part.geom_type in ("Polygon", "MultiPolygon")])
            added.append({"type": "Feature", "properties": {"GEOID": f"{fips}{number}", "STATEFP": fips, "CD119FP": number, "NAMELSAD": f"Congressional District {int(number)}"},
                          "geometry": rounded(mapping(clipped))})
        new_size = sum(len(json.dumps(f["geometry"])) for f in added)
        print(f"{fips}: {len(added)} districts, {new_size / 1024:.0f} KB (2024 lines: {old_vertices / 1024:.0f} KB)")
        features.extend(added)
    features.sort(key=lambda f: f["properties"]["GEOID"])
    out = {"type": "FeatureCollection", "source": "U.S. Census Bureau: 2024 Cartographic Boundary Files (119th Congress) for unchanged states; "
           "TIGER/Line 2026 (120th Congress) for AL, CA, FL, LA, NC, OH, TN, TX, UT, clipped to land and simplified", "features": features}
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"{OUT.relative_to(PROJECT)}: {len(features)} features, {OUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
