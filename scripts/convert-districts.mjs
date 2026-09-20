import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { read } from "shapefile";

const [shpPath, dbfPath, outputPath = "public/data/congressional-districts-119.geojson"] = process.argv.slice(2);

if (!shpPath || !dbfPath) {
  throw new Error("Usage: node scripts/convert-districts.mjs <shape.shp> <shape.dbf> [output.geojson]");
}

const collection = await read(shpPath, dbfPath);
const reduced = {
  type: "FeatureCollection",
  source: "U.S. Census Bureau, 2024 Cartographic Boundary Files, 119th Congress",
  features: collection.features.map((feature) => ({
    type: "Feature",
    properties: {
      GEOID: feature.properties.GEOID,
      STATEFP: feature.properties.STATEFP,
      CD119FP: feature.properties.CD119FP,
      NAMELSAD: feature.properties.NAMELSAD,
    },
    geometry: feature.geometry,
  })),
};

const absoluteOutput = path.resolve(outputPath);
await mkdir(path.dirname(absoluteOutput), { recursive: true });
await writeFile(absoluteOutput, JSON.stringify(reduced));
console.log(`Wrote ${reduced.features.length} districts to ${absoluteOutput}`);
