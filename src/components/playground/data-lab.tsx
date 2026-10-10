"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIntlLocale, useLocalePath, useT } from "@/components/i18n/locale-provider";
import { fetchOnce, useDemographics, useReducedMotion, useResource, useWidth } from "@/components/playground/hooks";
import { stateByCode } from "@/data/geography";
import { REGIONS, type RegionKey } from "@/data/regions";
import { loadMapGeometry } from "@/lib/playground/geo";
import { buildCounties, buildDistricts, countyDensity, DEFAULTS, formatTick, formatValue, VARIABLES, varByKey, type LabPoint, type Unit, type VarKey } from "@/lib/playground/lab-data";
import { clamp, easeOutCubic, extent, linearScale, marginColor, niceTicks, regression } from "@/lib/playground/math";
import { patchUrl, type PlayRace } from "@/lib/playground/types";
import { raceName } from "@/lib/races";

type Props = { races: PlayRace[]; initial: Record<string, string | undefined> };
type SizeMode = "population" | "votes" | "equal";
type ColorMode = "party" | "region";
type Dot = { p: LabPoint; x: number; y: number; r: number; color: string; vx: number; vy: number };

export const REGION_COLORS: Record<RegionKey, string> = { rust: "#f2a541", sun: "#e76f51", plains: "#8ab17d", pacific: "#2ec4b6", mountain: "#b388eb", east: "#f4a6c0" };
const PAD = { top: 14, right: 18, bottom: 42, left: 58 };

let countyCache: Promise<LabPoint[]> | null = null;
const loadCounties = () => {
  countyCache ??= Promise.all((["2016", "2020", "2024"] as const).map((year) => fetchOnce(`/data/county-${year}.csv`, (response) => response.text())))
    .then(([a, b, c]) => buildCounties({ "2016": a, "2020": b, "2024": c }))
    .catch((error) => { countyCache = null; throw error; });
  return countyCache;
};
const loadCountyAreas = () => fetchOnce("/data/counties.json", async (response) => countyDensity(await response.json()));
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isVar = (unit: Unit, key: string | undefined): key is VarKey => Boolean(key && varByKey.get(key as VarKey)?.units.includes(unit));

function logTicks(min: number, max: number) {
  const ticks: number[] = [];
  for (let power = Math.floor(min); power <= Math.ceil(max); power += 1) for (const factor of [1, 3]) {
    const value = Math.log10(factor) + power;
    if (value >= min && value <= max) ticks.push(value);
  }
  return ticks;
}

