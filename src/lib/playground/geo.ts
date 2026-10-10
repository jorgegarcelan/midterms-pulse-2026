import { geoAlbersUsa, geoArea, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { stateCodeByFips } from "@/data/geography";

type DistrictProperties = { GEOID: string; STATEFP: string; CD119FP: string };

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 600;

export type MapShape = { code: string; state: string; d: string; centroid: [number, number]; area: number; outline?: string; km2?: number };
export type MapGeometry = { districts: MapShape[]; states: MapShape[] };

let cache: Promise<MapGeometry> | null = null;

/*
  District and state outlines projected once (Albers USA, 960×600) from the 119th Congress Census file.
  States are the union of their districts drawn as one path, so the Senate map needs no second download.
*/
export function loadMapGeometry() {
  cache ??= fetch("/data/congressional-districts-119.geojson")
    .then((response) => {
      if (!response.ok) throw new Error(`Boundaries ${response.status}`);
      return response.json() as Promise<FeatureCollection<Geometry, DistrictProperties>>;
    })
    .then((collection) => {
      const features = collection.features.filter((feature) => stateCodeByFips.has(feature.properties.STATEFP) && feature.properties.STATEFP !== "72" && feature.properties.CD119FP !== "98");
      const projection = geoAlbersUsa().fitExtent([[10, 10], [MAP_WIDTH - 10, MAP_HEIGHT - 10]], { type: "FeatureCollection", features });
      const draw = geoPath(projection);
      const districts: MapShape[] = features.map((feature) => {
        const state = stateCodeByFips.get(feature.properties.STATEFP)!;
        const centroid = draw.centroid(feature);
        // Spherical area; a ring wound the "wrong" way for d3 measures the rest of the globe.
        const steradians = geoArea(feature);
        const km2 = (steradians > 2 * Math.PI ? 4 * Math.PI - steradians : steradians) * 6371.0088 ** 2;
        const shape: MapShape = { code: `${state}-${feature.properties.CD119FP}`, state, d: draw(feature) || "", centroid: [centroid[0], centroid[1]], area: draw.area(feature), km2 };
        return shape;
      }).filter((shape) => shape.d).sort((a, b) => a.code.localeCompare(b.code));
      const outlines = stateOutlines(features, projection);
      const byState = new Map<string, MapShape[]>();
      for (const district of districts) byState.set(district.state, [...(byState.get(district.state) || []), district]);
      const states: MapShape[] = [...byState.entries()].map(([state, parts]) => {
        const area = parts.reduce((sum, part) => sum + part.area, 0);
        const centroid: [number, number] = [parts.reduce((sum, part) => sum + part.centroid[0] * part.area, 0) / area, parts.reduce((sum, part) => sum + part.centroid[1] * part.area, 0) / area];
        return { code: state, state, d: parts.map((part) => part.d).join(""), centroid, area, outline: outlines.get(state) || "" };
      }).sort((a, b) => a.code.localeCompare(b.code));
      return { districts, states };
    })
    .catch((error) => { cache = null; throw error; });
  return cache;
}

/*
  A state's outer border without its internal district lines: ring segments shared by two districts of
  the same state cancel out (Census cartographic files share vertices along common edges); the rest is
  drawn as short projected lines, chained into polylines where they connect.
*/
function stateOutlines(features: FeatureCollection<Geometry, DistrictProperties>["features"], projection: ReturnType<typeof geoAlbersUsa>) {
  const segments = new Map<string, Map<string, [number[], number[]]>>();
  for (const feature of features) {
    const state = stateCodeByFips.get(feature.properties.STATEFP)!;
    const own = segments.get(state) ?? new Map<string, [number[], number[]]>();
    segments.set(state, own);
    const geometry = feature.geometry;
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    for (const polygon of polygons) for (const ring of polygon) for (let index = 1; index < ring.length; index += 1) {
      const a = ring[index - 1], b = ring[index];
      const ka = `${a[0].toFixed(5)},${a[1].toFixed(5)}`, kb = `${b[0].toFixed(5)},${b[1].toFixed(5)}`;
      if (ka === kb) continue;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (own.has(key)) own.delete(key); else own.set(key, [a, b]);
    }
  }
  const result = new Map<string, string>();
  for (const [state, own] of segments) {
    let d = "";
    let last: [number, number] | null = null;
    for (const [a, b] of own.values()) {
      const pa = projection([a[0], a[1]]), pb = projection([b[0], b[1]]);
      if (!pa || !pb) continue;
      if (!last || Math.abs(last[0] - pa[0]) > .01 || Math.abs(last[1] - pa[1]) > .01) d += `M${pa[0].toFixed(1)},${pa[1].toFixed(1)}`;
      d += `L${pb[0].toFixed(1)},${pb[1].toFixed(1)}`;
      last = [pb[0], pb[1]];
    }
    result.set(state, d);
  }
  return result;
}
