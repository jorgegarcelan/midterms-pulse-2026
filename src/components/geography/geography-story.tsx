"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { AxisChart } from "@/components/geography/axis-chart";
import { CountyMap, marginColor, useProjected, type Projected, type RGBA, type SizeMode } from "@/components/geography/county-map";
import { RegionalAxes, type Lens } from "@/components/geography/regional-axes";
import { regionOf, type RegionKey } from "@/data/regions";
import { aggregate, AXES, BELTS, margin, signed, YEARS, type County, type Year } from "@/lib/geography";

type Chapter = { key: string; kind: "intro" | "axis" | "belts" | "regions" | "swing"; axis?: (typeof AXES)[number] };
const CHAPTERS: Chapter[] = [
  { key: "intro", kind: "intro" },
  ...AXES.map((axis) => ({ key: axis.key, kind: "axis" as const, axis })),
  { key: "belts", kind: "belts" },
  { key: "regions", kind: "regions" },
  { key: "swing", kind: "swing" },
];
const BUCKET_COLORS: RGBA[] = [[244, 201, 93, 1], [229, 143, 101, 1], [168, 111, 209, 1], [79, 179, 191, 1]];
const REGION_COLORS: Record<RegionKey, RGBA> = { rust: [229, 143, 101, 1], sun: [244, 201, 93, 1], plains: [140, 190, 110, 1], pacific: [79, 179, 191, 1], mountain: [168, 111, 209, 1], east: [157, 187, 250, 1] };
const GREY: RGBA = [90, 98, 110, .35];
// Official national popular-vote margins; the county file undercounts 2016 in a few states.
const NATIONAL_POPULAR_VOTE = [2.1, 4.5, -1.5];

type ModelRace = { chamber: string; state: string; leader: "D" | "R"; winProbability: number };

