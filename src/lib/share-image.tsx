import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { ImageResponse } from "next/og";
import dotsData from "@/data/map-dots.json";
import { stateByCode, stateFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import type { ModelResult } from "@/lib/model";
import { simulateHouse } from "@/lib/chamber-sim";
import { MODEL_VERSION, NATIONALIZATION } from "@/lib/mp26";
import { parliamentLayout } from "@/lib/parliament";
import { parseRaceSlug, raceName } from "@/lib/races";
import { simulateSenate, type SenatePick } from "@/lib/senate-sim";

/*
  Share images: branded, dated PNG cards rendered on the server from the published model run, so a
  downloaded chart and a link preview always carry the same numbers as the page they came from.
  Layouts are drawn on a 1200-px-wide grid and scaled by `u` for larger downloads.
*/

export type ImageSize = { width: number; height: number };
export const OG_SIZE: ImageSize = { width: 1200, height: 630 };
export const DOWNLOAD_SIZE: ImageSize = { width: 1600, height: 900 };
export type ShareOptions = { swing?: number; picks?: Record<string, SenatePick> };
export type ShareCard = { element: React.ReactElement; filename: string };

const SITE = "midterm-pulse-2026.vercel.app";
const CREDIT = "jorgegarcelan.com · @jgarcelan";
const C = {
  bg: "#06070b", ink: "#ededef", muted: "#8b8f99", dim: "#5d626d", line: "rgba(255,255,255,.1)",
  blue: "#5b86ff", red: "#ff5a6e", blueSoft: "#9fb8ff", redSoft: "#ff9eaa", land: "#1a1d25",
};
const D_RGB = [91, 134, 255];
const R_RGB = [255, 90, 110];
const PALE = [238, 241, 248];

let fontCache: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 600 | 700; style: "normal" }[]> | null = null;
function fonts() {
  const dir = join(process.cwd(), "src/assets/fonts");
  fontCache ??= Promise.all([
    ["Geist", "geist-sans-latin-400-normal.woff", 400], ["Geist", "geist-sans-latin-500-normal.woff", 500],
    ["Geist", "geist-sans-latin-600-normal.woff", 600], ["Geist", "geist-sans-latin-700-normal.woff", 700],
    ["Geist Mono", "geist-mono-latin-500-normal.woff", 500],
  ].map(async ([name, file, weight]) => ({ name: name as string, data: await readFile(join(dir, file as string)), weight: weight as 400 | 500 | 600 | 700, style: "normal" as const })));
  return fontCache;
}

export async function renderShareImage(card: ShareCard, size: ImageSize, headers?: Record<string, string>) {
  return new ImageResponse(card.element, { ...size, fonts: await fonts(), headers });
}

// ---------- helpers ----------

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fileDate = (iso: string) => iso.replace(/-/g, "");
const swingLabel = (swing: number) => `${swing > 0 ? "D" : "R"}+${Math.abs(swing)} national swing`;