// Every county or House district on one canvas: pick two variables, size and colour, then hunt for patterns.
export function DataLab({ races, initial }: Props) {
  const t = useT();
  const locale = useIntlLocale();
  const router = useRouter();
  const localize = useLocalePath();
  const reduced = useReducedMotion();
  const [unit, setUnit] = useState<Unit>(initial.u === "district" ? "district" : "county");
  const [xKey, setX] = useState<VarKey>(() => isVar(unit, initial.x) ? initial.x : DEFAULTS[unit].x);
  const [yKey, setY] = useState<VarKey>(() => isVar(unit, initial.y) ? initial.y : DEFAULTS[unit].y);
  const [sizeMode, setSize] = useState<SizeMode>(initial.sz === "equal" || initial.sz === "votes" ? initial.sz : "population");
  const [colorMode, setColor] = useState<ColorMode>(initial.clr === "region" ? "region" : "party");
  const [trend, setTrend] = useState(initial.tl !== "0");
  const [query, setQuery] = useState(initial.q || "");
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [wrap, width] = useWidth<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const height = Math.round(clamp(width * .6, 320, 620));

  const needsDensity = xKey === "density" || yKey === "density";
  const counties = useResource(loadCounties, unit === "county");
  const demographics = useDemographics();
  const countyAreas = useResource(loadCountyAreas, unit === "county" && needsDensity);
  const districtGeo = useResource(loadMapGeometry, unit === "district" && needsDensity);

  useEffect(() => {
    patchUrl({ u: unit === "county" ? null : unit, x: xKey === DEFAULTS[unit].x ? null : xKey, y: yKey === DEFAULTS[unit].y ? null : yKey, sz: sizeMode === "population" ? null : sizeMode, clr: colorMode === "party" ? null : colorMode, tl: trend ? null : "0", q: query.trim() || null });
  }, [unit, xKey, yKey, sizeMode, colorMode, trend, query]);

  const points = useMemo<LabPoint[] | null>(() => {
    if (unit === "county") {
      if (!counties.data) return null;
      const areas = countyAreas.data;
      return areas ? counties.data.map((point) => ({ ...point, values: { ...point.values, density: point.population / (areas.get(point.id) || NaN) } })) : counties.data;
    }
    if (!demographics.data) return null;
    const built = buildDistricts(races, demographics.data);
    const areas = districtGeo.data ? new Map(districtGeo.data.districts.map((shape) => [shape.code, shape.km2 || NaN])) : null;
    return built.map((point) => ({ ...point, name: raceName({ code: point.id, chamber: "house", state: point.state }, t), values: { ...point.values, density: areas ? point.population / (areas.get(point.id) ?? NaN) : NaN } }));
  }, [unit, counties.data, countyAreas.data, demographics.data, districtGeo.data, races, t]);

  const loading = !points || (needsDensity && (unit === "county" ? !countyAreas.data && !countyAreas.error : !districtGeo.data && !districtGeo.error));
  const failed = unit === "county" ? counties.error : demographics.error;

  const xDef = varByKey.get(xKey)!;
  const yDef = varByKey.get(yKey)!;

  // ---- Layout: transformed values, scales, ticks, screen positions, regression.
  const plot = useMemo(() => {
    if (!points || !width) return null;
    const tx = (value: number) => xDef.log ? (value > 0 ? Math.log10(value) : NaN) : value;
    const ty = (value: number) => yDef.log ? (value > 0 ? Math.log10(value) : NaN) : value;
    const usable = points.map((p) => ({ p, vx: tx(p.values[xKey] ?? NaN), vy: ty(p.values[yKey] ?? NaN) })).filter((item) => Number.isFinite(item.vx) && Number.isFinite(item.vy));
    if (!usable.length) return { dots: [] as Dot[], xTicks: [], yTicks: [], fit: null, sx: (v: number) => v, sy: (v: number) => v, xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number], n: 0 };
    const pad = (range: [number, number]): [number, number] => { const span = range[1] - range[0] || 1; return [range[0] - span * .04, range[1] + span * .04]; };
    const xDomain = pad(extent(usable.map((item) => item.vx)));
    const yDomain = pad(extent(usable.map((item) => item.vy)));
    const sx = linearScale(xDomain, [PAD.left, width - PAD.right]);
    const sy = linearScale(yDomain, [height - PAD.bottom, PAD.top]);
    const weight = (p: LabPoint) => sizeMode === "equal" ? 1 : sizeMode === "votes" && Number.isFinite(p.votes) ? p.votes : p.population;
    const maxWeight = Math.max(...usable.map((item) => weight(item.p)).filter(Number.isFinite), 1);
    const scale = unit === "county" ? clamp(width / 900, .6, 1.1) : clamp(width / 900, .75, 1.1);
    const dots: Dot[] = usable.map(({ p, vx, vy }) => {
      const w = weight(p);
      const r = sizeMode === "equal" ? (unit === "county" ? 2.6 : 4.4) * scale : (unit === "county" ? 1.4 + 13 * Math.sqrt((Number.isFinite(w) ? w : 0) / maxWeight) : 2.5 + 3.5 * Math.sqrt((Number.isFinite(w) ? w : 0) / maxWeight)) * scale;
      const color = colorMode === "region" ? (p.region ? REGION_COLORS[p.region] : "#888") : marginColor(p.party, 30);
      return { p, x: sx(vx), y: sy(vy), r, color, vx, vy };
    }).sort((a, b) => b.r - a.r);
    const xTicks = xDef.log ? logTicks(xDomain[0], xDomain[1]) : niceTicks(xDomain[0], xDomain[1], Math.max(3, Math.round(width / 110)));
    const yTicks = yDef.log ? logTicks(yDomain[0], yDomain[1]) : niceTicks(yDomain[0], yDomain[1], Math.max(3, Math.round(height / 70)));
    return { dots, xTicks, yTicks, fit: regression(usable.map((item) => item.vx), usable.map((item) => item.vy)), sx, sy, xDomain, yDomain, n: usable.length };
  }, [points, width, height, xKey, yKey, xDef.log, yDef.log, sizeMode, colorMode, unit]);

  const needle = fold(query.trim());
  const matches = useMemo(() => {
    if (!points || needle.length < 2) return null;
    return points.filter((p) => fold(`${p.name} ${p.id} ${t(stateByCode.get(p.state)?.name || p.state)} ${stateByCode.get(p.state)?.name || ""}`).includes(needle));
  }, [points, needle, t]);
  const matchIds = useMemo(() => matches ? new Set(matches.map((p) => p.id)) : null, [matches]);

  // ---- Drawing, with marks gliding between layouts.
  const live = useRef(new Map<string, [number, number, number]>());
  const anim = useRef<{ plot: unknown; from: Map<string, [number, number, number]>; start: number }>({ plot: null, from: new Map(), start: 0 });
  const active = hover ?? pinned;

  useEffect(() => {
    const node = canvas.current;
    if (!node || !plot || !width) return;
    const ratio = window.devicePixelRatio || 1;
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) { node.width = Math.round(width * ratio); node.height = Math.round(height * ratio); }
    const context = node.getContext("2d");
    if (!context) return;
    if (anim.current.plot !== plot) anim.current = { plot, from: new Map(live.current), start: performance.now() };
    const { from, start } = anim.current;
    const duration = reduced || from.size === 0 ? 0 : 650;
    const family = getComputedStyle(node).fontFamily || "system-ui, sans-serif";

    const draw = (progress: number) => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      // Grid and ticks.
      context.font = `11px ${family}`;
      context.lineWidth = 1;
      context.textBaseline = "middle";
      context.textAlign = "right";
      for (const tick of plot.yTicks) {
        const y = Math.round(plot.sy(tick)) + .5;
        context.strokeStyle = tick === 0 && yDef.kind === "margin" ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.06)";
        context.beginPath(); context.moveTo(PAD.left, y); context.lineTo(width - PAD.right, y); context.stroke();
        context.fillStyle = "#7c818c";
        context.fillText(formatTick(yDef.kind, yDef.log ? Math.round(10 ** tick) : tick, locale), PAD.left - 8, y);
      }
      context.textAlign = "center";
      context.textBaseline = "top";
      for (const tick of plot.xTicks) {
        const x = Math.round(plot.sx(tick)) + .5;
        context.strokeStyle = tick === 0 && xDef.kind === "margin" ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.06)";
        context.beginPath(); context.moveTo(x, PAD.top); context.lineTo(x, height - PAD.bottom); context.stroke();
        context.fillStyle = "#7c818c";
        context.fillText(formatTick(xDef.kind, xDef.log ? Math.round(10 ** tick) : tick, locale), x, height - PAD.bottom + 8);
      }
      // Marks.
      const next = new Map<string, [number, number, number]>();
      const dim = matchIds !== null;
      const top: Dot[] = [];
      for (const dot of plot.dots) {
        const old = from.get(dot.p.id);
        const x = old ? old[0] + (dot.x - old[0]) * progress : dot.x;
        const y = old ? old[1] + (dot.y - old[1]) * progress : dot.y;
        const r = old ? old[2] + (dot.r - old[2]) * progress : dot.r * progress;
        next.set(dot.p.id, [x, y, r]);
        if (dim && matchIds.has(dot.p.id)) { top.push(dot); continue; }
        context.globalAlpha = dim ? .12 : .78;
        context.fillStyle = dot.color;
        context.beginPath(); context.arc(x, y, Math.max(.5, r), 0, Math.PI * 2); context.fill();
        if (!dim && r > 4) { context.globalAlpha = .5; context.strokeStyle = "rgba(6,7,11,.8)"; context.lineWidth = .7; context.stroke(); }
      }
      context.globalAlpha = 1;
      for (const dot of top) {
        const [x, y, r] = next.get(dot.p.id)!;
        context.fillStyle = dot.color;
        context.beginPath(); context.arc(x, y, Math.max(2.5, r), 0, Math.PI * 2); context.fill();
        context.strokeStyle = "#f5c451"; context.lineWidth = 1.6; context.stroke();
      }
      // Trend line.
      if (trend && plot.fit) {
        const [x0, x1] = plot.xDomain;
        context.save();
        context.beginPath(); context.rect(PAD.left, PAD.top, width - PAD.left - PAD.right, height - PAD.top - PAD.bottom); context.clip();
        context.setLineDash([6, 5]);
        context.strokeStyle = "rgba(255,255,255,.85)";
        context.lineWidth = 1.6;
        context.globalAlpha = progress;
        context.beginPath();
        context.moveTo(plot.sx(x0), plot.sy(plot.fit.intercept + plot.fit.slope * x0));
        context.lineTo(plot.sx(x1), plot.sy(plot.fit.intercept + plot.fit.slope * x1));
        context.stroke();
        context.restore();
      }
      // Hovered or pinned point.
      const focus = active ? next.get(active) : undefined;
      if (focus) {
        context.globalAlpha = 1;
        context.strokeStyle = "#fff"; context.lineWidth = 2;
        context.beginPath(); context.arc(focus[0], focus[1], Math.max(5, focus[2] + 3), 0, Math.PI * 2); context.stroke();
      }
      live.current = next;
    };

    let frame = 0;
    const step = (now: number) => {
      const progress = duration ? clamp((now - start) / duration, 0, 1) : 1;
      draw(easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [plot, width, height, matchIds, active, trend, reduced, locale, xDef, yDef]);

  // ---- Pointer and keyboard.
  function nearest(clientX: number, clientY: number) {
    const rect = canvas.current!.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    let best: string | null = null;
    let bestDistance = 14 * 14;
    for (const [id, [px, py, r]] of live.current) {
      if (matchIds && !matchIds.has(id)) continue;
      const distance = (px - x) ** 2 + (py - y) ** 2 - r * r;
      if (distance < bestDistance) { bestDistance = distance; best = id; }
    }
    return best;
  }
  const byId = useMemo(() => new Map((plot?.dots || []).map((dot) => [dot.p.id, dot])), [plot]);
  const order = useMemo(() => [...(plot?.dots || [])].filter((dot) => !matchIds || matchIds.has(dot.p.id)).sort((a, b) => a.vx - b.vx).map((dot) => dot.p.id), [plot, matchIds]);

  function open(id: string) {
    const point = byId.get(id)?.p;
    if (point?.href) router.push(localize(point.href));
    else setPinned((current) => current === id ? null : id);
  }
  function onKeyDown(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!order.length) return;
    const index = active ? order.indexOf(active) : -1;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = order[clamp(index + (event.key === "ArrowRight" ? 1 : -1), 0, order.length - 1)] ?? order[0];
      setHover(null); setPinned(next);
    } else if (event.key === "Enter" && active) { event.preventDefault(); open(active); }
    else if (event.key === "Escape") { setPinned(null); setHover(null); }
  }

  function changeUnit(next: Unit) {
    if (next === unit) return;
    setUnit(next);
    setX(DEFAULTS[next].x);
    setY(DEFAULTS[next].y);
    setHover(null); setPinned(null);
    if (next === "district" && sizeMode === "votes") setSize("population");
  }

  const options = VARIABLES.filter((item) => item.units.includes(unit));
  const tip = active ? byId.get(active) : undefined;
  const fit = plot?.fit;
  const strength = !fit ? "" : Math.abs(fit.r) >= .7 ? t("strong") : Math.abs(fit.r) >= .4 ? t("moderate") : Math.abs(fit.r) >= .2 ? t("weak") : t("almost none");
  const unitLabel = unit === "county" ? t("counties") : t("districts");

  return <div className="pg-lab panel">
    <div className="pg-toolbar">
      <div className="pg-seg" role="group" aria-label={t("Unit")}>
        <button type="button" aria-pressed={unit === "county"} onClick={() => changeUnit("county")}>{t("Counties")}</button>
        <button type="button" aria-pressed={unit === "district"} onClick={() => changeUnit("district")}>{t("House districts")}</button>
      </div>
      <span className="pg-spacer" />
      <button type="button" className="pg-button ghost" onClick={() => { const x = xKey; setX(yKey); setY(x); }} title={t("Swap axes")}>⇄ {t("Swap axes")}</button>
    </div>

    <div className="pg-lab-controls">
      <label className="pg-field">{t("Horizontal axis")}<select value={xKey} onChange={(event) => setX(event.target.value as VarKey)}>{options.map((item) => <option key={item.key} value={item.key}>{t(item.label)}</option>)}</select></label>
      <label className="pg-field">{t("Vertical axis")}<select value={yKey} onChange={(event) => setY(event.target.value as VarKey)}>{options.map((item) => <option key={item.key} value={item.key}>{t(item.label)}</option>)}</select></label>
      <label className="pg-field">{t("Size")}<select value={sizeMode} onChange={(event) => setSize(event.target.value as SizeMode)}>
        <option value="population">{t("Population")}</option>
        {unit === "county" && <option value="votes">{t("Votes cast in 2024")}</option>}
        <option value="equal">{t("Equal")}</option>
      </select></label>
      <label className="pg-field">{t("Colour")}<select value={colorMode} onChange={(event) => setColor(event.target.value as ColorMode)}>
        <option value="party">{unit === "county" ? t("Party (2024 result)") : t("Party (2026 model)")}</option>
        <option value="region">{t("Region")}</option>
      </select></label>
      <label className="pg-field">{unit === "county" ? t("Find a county or state") : t("Find a district or state")}<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPinned(null); }} placeholder={unit === "county" ? "Maricopa, Texas…" : "AZ-06, Ohio…"} /></label>
    </div>

    <div className="pg-lab-stats" aria-live="polite">
      {plot && fit ? <>
        <span className="pg-lab-r"><strong>r = {fit.r.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span>{t("{strength} {direction} correlation", { strength, direction: fit.r >= 0 ? t("positive") : t("negative") })}</span></span>
        <span>{t("{n} {unit} plotted", { n: plot.n.toLocaleString(locale), unit: unitLabel })}{xDef.log || yDef.log ? ` · ${t("log scale")}` : ""}</span>
      </> : <span>{loading ? t("Loading data…") : t("Not enough data for these variables.")}</span>}
      <label className="pg-check"><input type="checkbox" checked={trend} onChange={(event) => setTrend(event.target.checked)} /> {t("Trend line")}</label>
    </div>

    {matches && <div className="pg-matches" aria-label={t("Search results")}>
      {matches.length === 0 ? <span className="pg-hint">{t("No match for “{q}”", { q: query.trim() })}</span> : <>
        <span className="pg-hint">{t("{n} highlighted", { n: matches.length })}</span>
        {matches.slice(0, 8).map((p) => <button key={p.id} type="button" className={pinned === p.id ? "active" : ""} onClick={() => setPinned(pinned === p.id ? null : p.id)}>{unit === "district" ? p.id : p.name}</button>)}
      </>}
    </div>}

    <div className="pg-lab-stage" ref={wrap}>
      {failed ? <div className="pg-map-loading">{t("The data could not be loaded. Try again in a moment.")}</div>
        : <>
          {(loading || !plot) && <div className="pg-map-loading pg-skeleton" style={{ position: "absolute", inset: 0, zIndex: 1 }}>{t("Loading data…")}</div>}
          <canvas
            ref={canvas}
            style={{ height }}
            tabIndex={0}
            role="img"
            aria-label={t("Scatter plot of {n} {unit}: {x} against {y}. Use the arrow keys to step through points and Enter to open one.", { n: plot?.n ?? 0, unit: unitLabel, x: t(xDef.label), y: t(yDef.label) })}
            className={hover ? "pointing" : ""}
            onPointerMove={(event) => setHover(nearest(event.clientX, event.clientY))}
            onPointerLeave={() => setHover(null)}
            onClick={(event) => { const id = nearest(event.clientX, event.clientY); if (id) open(id); }}
            onKeyDown={onKeyDown}
          />
        </>}
      {tip && <div className="pg-lab-tip" style={{ left: tip.x + 250 > width ? Math.max(0, tip.x - 250) : tip.x + 14, top: clamp(tip.y - 20, 0, Math.max(0, height - 150)) }}>
        <strong>{unit === "district" ? `${tip.p.id} · ${tip.p.name}` : tip.p.name}</strong>
        <dl>
          <dt>{t(xDef.label)}</dt><dd>{formatValue(xDef.kind, tip.p.values[xKey] ?? NaN, locale)}</dd>
          <dt>{t(yDef.label)}</dt><dd>{formatValue(yDef.kind, tip.p.values[yKey] ?? NaN, locale)}</dd>
          {unit === "county" && xKey !== "m2024" && yKey !== "m2024" && <><dt>{t("2024 presidential margin")}</dt><dd>{formatValue("margin", tip.p.party, locale)}</dd></>}
          {unit === "district" && xKey !== "model2026" && yKey !== "model2026" && <><dt>{t("2026 model margin")}</dt><dd>{formatValue("margin", tip.p.party, locale)}</dd></>}
          <dt>{t("Population")}</dt><dd>{formatValue("count", tip.p.population, locale)}</dd>
        </dl>
        {tip.p.href && <small className="muted">{t("Click to open the race")}</small>}
      </div>}
    </div>

    <div className="pg-toolbar">
      <div className="pg-lab-legend">
        {colorMode === "region"
          ? REGIONS.map((region) => <span key={region.key}><i style={{ background: REGION_COLORS[region.key] }} />{t(region.name)}</span>)
          : <><span><i style={{ background: marginColor(-30, 30) }} />{t("Republican")}</span><span><i style={{ background: marginColor(0, 30) }} />{t("Even")}</span><span><i style={{ background: marginColor(30, 30) }} />{t("Democratic")}</span></>}
        <span>· {t("{x} → right, {y} → up", { x: t(xDef.label), y: t(yDef.label) })}</span>
      </div>
    </div>
    <p className="chart-note">{unit === "county"
      ? t("Counties: presidential results 2016–2024 and ACS demographics from the county archive; density from Census county land area. Margins are D − R in points; shifts are positive when the county moved toward Democrats.")
      : t("Districts: {version} model margins and odds, 2024 House results, Census ACS 2024 5-year profiles; density from district boundaries. Click a district to open its race.", { version: "MP-26" })}</p>
  </div>;
}
