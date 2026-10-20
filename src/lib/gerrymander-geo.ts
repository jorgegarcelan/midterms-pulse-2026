import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoArea, geoBounds, geoLength, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { SHAPE_BOX } from "@/lib/gerrymander";

/*
  Server-side geometry for /gerrymandering: real 119th-Congress districts (the maps used in 2024),
  county outlines and House results, projected into small SVG boxes so the client only gets path strings.
*/

type District = Feature<Polygon | MultiPolygon, { GEOID: string; STATEFP: string; CD119FP: string }>;
type County = Feature<Polygon | MultiPolygon, { STATE: string; COUNTY: string; NAME: string }>;
type HouseResult = { y: number; m: number; w: "D" | "R"; u?: 1 };

export type DistrictShape = { id: string; code: string; place: string; note: string; d: string; circle: { cx: number; cy: number; r: number }; score: number; rank: number; of: number };
export type SliceDistrict = { code: string; d: string; label: [number, number]; before: { y: number; m: number } | null; after: { y: number; m: number } };
export type CityCase = {
  key: string; city: string; county: string; countyMargin: number | null; width: number; height: number; origin: [number, number]; zoom: [number, number, number, number] | null;
  others: string[]; focus: SliceDistrict[]; counties: string[]; cities: { name: string; x: number; y: number }[];
};

const read = <T,>(file: string) => readFile(join(process.cwd(), file), "utf8").then((text) => JSON.parse(text) as T);
let districtsCache: Promise<District[]> | null = null;
let countiesCache: Promise<County[]> | null = null;
// DC and the territories send non-voting delegates; only the 435 voting districts count.
const NON_STATES = new Set(["11", "60", "66", "69", "72", "78"]);
const districts = () => (districtsCache ??= read<FeatureCollection<District["geometry"], District["properties"]>>("public/data/congressional-districts-119.geojson").then((fc) => fc.features.filter((f) => !NON_STATES.has(f.properties.STATEFP))));
const counties = () => (countiesCache ??= read<FeatureCollection<County["geometry"], County["properties"]>>("public/data/counties.json").then((fc) => fc.features));

const SHAPE_PICKS = [
  { geoid: "2206", code: "LA-06", place: "Shreveport to Baton Rouge", note: "Louisiana's second majority-Black district. The Supreme Court struck it down as a racial gerrymander in Louisiana v. Callais (2026)." },
  { geoid: "4833", code: "TX-33", place: "Dallas–Fort Worth", note: "" },
  { geoid: "4835", code: "TX-35", place: "Austin to San Antonio", note: "Texas redrew both of these again for 2026." },
  { geoid: "1717", code: "IL-17", place: "Rockford, the Quad Cities and Peoria", note: "Drawn by Illinois Democrats in 2021." },
  { geoid: "5600", code: "WY-AL", place: "All of Wyoming", note: "For contrast: one district, the whole state, no lines to draw." },
];

// Polsby-Popper on the sphere (4πA / P²), then each pick projected into its own box with a same-area circle.
export async function loadShapes(): Promise<DistrictShape[]> {
  const all = await districts();
  const score = (feature: District) => {
    const rings = feature.geometry.type === "Polygon" ? feature.geometry.coordinates : feature.geometry.coordinates.flat();
    return 4 * Math.PI * geoArea(feature) / geoLength({ type: "MultiLineString", coordinates: rings }) ** 2;
  };
  const ranked = all.map((feature) => ({ feature, score: score(feature) })).sort((a, b) => a.score - b.score);
  return SHAPE_PICKS.flatMap((pick) => {
    const index = ranked.findIndex((item) => item.feature.properties.GEOID === pick.geoid);
    if (index < 0) return [];
    const { feature, score: value } = ranked[index];
    const path = geoPath(geoMercator().fitExtent([[18, 18], [SHAPE_BOX - 18, SHAPE_BOX - 18]], feature)).digits(1);
    const [cx, cy] = path.centroid(feature);
    return [{ id: pick.geoid, code: pick.code, place: pick.place, note: pick.note, d: path(feature) ?? "", circle: { cx, cy, r: Math.sqrt(path.area(feature) / Math.PI) }, score: value, rank: index + 1, of: ranked.length }];
  });
}