// Same ramp as the homepage map: pale for close races, full party colour from ~22 pts.
function marginColor(margin: number) {
  const mix = .3 + .7 * Math.min(1, Math.abs(margin) / 22);
  const party = margin >= 0 ? D_RGB : R_RGB;
  return `rgb(${[0, 1, 2].map((channel) => Math.round(PALE[channel] + (party[channel] - PALE[channel]) * mix)).join(",")})`;
}

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 24"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="1.5" y1="0" x2="38.5" y2="0"><stop offset=".4" stop-color="${C.blue}"/><stop offset=".6" stop-color="${C.red}"/></linearGradient></defs><path d="M1.5 21.6H8.16L13.71 2.4L20 17.2L26.29 2.4L31.84 21.6H38.5" fill="none" stroke="url(#g)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="17.2" r="2.3" fill="#fff"/></svg>`;

type Dot = { x: number; y: number; code: string };
const DOTS: Dot[] = dotsData.cells.flatMap((cells, district) => cells.map((cell) => ({
  x: (cell % dotsData.cols) * dotsData.step + dotsData.step / 2,
  y: Math.floor(cell / dotsData.cols) * dotsData.step + dotsData.step / 2,
  code: dotsData.codes[district],
})));

// National dot map (the homepage grid) as an SVG image.
function dotMap(margins: Map<string, number>) {
  const radius = dotsData.step * .36;
  const circles = DOTS.map((dot) => `<circle cx="${dot.x}" cy="${dot.y}" r="${radius}" fill="${margins.has(dot.code) ? marginColor(margins.get(dot.code)!) : C.land}"/>`);
  return { uri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dotsData.width} ${dotsData.height}">${circles.join("")}</svg>`), aspect: dotsData.width / dotsData.height };
}

type DistrictFeature = Feature<Geometry, { STATEFP: string; CD119FP: string }>;
let districtCache: Promise<DistrictFeature[]> | null = null;
function districtShapes() {
  districtCache ??= readFile(join(process.cwd(), "public/data/congressional-districts-119.geojson"), "utf8").then((text) => (JSON.parse(text) as FeatureCollection<Geometry, { STATEFP: string; CD119FP: string }>).features);
  return districtCache;
}

// One state's districts from the Census boundaries, each filled with a dot pattern in its forecast
// colour so small states stay legible. `focus` keeps one district bright and outlines it.
async function stateMap(state: string, margins: Map<string, number>, focusCode?: string) {
  const features = (await districtShapes()).filter((feature) => feature.properties.STATEFP === stateFips[state]);
  const focus = features.length > 1 ? focusCode : undefined;
  const collection: FeatureCollection<Geometry> = { type: "FeatureCollection", features };
  const path = geoPath(geoAlbersUsa().fitSize([1000, 1000], collection));
  const [[x0, y0], [x1, y1]] = path.bounds(collection);
  const pad = Math.max(x1 - x0, y1 - y0) * .03;
  const cell = Math.max(x1 - x0, y1 - y0) / 44;
  const patterns = new Map<string, string>();
  const shapes = features.map((feature) => {
    const code = `${state}-${feature.properties.CD119FP}`;
    const margin = margins.get(code);
    const fill = margin === undefined ? C.muted : marginColor(margin);
    if (!patterns.has(fill)) patterns.set(fill, `p${patterns.size}`);
    const dim = focus && code !== focus;
    return `<path d="${path(feature)}" fill="url(#${patterns.get(fill)})" fill-opacity="${dim ? .35 : 1}" stroke="${dim ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.18)"}" stroke-width="${cell * .08}"/>`;
  });
  const outline = focus ? features.filter((feature) => `${state}-${feature.properties.CD119FP}` === focus).map((feature) => `<path d="${path(feature)}" fill="none" stroke="#fff" stroke-width="${cell * .22}" stroke-linejoin="round"/>`).join("") : "";
  const defs = [...patterns].map(([fill, id]) => `<pattern id="${id}" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><circle cx="${cell / 2}" cy="${cell / 2}" r="${cell * .36}" fill="${fill}"/></pattern>`).join("");
  const box = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
  return { uri: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(" ")}"><defs>${defs}</defs>${shapes.join("")}${outline}</svg>`), aspect: box[2] / box[3] };
}

function hemicycle(total: number, dem: number, majority: number, rows: number, inner: number) {
  const { seats, dot } = parliamentLayout(total, rows, inner);
  const circles = seats.map((seat, index) => `<circle cx="${seat.x.toFixed(4)}" cy="${seat.y.toFixed(4)}" r="${dot.toFixed(4)}" fill="${index < dem ? C.blue : C.red}"/>`).join("");
  const line = `<line x1="0" y1=".02" x2="0" y2="-1.06" stroke="#fff" stroke-opacity=".55" stroke-width=".006" stroke-dasharray=".02 .016"/>`;
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.04 -1.08 2.08 1.12">${circles}${line}</svg>`);
}

// Fit an image of a given aspect ratio inside a box.
function fit(aspect: number, maxW: number, maxH: number) {
  return aspect > maxW / maxH ? { width: maxW, height: maxW / aspect } : { width: maxH * aspect, height: maxH };
}

// ---------- frame ----------

type Frame = { size: ImageSize; runDate: string; path: string; children: React.ReactNode[] };
function frame({ size, runDate, path, children }: Frame) {
  const u = size.width / 1200;
  const s = (value: number) => value * u;
  return (
    <div style={{
      position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: `${s(46)}px ${s(60)}px ${s(40)}px`,
      backgroundColor: C.bg, backgroundImage: "radial-gradient(circle at 8% 0%, rgba(91,134,255,.16), rgba(6,7,11,0) 42%), radial-gradient(circle at 100% 100%, rgba(255,90,110,.13), rgba(6,7,11,0) 44%)",
      color: C.ink, fontFamily: "Geist",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svgUri(MARK)} width={s(44)} height={s(26.4)} alt="" />
          <span style={{ marginLeft: s(14), fontSize: s(26), fontWeight: 600, letterSpacing: "-0.035em", color: "#fff" }}>Midterm Pulse</span>
          <span style={{ marginLeft: s(10), padding: `${s(3)}px ${s(8)}px`, border: `1px solid rgba(255,255,255,.18)`, borderRadius: s(6), fontFamily: "Geist Mono", fontSize: s(15), color: C.muted }}>2026</span>
        </div>
        <span style={{ fontFamily: "Geist Mono", fontSize: s(15), letterSpacing: "0.04em", color: C.muted }}>Forecast · {longDate(runDate)} · {MODEL_VERSION}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "row", width: s(1080), height: size.height - s(46 + 40 + 34 + 30 + 72), marginTop: s(30) }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: s(18), borderTop: `1px solid ${C.line}`, fontFamily: "Geist Mono", fontSize: s(15), color: C.dim }}>
        <span>{SITE}{path}</span>
        <span style={{ color: C.muted }}>{CREDIT}</span>
      </div>
      {/* Watermark: faint and diagonal, so the credit survives a crop of the footer. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: "rotate(-16deg)", color: "rgba(255,255,255,.08)", fontWeight: 600, letterSpacing: "-0.02em" }}>
          <span style={{ fontSize: s(46) }}>jorgegarcelan.com</span>
          <span style={{ fontSize: s(34) }}>@jgarcelan</span>
        </div>
      </div>
    </div>
  );
}

function eyebrow(text: string, u: number) {
  return <span style={{ fontFamily: "Geist Mono", fontSize: 16 * u, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase" }}>{text}</span>;
}

function chip(text: string, u: number, tone?: "D" | "R") {
  const color = tone === "D" ? C.blueSoft : tone === "R" ? C.redSoft : C.muted;
  const border = tone === "D" ? "rgba(91,134,255,.5)" : tone === "R" ? "rgba(255,90,110,.5)" : "rgba(255,255,255,.18)";
  return <span style={{ marginRight: 10 * u, padding: `${5 * u}px ${12 * u}px`, border: `1px solid ${border}`, borderRadius: 999, fontSize: 17 * u, fontWeight: 500, color }}>{text}</span>;
}

function stat(label: string, value: string, u: number, color: string = "#fff") {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 44 * u }}>
      <span style={{ fontFamily: "Geist Mono", fontSize: 13 * u, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase" }}>{label}</span>
      <span style={{ marginTop: 6 * u, fontSize: 30 * u, fontWeight: 600, letterSpacing: "-0.03em", color }}>{value}</span>
    </div>
  );
}

// Two-sided probability read-out with a split bar.
function odds(demPct: number, u: number, caption: string) {
  const dem = Math.round(demPct);
  const rep = 100 - dem;
  const favored = dem >= 50 ? "D" : "R";
  const side = (party: "D" | "R", value: number) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: party === "D" ? "flex-start" : "flex-end" }}>
      <span style={{ fontSize: 18 * u, fontWeight: 500, color: party === "D" ? C.blueSoft : C.redSoft }}>{party === "D" ? "Democrats" : "Republicans"}</span>
      <span style={{ fontSize: (party === favored ? 92 : 56) * u, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1, color: party === favored ? (party === "D" ? C.blue : C.red) : C.muted }}>{value}%</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontFamily: "Geist Mono", fontSize: 13 * u, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase", marginBottom: 8 * u }}>{caption}</span>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>{side("D", dem)}{side("R", rep)}</div>
      <div style={{ display: "flex", height: 12 * u, marginTop: 14 * u, borderRadius: 999, overflow: "hidden", backgroundColor: C.red }}>
        <div style={{ width: `${dem}%`, height: "100%", backgroundColor: C.blue }} />
      </div>
    </div>
  );
}

function legend(u: number) {
  const stops = [-22, -11, -3, 0, 3, 11, 22];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex" }}>{stops.map((margin) => <div key={margin} style={{ width: 30 * u, height: 10 * u, marginRight: 3 * u, borderRadius: 3 * u, backgroundColor: marginColor(margin === 0 ? .01 : margin) }} />)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", width: 7 * 33 * u, marginTop: 6 * u, fontFamily: "Geist Mono", fontSize: 12 * u, color: C.dim }}><span>Safe R</span><span>Toss-up</span><span>Safe D</span></div>
    </div>
  );
}

// ---------- cards ----------

function shiftedMargins(model: ModelResult, swing: number) {
  const shift = swing * NATIONALIZATION;
  return new Map(model.races.filter((race) => race.chamber === "house").map((race) => [race.code, race.signedMargin + shift]));
}

function mapCard(model: ModelResult, size: ImageSize, { swing = 0 }: ShareOptions): ShareCard {
  const u = size.width / 1200;
  const house = swing ? simulateHouse(model.races, { shift: swing * NATIONALIZATION }) : null;
  const houseOdds = house ? Math.round(house.controlD * 100) : model.house.demMajority;
  const map = dotMap(shiftedMargins(model, swing));
  const bodyH = size.height - 250 * u;
  const img = fit(map.aspect, 740 * u, bodyH);
  return {
    filename: `midterm-pulse-house-map${swing ? `-swing-${swing > 0 ? "d" : "r"}${Math.abs(swing)}` : ""}-${fileDate(model.runDate)}.png`,
    element: frame({
      size, runDate: model.runDate, path: "/races",
      children: [
        <div key="l" style={{ display: "flex", flexDirection: "column", width: 330 * u, flexShrink: 0, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow("U.S. House · 435 districts", u)}
            <span style={{ marginTop: 12 * u, fontSize: 54 * u, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#fff" }}>The 2026 House map</span>
            {swing !== 0 && <div style={{ display: "flex", marginTop: 16 * u }}>{chip(`Scenario · ${swingLabel(swing)}`, u, swing > 0 ? "D" : "R")}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", marginBottom: 22 * u }}>{stat("House · D majority", `${houseOdds}%`, u, houseOdds >= 50 ? C.blue : C.red)}</div>
            {!swing && <div style={{ display: "flex", marginBottom: 22 * u }}>{stat("Senate · D majority", `${model.senate.demMajority}%`, u, model.senate.demMajority >= 50 ? C.blue : C.red)}{stat("Generic ballot", signed(model.genericBallot.margin), u, model.genericBallot.margin >= 0 ? C.blueSoft : C.redSoft)}</div>}
            {legend(u)}
          </div>
        </div>,
        <div key="r" style={{ display: "flex", width: 750 * u, flexShrink: 0, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map.uri} width={img.width} height={img.height} alt="" />
        </div>
      ],
    }),
  };
}

function chamberCard(model: ModelResult, chamber: "house" | "senate", size: ImageSize, { swing = 0, picks = {} }: ShareOptions): ShareCard {
  const u = size.width / 1200;
  const shift = swing * NATIONALIZATION;
  const called = Object.keys(picks).length;
  const house = chamber === "house";
  const outlook = house
    ? (swing ? simulateHouse(model.races, { shift }) : null)
    : (swing || called ? simulateSenate(model.races.filter((race) => race.chamber === "senate"), picks, { shift }) : null);
  const published = house ? model.house : model.senate;
  const controlD = outlook ? Math.round(outlook.controlD * 100) : published.demMajority;
  const median = outlook ? outlook.median : published.demSeats;
  const interval = outlook ? outlook.interval80 : published.interval80;
  const total = house ? 435 : 100;
  const majority = house ? 218 : 51;
  const scenario = [swing ? swingLabel(swing) : "", called ? `${called} race${called === 1 ? "" : "s"} called` : ""].filter(Boolean).join(" · ");
  const hemiW = 640 * u;
  const hemiH = Math.min(hemiW * 1.12 / 2.08, size.height - 330 * u);
  return {
    filename: `midterm-pulse-${chamber}${scenario ? "-scenario" : ""}-${fileDate(model.runDate)}.png`,
    element: frame({
      size, runDate: model.runDate, path: house ? "/model" : "/#senate",
      children: [
        <div key="l" style={{ display: "flex", flexDirection: "column", width: 400 * u, flexShrink: 0, justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow(house ? "U.S. House · 218 for majority" : "U.S. Senate · 51 for control", u)}
            <span style={{ marginTop: 12 * u, fontSize: 54 * u, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#fff" }}>{house ? "Who wins the House?" : "Who wins the Senate?"}</span>
            {scenario && <div style={{ display: "flex", marginTop: 16 * u }}>{chip(`Scenario · ${scenario}`, u)}</div>}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {odds(controlD, u, "Chance of a majority")}
            <div style={{ display: "flex", marginTop: 26 * u }}>
              {stat("Median seats", `D ${median} – ${total - median} R`, u)}
              {stat("80% range", `${interval[0]}–${interval[1]} D`, u)}
            </div>
          </div>
        </div>,
        <div key="r" style={{ display: "flex", width: 680 * u, flexShrink: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", paddingLeft: 30 * u }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hemicycle(total, median, majority, house ? 12 : 5, house ? .36 : .42)} width={hemiH * 2.08 / 1.12} height={hemiH} alt="" />
          <div style={{ display: "flex", width: hemiH * 2.08 / 1.12, justifyContent: "space-between", marginTop: 10 * u, fontSize: 22 * u, fontWeight: 600 }}>
            <span style={{ color: C.blue }}>{median} D</span>
            <span style={{ fontFamily: "Geist Mono", fontSize: 14 * u, fontWeight: 500, color: C.muted }}>{majority} {house ? "for majority" : "· VP breaks ties"}</span>
            <span style={{ color: C.red }}>{total - median} R</span>
          </div>
        </div>
      ],
    }),
  };
}

const ratingTone = (race: ForecastRace) => /toss/i.test(race.rating) ? undefined : race.leader;

async function raceCard(model: ModelResult, slug: string, size: ImageSize): Promise<ShareCard | null> {
  const parsed = parseRaceSlug(slug);
  const race = parsed && model.races.find((item) => item.chamber === parsed.chamber && item.code === parsed.code);
  if (!parsed || !race) return null;
  const u = size.width / 1200;
  const demPct = race.leader === "D" ? race.winProbability : 100 - race.winProbability;
  const map = await stateMap(race.state, new Map(model.races.filter((item) => item.chamber === "house").map((item) => [item.code, item.signedMargin])), race.chamber === "house" ? race.code : undefined);
  const img = fit(map.aspect, 400 * u, size.height - 300 * u);
  const baseline = race.baselineDem !== null && race.baselineRep !== null ? signed(race.baselineDem - race.baselineRep) : "—";
  return {
    filename: `midterm-pulse-${slug.toLowerCase()}-${fileDate(model.runDate)}.png`,
    element: frame({
      size, runDate: model.runDate, path: `/races/${slug.toLowerCase()}`,
      children: [
        <div key="l" style={{ display: "flex", flexDirection: "column", width: 660 * u, flexShrink: 0, justifyContent: "space-between", paddingRight: 40 * u }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow(race.chamber === "senate" ? "U.S. Senate · 2026 general election" : `U.S. House · ${race.code}`, u)}
            <span style={{ marginTop: 12 * u, fontSize: (raceName(race).length > 18 ? 54 : 68) * u, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#fff" }}>{raceName(race)}</span>
            <div style={{ display: "flex", marginTop: 18 * u }}>{chip(race.rating || "Unrated", u, ratingTone(race))}{race.special ? chip("Special election", u) : null}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {odds(demPct, u, "Chance to win")}
            <div style={{ display: "flex", marginTop: 26 * u }}>
              {stat("Projected margin", signed(race.signedMargin), u, race.signedMargin >= 0 ? C.blueSoft : C.redSoft)}
              {race.demVote !== null && race.repVote !== null && stat("Two-party vote", `${race.demVote.toFixed(1)} – ${race.repVote.toFixed(1)}`, u)}
              {stat("2024 baseline", baseline, u, C.muted)}
            </div>
          </div>
        </div>,
        <div key="r" style={{ display: "flex", flexDirection: "column", width: 420 * u, flexShrink: 0, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map.uri} width={img.width} height={img.height} alt="" />
          <span style={{ marginTop: 14 * u, fontFamily: "Geist Mono", fontSize: 13 * u, letterSpacing: "0.08em", color: C.dim, textTransform: "uppercase" }}>{race.chamber === "house" ? `${race.code} highlighted` : "House districts by forecast leader"}</span>
        </div>
      ],
    }),
  };
}

async function stateCard(model: ModelResult, code: string, size: ImageSize): Promise<ShareCard | null> {
  const state = stateByCode.get(code.toUpperCase());
  if (!state) return null;
  const u = size.width / 1200;
  const districts = model.races.filter((race) => race.chamber === "house" && race.state === state.code).sort((a, b) => b.signedMargin - a.signedMargin);
  const senate = model.races.find((race) => race.chamber === "senate" && race.state === state.code);
  const leanD = districts.filter((race) => race.signedMargin >= 0).length;
  const closest = [...districts].sort((a, b) => Math.abs(a.signedMargin) - Math.abs(b.signedMargin)).slice(0, 3);
  const map = await stateMap(state.code, new Map(districts.map((race) => [race.code, race.signedMargin])));
  const img = fit(map.aspect, 440 * u, size.height - 280 * u);
  const cell = Math.max(10, Math.min(34, 560 / Math.max(1, districts.length) - 4)) * u;
  return {
    filename: `midterm-pulse-${state.code.toLowerCase()}-${fileDate(model.runDate)}.png`,
    element: frame({
      size, runDate: model.runDate, path: `/states/${state.code.toLowerCase()}`,
      children: [
        <div key="l" style={{ display: "flex", flexDirection: "column", width: 620 * u, flexShrink: 0, justifyContent: "space-between", paddingRight: 40 * u }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow("State overview · 2026 midterms", u)}
            <span style={{ marginTop: 12 * u, fontSize: 72 * u, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1.02, color: "#fff" }}>{state.name}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {senate
              ? <div style={{ display: "flex", flexDirection: "column", marginBottom: 26 * u }}>{odds(senate.leader === "D" ? senate.winProbability : 100 - senate.winProbability, u, `Senate · ${senate.rating}`)}</div>
              : <span style={{ marginBottom: 26 * u, fontSize: 20 * u, color: C.muted }}>{`No Senate race in ${state.name} this cycle.`}</span>}
            <span style={{ fontFamily: "Geist Mono", fontSize: 13 * u, letterSpacing: "0.1em", color: C.dim, textTransform: "uppercase" }}>House · {districts.length} {districts.length === 1 ? "seat" : "seats"}</span>
            <div style={{ display: "flex", alignItems: "center", marginTop: 10 * u }}>
              {districts.map((race) => <div key={race.code} style={{ width: cell, height: cell, marginRight: 4 * u, borderRadius: 4 * u, backgroundColor: marginColor(race.signedMargin) }} />)}
              <span style={{ marginLeft: 10 * u, fontSize: 22 * u, fontWeight: 600 }}><span style={{ color: C.blue }}>{leanD} D</span><span style={{ color: C.dim, margin: `0 ${8 * u}px` }}>·</span><span style={{ color: C.red }}>{districts.length - leanD} R</span></span>
            </div>
            {closest.length > 0 && <span style={{ marginTop: 14 * u, fontSize: 18 * u, color: C.muted }}>Closest: {closest.map((race) => `${race.code} ${signed(race.signedMargin)}`).join("  ·  ")}</span>}
          </div>
        </div>,
        <div key="r" style={{ display: "flex", width: 460 * u, flexShrink: 0, alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={map.uri} width={img.width} height={img.height} alt="" />
        </div>
      ],
    }),
  };
}

// `path` is what follows /api/share/: ["map"], ["house"], ["senate"], ["race", slug] or ["state", code].
export async function shareCard(model: ModelResult, path: string[], size: ImageSize, options: ShareOptions = {}): Promise<ShareCard | null> {
  const [kind, id] = path;
  if (kind === "map" && !id) return mapCard(model, size, options);
  if ((kind === "house" || kind === "senate") && !id) return chamberCard(model, kind, size, options);
  if (kind === "race" && id) return raceCard(model, id, size);
  if (kind === "state" && id) return stateCard(model, id, size);
  return null;
}

export function parseShareOptions(params: URLSearchParams): ShareOptions {
  const swing = Math.max(-10, Math.min(10, Math.round((Number(params.get("swing")) || 0) * 2) / 2));
  const picks: Record<string, SenatePick> = {};
  for (const token of (params.get("picks") || "").toUpperCase().split(",")) {
    const match = token.match(/^([A-Z]{2})-(D|R)$/);
    if (match) picks[match[1]] = match[2] as SenatePick;
  }
  return { swing, picks };
}
