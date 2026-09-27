import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { geoAlbersUsa, geoContains, geoPath } from "d3-geo";

// Rasterizes the 119th Congress districts into an even dot grid for the home particle map.
// Output: grid size, district codes, projected centroids and the grid cells each district owns.
const [inputPath = "public/data/congressional-districts-119.geojson", outputPath = "src/data/map-dots.json"] = process.argv.slice(2);
const WIDTH = 1000;
const HEIGHT = 620;
const STEP = 7;

const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "12": "FL", "13": "GA",
  "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD",
  "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ",
  "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC",
  "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

const collection = JSON.parse(await readFile(inputPath, "utf8"));
const features = collection.features.filter((feature) => FIPS[feature.properties.STATEFP] && feature.properties.CD119FP !== "98");
const projection = geoAlbersUsa().fitExtent([[8, 8], [WIDTH - 8, HEIGHT - 8]], { type: "FeatureCollection", features });
const pathGenerator = geoPath(projection);

const districts = features.map((feature) => ({
  code: `${FIPS[feature.properties.STATEFP]}-${feature.properties.CD119FP}`,
  feature,
  bounds: pathGenerator.bounds(feature),
  centroid: pathGenerator.centroid(feature),
  cells: [],
})).sort((a, b) => a.code.localeCompare(b.code));

const cols = Math.floor(WIDTH / STEP);
const rows = Math.floor(HEIGHT / STEP);
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const x = col * STEP + STEP / 2;
    const y = row * STEP + STEP / 2;
    const lonLat = projection.invert([x, y]);
    if (!lonLat) continue;
    const owner = districts.find(({ bounds, feature }) => x >= bounds[0][0] && x <= bounds[1][0] && y >= bounds[0][1] && y <= bounds[1][1] && geoContains(feature, lonLat));
    if (owner) owner.cells.push(row * cols + col);
  }
}

// Districts smaller than a grid cell (dense cities) still get one dot at their centroid cell.
for (const district of districts) {
  if (district.cells.length) continue;
  const [x, y] = district.centroid;
  district.cells.push(Math.min(rows - 1, Math.floor(y / STEP)) * cols + Math.min(cols - 1, Math.floor(x / STEP)));
}

const output = {
  source: "U.S. Census Bureau, 2024 Cartographic Boundary Files, 119th Congress (rasterized)",
  width: WIDTH, height: HEIGHT, step: STEP, cols,
  codes: districts.map((district) => district.code),
  centroids: districts.map((district) => district.centroid.map((value) => Math.round(value))),
  cells: districts.map((district) => district.cells),
};
await writeFile(path.resolve(outputPath), `${JSON.stringify(output)}\n`);
console.log(`Wrote ${districts.length} districts, ${districts.reduce((sum, district) => sum + district.cells.length, 0)} dots.`);