const CITY_CASES = [
  { key: "nashville", state: "TN", fips: "47", city: "Nashville", county: "47037", focus: ["05", "06", "07"], extra: [], cities: [{ name: "Nashville", lon: -86.78, lat: 36.16 }] },
  { key: "salt-lake", state: "UT", fips: "49", city: "Salt Lake City", county: "49035", focus: ["01", "02", "03", "04"], extra: [], cities: [{ name: "Salt Lake City", lon: -111.89, lat: 40.76 }] },
  { key: "austin", state: "TX", fips: "48", city: "Austin", county: "48453", focus: ["37", "35", "10", "17", "21"], extra: [], cities: [{ name: "Austin", lon: -97.74, lat: 30.27 }, { name: "San Antonio", lon: -98.49, lat: 29.42 }] },
  {
    key: "illinois", state: "IL", fips: "17", city: "Central Illinois", county: null, focus: ["13"], extra: ["17019", "17115", "17167", "17163", "17119"],
    cities: [{ name: "Champaign", lon: -88.24, lat: 40.12 }, { name: "Decatur", lon: -88.95, lat: 39.84 }, { name: "Springfield", lon: -89.65, lat: 39.8 }, { name: "East St. Louis", lon: -90.15, lat: 38.62 }],
  },
] as const;

const W = 560;
const H = 440;

// Last contested result before the 2022 maps (the "before") and the 2024 result under the same lines (the "after").
function beforeAfter(rows: HouseResult[] | undefined) {
  // Some uncontested races are not flagged, so a 99+ point margin counts as uncontested too.
  const contested = (rows || []).filter((row) => !row.u && Math.abs(row.m) < 99);
  const before = contested.filter((row) => row.y <= 2020).at(-1);
  const after = contested.filter((row) => row.y >= 2022).at(-1) ?? (rows || []).at(-1);
  return { before: before ? { y: before.y, m: before.m } : null, after: after ? { y: after.y, m: after.m } : { y: 2024, m: 0 } };
}

async function countyMargin(fips: string) {
  const csv = await readFile(join(process.cwd(), "public/data/county-2024.csv"), "utf8");
  const header = csv.slice(0, csv.indexOf("\n")).split(",");
  const line = csv.split("\n").find((row) => row.split(",")[1] === fips);
  if (!line) return null;
  const cells = line.split(",");
  const value = (name: string) => Number(cells[header.indexOf(name)]);
  return (value("per_dem") - value("per_gop")) * 100;
}

// Each case: the districts that carve up one city, its county on top, and the rest of the state faint behind.
export async function loadCityCases(): Promise<CityCase[]> {
  const [allDistricts, allCounties] = await Promise.all([districts(), counties()]);
  return Promise.all(CITY_CASES.map(async (item) => {
    const stateDistricts = allDistricts.filter((d) => d.properties.STATEFP === item.fips);
    const focus = item.focus.map((cd) => stateDistricts.find((d) => d.properties.CD119FP === cd)!).filter(Boolean);
    const countyFeatures = [item.county, ...item.extra].filter(Boolean).map((fips) => allCounties.find((c) => c.properties.STATE + c.properties.COUNTY === fips)!).filter(Boolean);
    const frame: FeatureCollection = { type: "FeatureCollection", features: [...focus, ...countyFeatures] };
    const projection = geoMercator().fitExtent([[14, 14], [W - 14, H - 14]], frame);
    const path = geoPath(projection).digits(1);
    // Only draw neighbours that reach into the frame.
    const [[x0, y0], [x1, y1]] = geoBounds(frame);
    const others = stateDistricts.filter((d) => {
      if (focus.includes(d)) return false;
      const [[a0, b0], [a1, b1]] = geoBounds(d);
      return a1 >= x0 - 1 && a0 <= x1 + 1 && b1 >= y0 - 1 && b0 <= y1 + 1;
    });
    const history = await read<{ districts: Record<string, HouseResult[]> }>(`public/data/history/house/${item.state}.json`);
    const main = countyFeatures[0];
    // A close-up box around the county, padded and matched to the frame's aspect ratio.
    let zoom: CityCase["zoom"] = null;
    if (main && item.county) {
      const [[bx0, by0], [bx1, by1]] = path.bounds(main);
      const height = Math.max(by1 - by0, (bx1 - bx0) * H / W) * 2.2;
      const width = height * W / H;
      zoom = [(bx0 + bx1) / 2 - width / 2, (by0 + by1) / 2 - height / 2, width, height];
    }
    return {
      key: item.key, city: item.city, county: main && item.county ? main.properties.NAME : "",
      countyMargin: item.county ? await countyMargin(item.county) : null,
      width: W, height: H, zoom, origin: (main ? path.centroid(main) : [W / 2, H / 2]) as [number, number],
      others: others.map((d) => path(d) ?? ""),
      focus: focus.map((d) => {
        const code = `${item.state}-${d.properties.CD119FP}`;
        return { code, d: path(d) ?? "", label: path.centroid(d) as [number, number], ...beforeAfter(history.districts[code]) };
      }),
      counties: countyFeatures.map((c) => path(c) ?? ""),
      cities: item.cities.map((c) => { const [x, y] = projection([c.lon, c.lat])!; return { name: c.name, x, y }; }),
    };
  }));
}