export function GeographyStory() {
  const t = useT();
  const intl = useIntlLocale();
  const [counties, setCounties] = useState<County[] | null>(null);
  const [presidential, setPresidential] = useState<Record<string, Map<string, number>>>({});
  const [races, setRaces] = useState<{ chamber: string; state: string; demProbability: number }[]>([]);
  const [chapter, setChapter] = useState(0);
  const [size, setSize] = useState<SizeMode>("equal");
  const [active, setActive] = useState<string | null>(null);
  const [belt, setBelt] = useState(BELTS[0].key);
  const [lens, setLens] = useState<Lens>("2024");
  const [focus, setFocus] = useState<RegionKey | null>(null);
  const [swing, setSwing] = useState<{ from: Year; to: Year }>({ from: "v20", to: "v24" });
  const [hovered, setHovered] = useState<Projected | null>(null);
  const [presenting, setPresenting] = useState(false);
  const sections = useRef<(HTMLElement | null)[]>([]);

  // ?present opens straight into presentation mode (used by the stream scene list).
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("present")) return;
    const timer = window.setTimeout(() => setPresenting(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch("/data/geography.json").then((response) => response.json() as Promise<{ counties: County[] }>).then((data) => setCounties(data.counties)).catch(() => setCounties([]));
    fetch("/data/history/president.json").then((response) => response.json() as Promise<{ states: Record<string, { y: number; m: number }[]> }>).then((data) => {
      const byYear: Record<string, Map<string, number>> = {};
      for (const year of ["2016", "2020", "2024"]) byYear[year] = new Map(Object.entries(data.states).flatMap(([state, results]) => { const result = results.find((item) => String(item.y) === year); return result ? [[state, result.m] as const] : []; }));
      setPresidential(byYear);
    }).catch(() => undefined);
    fetch("/api/model").then((response) => response.json() as Promise<{ races: ModelRace[] }>).then((data) => setRaces(data.races.map((race) => ({ chamber: race.chamber, state: race.state, demProbability: race.leader === "D" ? race.winProbability : 100 - race.winProbability })))).catch(() => undefined);
  }, []);

  // The chapter whose text crosses the middle of the viewport drives the map.
  useEffect(() => {
    if (presenting) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setChapter(Number((entry.target as HTMLElement).dataset.index));
    }, { rootMargin: "-45% 0px -45% 0px" });
    sections.current.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [counties, presenting]);

  useEffect(() => { const timer = window.setTimeout(() => setActive(null), 0); return () => window.clearTimeout(timer); }, [chapter]);

  const go = useCallback((index: number) => setChapter(Math.max(0, Math.min(CHAPTERS.length - 1, index))), []);
  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " " || event.key === "PageDown") { event.preventDefault(); go(chapter + 1); }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") { event.preventDefault(); go(chapter - 1); }
      if (event.key === "Escape") setPresenting(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, go, presenting]);

  const projected = useProjected(counties ?? []);
  const current = CHAPTERS[chapter];
  const activeBelt = BELTS.find((item) => item.key === belt)!;

  const view = useMemo(() => {
    const byMargin = (county: Projected) => marginColor(margin(county.v24));
    if (current.kind === "intro") return { colorOf: byMargin, size, highlight: null, arrows: null };
    if (current.kind === "axis") {
      const buckets = current.axis!.buckets;
      const colorOf = (county: Projected) => { const index = buckets.findIndex((bucket) => bucket.test(county)); return index < 0 ? GREY : BUCKET_COLORS[index]; };
      const bucket = buckets.find((item) => item.key === active);
      return bucket ? { colorOf: byMargin, size: "votes" as const, highlight: bucket.test, arrows: null } : { colorOf, size: "votes" as const, highlight: null, arrows: null };
    }
    if (current.kind === "belts") return { colorOf: byMargin, size: "votes" as const, highlight: activeBelt.test, arrows: null };
    if (current.kind === "regions") {
      const colorOf = (county: Projected) => REGION_COLORS[regionOf.get(county.s) ?? "east"];
      return { colorOf, size: "votes" as const, highlight: focus ? (county: Projected) => regionOf.get(county.s) === focus : null, arrows: null };
    }
    return { colorOf: byMargin, size: "votes" as const, highlight: null, arrows: swing };
  }, [active, activeBelt, current, focus, size, swing]);

  const stats = useMemo(() => {
    if (!counties?.length) return null;
    const won = counties.filter((county) => margin(county.v24) < 0);
    const total = aggregate(counties, "v24").total;
    const swings = (from: Year, to: Year) => counties.filter((county) => margin(county[to]) < margin(county[from])).length / counties.length * 100;
    return { rCounties: won.length / counties.length * 100, rVotes: aggregate(won, "v24").total / total * 100, swingR2024: swings("v20", "v24"), swingR2020: swings("v16", "v20") };
  }, [counties]);

  const beltRows = useMemo(() => counties ? BELTS.map((item) => { const members = counties.filter(item.test); return { item, count: members.length, years: YEARS.map((year) => aggregate(members, year.key).margin) }; }) : [], [counties]);

  const number = (value: number, digits = 0) => value.toLocaleString(intl, { maximumFractionDigits: digits, minimumFractionDigits: digits });

  if (!counties) return <section className="panel geo-loading">{t("Loading 3,100 counties…")}</section>;

  const chapterBody = (item: Chapter, index: number) => {
    if (item.kind === "intro") return <>
      <p className="eyebrow">{t("THE MAP LIES")}</p>
      <h2>{t("Land doesn't vote. People do.")}</h2>
      <p>{t("Each dot is a county. Sized by area alone, the 2024 map looks like a Republican landslide: Trump won {share}% of the counties.", { share: number(stats!.rCounties) })}</p>
      <p>{t("But those counties cast only {votes}% of the vote. Size the dots by votes and the map becomes a handful of huge blue cities in a sea of small red counties.", { votes: number(stats!.rVotes) })}</p>
      <div className="geo-toggle" role="group" aria-label={t("Dot size")}><button className={size === "equal" ? "active" : ""} onClick={() => { setSize("equal"); go(index); }}>{t("By county")}</button><button className={size === "votes" ? "active" : ""} onClick={() => { setSize("votes"); go(index); }}>{t("By votes")}</button></div>
    </>;
    if (item.kind === "axis") return <>
      <p className="eyebrow">{t(item.axis!.kicker)}</p>
      <h2>{t(item.axis!.title)}</h2>
      <p>{t(item.axis!.story)}</p>
      <AxisChart axis={item.axis!} counties={counties} active={index === chapter ? active : null} onActive={(key) => { go(index); setActive(key); }} />
      <p className="geo-hint">{t("Hover a group to light up its counties on the map.")}</p>
    </>;
    if (item.kind === "belts") return <>
      <p className="eyebrow">{t("AXIS 5 · THE BELTS")}</p>
      <h2>{t("The belts of American politics")}</h2>
      <p>{t("Political journalists talk in belts: regions that share an economy, a history and a way of voting. Pick one to see where it is and how it has moved.")}</p>
      <div className="belt-chips">{BELTS.map((option) => <button key={option.key} className={belt === option.key ? "active" : ""} onClick={() => { setBelt(option.key); go(index); }}>{t(option.name)}</button>)}</div>
      <div className="belt-detail">
        <h3>{t(activeBelt.name)}{activeBelt.approx && <small> · {t("approximate boundaries")}</small>}</h3>
        <p>{t(activeBelt.blurb)}</p>
        <div className="belt-table"><div className="belt-head"><b /><span /><span>2016</span><span>2020</span><span>2024</span></div>{beltRows.map(({ item: row, count, years }) => <button key={row.key} type="button" className={row.key === belt ? "active" : ""} onClick={() => { setBelt(row.key); go(index); }}>
          <b>{t(row.name)}</b><span>{t("{n} counties", { n: count })}</span>
          {years.map((value, yearIndex) => <span key={yearIndex} className={value >= 0 ? "dem-text" : "rep-text"}>{signed(value, 0)}</span>)}
        </button>)}
        </div>
      </div>
    </>;
    if (item.kind === "regions") return <>
      <p className="eyebrow">{t("AXIS 6 · REGIONAL AXES")}</p>
      <h2>{t("Six routes through the electoral map.")}</h2>
      <RegionalAxes presidential={presidential} races={races} lens={lens} onLens={(next) => { setLens(next); go(index); }} focus={focus} onFocus={setFocus} />
    </>;
    return <>
      <p className="eyebrow">{t("AXIS 7 · THE SWING")}</p>
      <h2>{t("Which way the map moved")}</h2>
      <p>{swing.from === "v20"
        ? t("From 2020 to 2024, {share}% of counties moved toward Trump. Arrows point left for a Democratic shift and right for a Republican one; longer arrows mean bigger swings, thicker ones more voters.", { share: number(stats!.swingR2024) })
        : t("From 2016 to 2020, only {share}% of counties moved toward Trump: Biden gained in the suburbs while Trump kept growing in rural areas.", { share: number(stats!.swingR2020) })}</p>
      <div className="geo-toggle" role="group" aria-label={t("Elections to compare")}><button className={swing.from === "v16" ? "active" : ""} onClick={() => { setSwing({ from: "v16", to: "v20" }); go(index); }}>2016 → 2020</button><button className={swing.from === "v20" ? "active" : ""} onClick={() => { setSwing({ from: "v20", to: "v24" }); go(index); }}>2020 → 2024</button></div>
      <p className="geo-hint">{t("National popular vote: {a} in 2016, {b} in 2020, {c} in 2024.", { a: signed(NATIONAL_POPULAR_VOTE[0]), b: signed(NATIONAL_POPULAR_VOTE[1]), c: signed(NATIONAL_POPULAR_VOTE[2]) })}</p>
    </>;
  };

  const legend = current.kind === "axis" && !active
    ? current.axis!.buckets.map((bucket, index) => ({ color: BUCKET_COLORS[index], label: t(bucket.label) }))
    : current.kind === "regions" ? Object.entries(REGION_COLORS).map(([key, color]) => ({ color, label: t({ rust: "Rust Belt", sun: "Sun Belt & South", plains: "Middle & Rural", pacific: "West Coast & Pacific", mountain: "Mountain West", east: "East Coast" }[key as RegionKey]) }))
      : null;

  return <div className={`geo-story${presenting ? " presenting" : ""}`}>
    <div className="geo-stage">
      <div className="geo-stage-inner">
        <CountyMap counties={projected} colorOf={view.colorOf} size={view.size} highlight={view.highlight} arrows={view.arrows} label={t("Map of US counties")} onHover={setHovered} />
        <div className="geo-legend">{legend
          ? legend.map((item) => <span key={item.label}><i style={{ background: `rgb(${item.color[0]},${item.color[1]},${item.color[2]})` }} />{item.label}</span>)
          : <span className="geo-gradient"><b className="dem-text">D+40</b><i /><b className="rep-text">R+40</b><small>{current.kind === "swing" ? t("arrows: swing between elections") : t("2024 presidential margin")}</small></span>}</div>
        {hovered && <div className="geo-tooltip"><b>{hovered.n}, {hovered.s}</b><span>{YEARS.map((year) => `${year.label} ${signed(margin(hovered[year.key]))}`).join(" · ")}</span><small>{t("{n} voters", { n: number(hovered.v24[2]) })}{hovered.den !== null ? ` · ${t("{n} people per sq mi", { n: number(hovered.den) })}` : ""}{hovered.h !== null ? ` · ${number(hovered.h)}% ${t("Hispanic")}` : ""}{hovered.b !== null ? ` · ${number(hovered.b)}% ${t("Black")}` : ""}</small></div>}
        {presenting && <div className="geo-present-caption">{chapterBody(current, chapter)}<div className="geo-present-nav"><button onClick={() => go(chapter - 1)} disabled={chapter === 0}>←</button><span>{chapter + 1} / {CHAPTERS.length}</span><button onClick={() => go(chapter + 1)} disabled={chapter === CHAPTERS.length - 1}>→</button><button onClick={() => setPresenting(false)}>{t("Exit")}</button></div></div>}
      </div>
    </div>
    {!presenting && <div className="geo-chapters">
      {CHAPTERS.map((item, index) => <section key={item.key} ref={(element) => { sections.current[index] = element; }} data-index={index} className={`geo-chapter${index === chapter ? " current" : ""}`}>{chapterBody(item, index)}</section>)}
      <p className="geo-footnote">{t("County results 2016–2024 and Census ACS demographics. 2016 county votes are scaled to each state's official result; Alaska has no county results and Connecticut's planning regions have no density figure. Belts marked approximate are drawn from county location.")}</p>
    </div>}
    <button type="button" className="geo-present-button" onClick={() => setPresenting((value) => !value)}>{presenting ? t("Exit presentation") : t("Present ▶")}</button>
  </div>;
}
