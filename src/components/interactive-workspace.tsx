"use client";

import "@/app/motion-b.css";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import Papa from "papaparse";
import { useElectionContext } from "@/components/election-context";
import { useAnalystEnabled } from "@/lib/use-analyst";
import { stateByCode, states } from "@/data/geography";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

type View = "overview" | "signals" | "compare" | "scenario" | "timeline";
type CountyRow = {
  fips: string; state: string; county: string; votesDem: number; votesRep: number; totalVotes: number;
  demShare: number; repShare: number; shiftRep: number; population: number; medianIncome: number;
  bachelorsRate: number; povertyRate: number; unemploymentRate: number;
};
type Aggregate = {
  name: string; counties: number; votesDem: number; votesRep: number; totalVotes: number; population: number;
  demShare: number; repShare: number; margin: number; medianIncome: number; bachelorsRate: number;
  povertyRate: number; unemploymentRate: number;
};
type PollPoint = { date: string; dem: number; rep: number; margin: number; polls: number };
type LivePoll = { id: string; pollster: string; race: string; dem: number; rep: number; endDate: string; sample: number; population: string; source: string };
type PollFeed = { meta: { run_date: string; n_polls: number }; polls: LivePoll[]; trend: PollPoint[]; source: string };
type HistoryPoint = { date: string; probability: number };
type MarketFeed = { updated: string; history: { senateDem: HistoryPoint[]; houseDem: HistoryPoint[] }; events: { house: { url: string; markets: MarketItem[] }; senate: { url: string; markets: MarketItem[] }; balance: { url: string; markets: MarketItem[] } } };
type MarketItem = { id: string; question: string; prices: number[]; volume: number; change24h: number };
type ForecastRace = { code: string; state: string; chamber: "house" | "senate"; leader: "D" | "R"; margin: number; winProbability: number };
type ForecastFeed = { updated: string; house: { demMajority: number; demSeats: number; repSeats: number }; senate: { demMajority: number; demSeats: number; repSeats: number }; races: ForecastRace[] };
type TimelineEvent = { id: string; date: string; type: "poll" | "market" | "note"; title: string; detail: string; url?: string };
type SavedScenario = { id: string; name: string; swing: number; turnout: number; college: number; urban: number };

const cycleFiles: Record<"2016" | "2020" | "2024", string> = { "2016": "/data/county-2016.csv", "2020": "/data/county-2020.csv", "2024": "/data/county-2024.csv" };

function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function compact(value: number, locale: string) { return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value); }
function parseRows(text: string) {
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data.map((row): CountyRow => ({
    fips: String(row.county_fips || "").padStart(5, "0"), state: row.state, county: row.county,
    votesDem: number(row.votes_dem), votesRep: number(row.votes_gop), totalVotes: number(row.total_votes),
    demShare: number(row.per_dem), repShare: number(row.per_gop), shiftRep: number(row.delta_per_gop),
    population: number(row.pop_total), medianIncome: number(row.median_income), bachelorsRate: number(row.bachelors_rate),
    povertyRate: number(row.poverty_rate), unemploymentRate: number(row.unemployment_rate),
  })).filter((row) => row.fips.length === 5 && row.county);
}

function aggregate(rows: CountyRow[], name: string): Aggregate {
  const totals = rows.reduce((sum, row) => ({ dem: sum.dem + row.votesDem, rep: sum.rep + row.votesRep, total: sum.total + row.totalVotes, population: sum.population + row.population, income: sum.income + row.medianIncome * row.population, bachelors: sum.bachelors + row.bachelorsRate * row.population, poverty: sum.poverty + row.povertyRate * row.population, unemployment: sum.unemployment + row.unemploymentRate * row.population }), { dem: 0, rep: 0, total: 0, population: 0, income: 0, bachelors: 0, poverty: 0, unemployment: 0 });
  const demShare = totals.total ? totals.dem / totals.total * 100 : 0;
  const repShare = totals.total ? totals.rep / totals.total * 100 : 0;
  return { name, counties: rows.length, votesDem: totals.dem, votesRep: totals.rep, totalVotes: totals.total, population: totals.population, demShare, repShare, margin: demShare - repShare, medianIncome: totals.population ? totals.income / totals.population : 0, bachelorsRate: totals.population ? totals.bachelors / totals.population : 0, povertyRate: totals.population ? totals.poverty / totals.population : 0, unemploymentRate: totals.population ? totals.unemployment / totals.population : 0 };
}

function SignalChart({ polls, house, senate, forecast, range }: { polls: PollPoint[]; house: HistoryPoint[]; senate: HistoryPoint[]; forecast: ForecastFeed | null; range: "30" | "90" | "all" }) {
  const t = useT();
  const locale = useIntlLocale();
  const [cursor, setCursor] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setHidden((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const result = useMemo(() => {
    const latestDate = Math.max(0, ...polls.map((point) => Date.parse(point.date)), ...house.map((point) => Date.parse(point.date)), ...senate.map((point) => Date.parse(point.date)));
    const cutoff = range === "all" ? 0 : latestDate - Number(range) * 86400000;
    const series = [
      { key: "polls", label: t("Poll D two-party"), color: "#83abe6", values: polls.map((point) => ({ date: point.date, value: 50 + point.margin / 2 })).filter((point) => Date.parse(point.date) >= cutoff) },
      { key: "house", label: t("House market"), color: "#55b983", values: house.map((point) => ({ date: point.date, value: point.probability * 100 })).filter((point) => Date.parse(point.date) >= cutoff) },
      { key: "senate", label: t("Senate market"), color: "#d6a95e", values: senate.map((point) => ({ date: point.date, value: point.probability * 100 })).filter((point) => Date.parse(point.date) >= cutoff) },
    ];
    const all = series.flatMap((item) => item.values);
    if (!all.length) return null;
    const minDate = Math.min(...all.map((point) => Date.parse(point.date)));
    const maxDate = Math.max(...all.map((point) => Date.parse(point.date)));
    const x = (date: string) => maxDate === minDate ? 0 : (Date.parse(date) - minDate) / (maxDate - minDate) * 860;
    const y = (value: number) => 245 - value / 100 * 210;
    return { series: series.map((item) => ({ ...item, points: item.values.map((point) => `${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ") })), minDate, maxDate, x, y };
  }, [house, polls, range, senate, t]);

  if (!result) return <div className="data-loading">{t("Signal history is unavailable.")}</div>;
  const cursorDate = cursor === null ? null : result.minDate + (cursor / 860) * (result.maxDate - result.minDate);
  const nearest = cursorDate === null ? [] : result.series.map((series) => {
    const point = [...series.values].sort((a, b) => Math.abs(Date.parse(a.date) - cursorDate) - Math.abs(Date.parse(b.date) - cursorDate))[0];
    return { ...series, point };
  }).filter((item) => item.point && !hidden.has(item.key));
  // Arrow keys move the cursor in 1/60 steps; Escape clears it.
  function keyCursor(event: React.KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape") { setCursor(null); return; }
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    setCursor((current) => clamp((current ?? 860) + step * (event.shiftKey ? 86 : 860 / 60), 0, 860));
  }
  return <div className="linked-chart mpb-linked">
    <div className="linked-legend">{result.series.map((item) => <button type="button" key={item.key} className={hidden.has(item.key) ? "off" : undefined} aria-pressed={!hidden.has(item.key)} onClick={() => toggle(item.key)}><i style={{ background: item.color }} />{item.label}<b>{item.values.at(-1)?.value.toFixed(1)}%</b></button>)}</div>
    <svg viewBox="0 0 860 260" role="img" tabIndex={0} aria-label={`${t("Linked polling and prediction market signals")}. ${t("Use the arrow keys to move through time.")}`} onKeyDown={keyCursor} onBlur={() => setCursor(null)} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setCursor(clamp((event.clientX - rect.left) / rect.width * 860, 0, 860)); }} onPointerLeave={() => setCursor(null)}>
      {[25, 50, 75, 100].map((value) => <g key={value}><line x1="0" x2="860" y1={result.y(value)} y2={result.y(value)} /><text x="4" y={result.y(value) - 6}>{value}%</text></g>)}
      {result.series.map((item, index) => <polyline key={`${item.key}-${range}`} className={`mpb-linked-line${hidden.has(item.key) ? " off" : ""}`} style={{ "--i": index } as React.CSSProperties} pathLength={1} points={item.points} fill="none" stroke={item.color} strokeWidth="2.5" />)}
      {cursor !== null && <line className="cursor-line" x1={cursor} x2={cursor} y1="25" y2="245" />}
      {cursor !== null && nearest.map((item) => <circle key={item.key} className="mpb-linked-dot" cx={result.x(item.point.date)} cy={result.y(item.point.value)} r="4.5" fill={item.color} />)}
      {forecast && <><line className="forecast-benchmark" x1="0" x2="860" y1={result.y(forecast.house.demMajority)} y2={result.y(forecast.house.demMajority)} /><text x="665" y={result.y(forecast.house.demMajority) - 6}>{t("House forecast {value}%", { value: forecast.house.demMajority })}</text></>}
    </svg>
    <div className="linked-axis"><span>{new Date(result.minDate).toLocaleDateString(locale, { month: "short", year: "numeric" })}</span><span>{new Date(result.maxDate).toLocaleDateString(locale, { month: "short", day: "numeric" })}</span></div>
    {cursorDate && <div className="cursor-readout"><strong>{new Date(cursorDate).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}</strong>{nearest.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}: {item.point.value.toFixed(1)}%</span>)}</div>}
  </div>;
}

function MetricBar({ label, a, b, suffix = "" }: { label: string; a: number; b: number; suffix?: string }) {
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return <div className="compare-metric"><span>{label}</span><div><i className="dem" style={{ width: `${Math.abs(a) / max * 100}%` }} /><strong>{a.toFixed(1)}{suffix}</strong></div><div><i className="rep" style={{ width: `${Math.abs(b) / max * 100}%` }} /><strong>{b.toFixed(1)}{suffix}</strong></div></div>;
}

export function InteractiveWorkspace({ initialStateCode }: { initialStateCode?: string }) {
  const context = useElectionContext();
  const t = useT();
  const locale = useIntlLocale();
  const [view, setView] = useState<View>("overview");
  const [rows, setRows] = useState<Record<"2016" | "2020" | "2024", CountyRow[]> | null>(null);
  const [polls, setPolls] = useState<PollFeed | null>(null);
  const [markets, setMarkets] = useState<MarketFeed | null>(null);
  const [forecast, setForecast] = useState<ForecastFeed | null>(null);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"30" | "90" | "all">("90");
  const [compareLevel, setCompareLevel] = useState<"state" | "county">("state");
  const [compareA, setCompareA] = useState("AZ");
  const [compareB, setCompareB] = useState("PA");
  const [swing, setSwing] = useState(0);
  const [turnout, setTurnout] = useState(0);
  const [college, setCollege] = useState(0);
  const [urban, setUrban] = useState(0);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<"all" | TimelineEvent["type"]>("all");
  const [notes, setNotes] = useState<TimelineEvent[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [analystLoading, setAnalystLoading] = useState(false);
  const analystEnabled = useAnalystEnabled();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedView = params.get("view");
    const nextView = requestedView === "signals" || requestedView === "compare" || requestedView === "scenario" || requestedView === "timeline" ? requestedView : "overview";
    let nextNotes: TimelineEvent[] = [];
    let nextScenarios: SavedScenario[] = [];
    try {
      nextNotes = JSON.parse(window.localStorage.getItem("midterm-pulse-timeline-notes") || "[]");
      nextScenarios = JSON.parse(window.localStorage.getItem("midterm-pulse-scenarios") || "[]");
    } catch { /* optional local state */ }
    const timer = window.setTimeout(() => {
      setView(nextView);
      setNotes(nextNotes);
      setSavedScenarios(nextScenarios);
      if (initialStateCode) context.setContext({ stateCode: initialStateCode.toUpperCase() });
    }, 0);
    return () => window.clearTimeout(timer);
  // Initial URL and profile synchronization only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(cycleFiles["2016"]).then((response) => response.text()), fetch(cycleFiles["2020"]).then((response) => response.text()), fetch(cycleFiles["2024"]).then((response) => response.text()),
      fetch("/api/polls/live").then((response) => response.json() as Promise<PollFeed>), fetch("/api/markets").then((response) => response.json() as Promise<MarketFeed>), fetch("/api/forecast").then((response) => response.json() as Promise<ForecastFeed>),
    ]).then(([data2016, data2020, data2024, pollFeed, marketFeed, forecastFeed]) => {
      if (cancelled) return;
      setRows({ "2016": parseRows(data2016), "2020": parseRows(data2020), "2024": parseRows(data2024) });
      setPolls(pollFeed); setMarkets(marketFeed); setForecast(forecastFeed);
    }).catch(() => { if (!cancelled) setError("One or more workspace datasets could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const pinned = context.pinnedStates;
    const timer = window.setTimeout(() => {
      if (pinned[0]) setCompareA(pinned[0]);
      if (pinned[1]) setCompareB(pinned[1]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [context.pinnedStates]);

  const historicalCycle: "2016" | "2020" | "2024" = context.cycle === "2026" ? "2024" : context.cycle;
  const activeRows = rows?.[historicalCycle] || [];
  const selectedState = stateByCode.get(context.stateCode);
  const stateRows = context.stateCode === "US" ? activeRows : activeRows.filter((row) => row.state === selectedState?.name);
  const scopedRows = context.county ? stateRows.filter((row) => row.county === context.county) : stateRows;
  const summary = aggregate(scopedRows, context.county ? `${context.county}, ${selectedState?.name || ""}` : selectedState?.name || "United States");
  const topCounties = [...scopedRows].sort((a, b) => Math.abs(b.shiftRep) - Math.abs(a.shiftRep)).slice(0, 8);
  const scopedRaces = (forecast?.races || []).filter((race) => context.stateCode === "US" || race.code.startsWith(context.stateCode) || race.state.toLowerCase().includes((selectedState?.name || "").toLowerCase())).filter((race) => context.chamber === "all" || race.chamber === context.chamber).slice(0, 8);
  const placeName = context.county ? `${context.county}, ${t(selectedState?.name || "")}` : t(selectedState?.name || "United States");
  const countyOptions = activeRows.map((row) => ({ value: row.fips, name: `${row.county}, ${row.state}` })).sort((a, b) => a.name.localeCompare(b.name));
  const aggregateFor = (code: string) => {
    if (compareLevel === "county") { const row = activeRows.find((item) => item.fips === code); return aggregate(row ? [row] : [], row ? `${row.county}, ${row.state}` : "County"); }
    const name = stateByCode.get(code)?.name || code; return aggregate(activeRows.filter((row) => row.state === name), name);
  };
  const comparisonA = aggregateFor(compareA);
  const comparisonB = aggregateFor(compareB);
  const scenarioMargin = summary.margin + swing + turnout * .18 + college * .12 + urban * .1;
  const houseSeats = Math.round(clamp(218 + scenarioMargin * 2.2, 160, 275));
  const houseProbability = Math.round(100 / (1 + Math.exp(-scenarioMargin / 2.6)));
  const senateProbability = Math.round(100 / (1 + Math.exp(-(scenarioMargin - 1.5) / 3.2)));
  const timeline = (() => {
    const marketItems = markets?.events.balance.markets || [];
    const pollEvents: TimelineEvent[] = (polls?.polls || []).slice(0, 18).map((poll) => ({ id: `poll-${poll.id}`, date: poll.endDate, type: "poll", title: `${poll.pollster} · ${poll.race}`, detail: `D ${poll.dem.toFixed(1)} · R ${poll.rep.toFixed(1)} · ${poll.population}${poll.sample ? ` · n=${poll.sample.toLocaleString(locale)}` : ""}`, url: poll.source }));
    const marketEvents: TimelineEvent[] = marketItems.slice(0, 6).map((market) => ({ id: `market-${market.id}`, date: markets?.updated.slice(0, 10) || "", type: "market", title: market.question, detail: `${((market.prices[0] || 0) * 100).toFixed(1)}% · 24h ${(market.change24h * 100).toFixed(1)} pp`, url: markets?.events.balance.url }));
    return [...notes, ...pollEvents, ...marketEvents].filter((event) => timelineFilter === "all" || event.type === timelineFilter).sort((a, b) => b.date.localeCompare(a.date));
  })();

  function selectView(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("view"); else url.searchParams.set("view", next);
    window.history.replaceState({}, "", url);
  }

  function saveScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = [{ id: String(Date.now()), name: String(form.get("name") || t("Scenario")), swing, turnout, college, urban }, ...savedScenarios].slice(0, 6);
    setSavedScenarios(next); window.localStorage.setItem("midterm-pulse-scenarios", JSON.stringify(next)); event.currentTarget.reset();
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) return;
    const next = [{ id: `note-${Date.now()}`, date: String(form.get("date") || new Date().toISOString().slice(0, 10)), type: "note" as const, title, detail: String(form.get("detail") || "") }, ...notes];
    setNotes(next); window.localStorage.setItem("midterm-pulse-timeline-notes", JSON.stringify(next)); event.currentTarget.reset();
  }

  async function askAnalyst(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!question.trim()) return; setAnalystLoading(true);
    try { const response = await fetch("/api/analyst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, context: { geography: summary.name, cycle: context.cycle, chamber: context.chamber, historicalMargin: summary.margin, scenario: { swing, turnout, college, urban, resultingMargin: scenarioMargin } } }) }); const result = await response.json() as { answer: string }; setAnswer(result.answer); } catch { setAnswer(t("The analyst is temporarily unavailable. The selected data remain visible in the workspace.")); } finally { setAnalystLoading(false); }
  }

  return <>
    <section className="workspace-head">
      <div><p className="eyebrow">{t("ANALYSIS WORKSPACE")}</p><h1>{placeName}</h1><p>{t("{cycle} context · {chamber} · shareable selection", { cycle: context.cycle, chamber: context.chamber === "all" ? t("All chambers") : context.chamber === "house" ? t("House") : t("Senate") })}</p></div>
      {context.stateCode !== "US" && <div className="workspace-head-actions"><button className={context.pinnedStates.includes(context.stateCode) ? "active" : ""} onClick={() => context.togglePinnedState(context.stateCode)}>{context.pinnedStates.includes(context.stateCode) ? t("Pinned for comparison") : t("Pin for comparison")}</button><Link href="/explore">{t("Open county map →")}</Link></div>}
    </section>
    <nav className="workspace-tabs" aria-label={t("Workspace views")}>{(["overview", "signals", "compare", "scenario", "timeline"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => selectView(item)}>{t(item)}</button>)}</nav>
    {error && <div className="panel data-error">{t(error)}</div>}
    {!rows ? <div className="panel data-loading">{t("Loading linked election datasets…")}</div> : <>
      {view === "overview" && <section className="workspace-view">
        <div className="workspace-kpis"><article><span>{t("{cycle} margin", { cycle: historicalCycle })}</span><strong className={summary.margin >= 0 ? "dem-text" : "rep-text"}>{summary.margin >= 0 ? "D" : "R"}+{Math.abs(summary.margin).toFixed(1)}</strong><small>{t("{count} votes", { count: summary.totalVotes.toLocaleString(locale) })}</small></article><article><span>{t("Population")}</span><strong>{compact(summary.population, locale)}</strong><small>{t("{count} counties", { count: summary.counties })}</small></article><article><span>{t("Median income")}</span><strong>${compact(summary.medianIncome, locale)}</strong><small>{t("Population-weighted county average")}</small></article><article><span>{t("Bachelor's degree")}</span><strong>{summary.bachelorsRate.toFixed(1)}%</strong><small>{t("Poverty {value}%", { value: summary.povertyRate.toFixed(1) })}</small></article></div>
        <div className={`workspace-overview-grid${analystEnabled ? "" : " solo"}`}>
          <article className="panel"><div className="panel-head"><div><p className="eyebrow">{context.county ? t("RACES IN SCOPE") : t("COUNTY MOVEMENT")}</p><h2>{context.county ? t("Current forecast board") : t("Largest shifts")}</h2></div><Link href="/explore">{t("Full map →")}</Link></div>{context.county ? <div className="compact-table race-compact"><div><span>{t("Race")}</span><span>{t("Chamber")}</span><span>{t("Margin")}</span><span>{t("Win prob.")}</span></div>{scopedRaces.length ? scopedRaces.map((race) => <button key={`${race.chamber}-${race.code}`} onClick={() => context.setContext({ chamber: race.chamber })}><strong>{t(race.state)}</strong><span>{t(race.chamber)}</span><span className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</span><span>{race.winProbability}%</span></button>) : <p className="table-empty">{t("No competitive benchmark race is currently listed for this county. Statewide and national signals remain available.")}</p>}</div> : <div className="compact-table"><div><span>{t("County")}</span><span>{t("Margin")}</span><span>{t("R shift")}</span><span>{t("Votes")}</span></div>{topCounties.map((county) => { const margin = (county.demShare - county.repShare) * 100; return <button key={county.fips} onClick={() => context.setContext({ county: county.county })}><strong>{county.county}</strong><span className={margin >= 0 ? "dem-text" : "rep-text"}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}</span><span>{county.shiftRep >= 0 ? "R" : "D"}+{Math.abs(county.shiftRep).toFixed(1)}</span><span>{compact(county.totalVotes, locale)}</span></button>; })}</div>}</article>
          {analystEnabled && <aside className="panel contextual-analyst"><p className="eyebrow">{t("CONTEXTUAL ANALYST")}</p><h2>{t("Ask about {place}", { place: placeName })}</h2><div className="answer-box"><p>{analystLoading ? t("Reading the selected context…") : answer || t("Ask about the selected geography, signals or scenario.")}</p></div><form onSubmit={askAnalyst}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("Ask about {place}…", { place: placeName })} /><button disabled={analystLoading}>{t("Ask")}</button></form><div className="analyst-prompts"><button onClick={() => setQuestion(t("What changed in {place} since 2020?", { place: placeName }))}>{t("What changed since 2020?")}</button><button onClick={() => setQuestion(t("Which counties matter most in {place}?", { place: placeName }))}>{t("Which counties matter?")}</button></div></aside>}
        </div>
      </section>}
      {view === "signals" && <section className="workspace-view"><article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("LINKED SIGNALS")}</p><h2>{t("Polls, model and markets")}</h2></div><div className="segmented">{(["30", "90", "all"] as const).map((item) => <button key={item} className={range === item ? "selected" : ""} onClick={() => setRange(item)}>{item === "all" ? t("Full cycle") : t("{count} days", { count: item })}</button>)}</div></div><SignalChart polls={polls?.trend || []} house={markets?.history.houseDem || []} senate={markets?.history.senateDem || []} forecast={forecast} range={range} /></article><div className="signal-summary"><article><span>{t("House forecast")}</span><strong>{forecast?.house.demMajority ?? "—"}%</strong><small>{t("Democratic majority")}</small></article><article><span>{t("House market")}</span><strong>{((markets?.history.houseDem.at(-1)?.probability || 0) * 100).toFixed(1)}%</strong><small>{t("Difference {value} pp vs model", { value: (Number((markets?.history.houseDem.at(-1)?.probability || 0) * 100) - (forecast?.house.demMajority || 0)).toFixed(1) })}</small></article><article><span>{t("Senate forecast")}</span><strong>{forecast?.senate.demMajority ?? "—"}%</strong><small>{t("Democratic majority")}</small></article><article><span>{t("Senate market")}</span><strong>{((markets?.history.senateDem.at(-1)?.probability || 0) * 100).toFixed(1)}%</strong><small>{t("Difference {value} pp vs model", { value: (Number((markets?.history.senateDem.at(-1)?.probability || 0) * 100) - (forecast?.senate.demMajority || 0)).toFixed(1) })}</small></article></div></section>}
      {view === "compare" && <section className="workspace-view"><div className="compare-controls panel"><label>{t("Level")}<select value={compareLevel} onChange={(event) => { const next = event.target.value as "state" | "county"; setCompareLevel(next); if (next === "county") { setCompareA(countyOptions[0]?.value || ""); setCompareB(countyOptions[1]?.value || ""); } else { setCompareA(context.pinnedStates[0] || "AZ"); setCompareB(context.pinnedStates[1] || "PA"); } }}><option value="state">{t("States")}</option><option value="county">{t("Counties")}</option></select></label><label>{t("Territory A")}<select value={compareA} onChange={(event) => setCompareA(event.target.value)}>{compareLevel === "state" ? states.map((state) => <option value={state.code} key={state.code}>{t(state.name)}</option>) : countyOptions.map((county) => <option value={county.value} key={county.value}>{county.name}</option>)}</select></label><span>{t("versus")}</span><label>{t("Territory B")}<select value={compareB} onChange={(event) => setCompareB(event.target.value)}>{compareLevel === "state" ? states.map((state) => <option value={state.code} key={state.code}>{t(state.name)}</option>) : countyOptions.map((county) => <option value={county.value} key={county.value}>{county.name}</option>)}</select></label>{compareLevel === "state" && <button onClick={() => { context.togglePinnedState(compareA); context.togglePinnedState(compareB); }}>{t("Pin both")}</button>}</div><div className="compare-grid"><article className="panel compare-profile"><p className="eyebrow">{t("TERRITORY A")}</p><h2>{t(comparisonA.name)}</h2><strong className={comparisonA.margin >= 0 ? "dem-text" : "rep-text"}>{comparisonA.margin >= 0 ? "D" : "R"}+{Math.abs(comparisonA.margin).toFixed(1)}</strong>{compareLevel === "state" ? <Link href={`/states/${compareA.toLowerCase()}`}>{t("Open profile →")}</Link> : <Link href="/explore">{t("Open on map →")}</Link>}</article><div className="panel compare-metrics"><MetricBar label={t("Democratic share")} a={comparisonA.demShare} b={comparisonB.demShare} suffix="%" /><MetricBar label={t("Bachelor's degree")} a={comparisonA.bachelorsRate} b={comparisonB.bachelorsRate} suffix="%" /><MetricBar label={t("Median income ($000s)")} a={comparisonA.medianIncome / 1000} b={comparisonB.medianIncome / 1000} /><MetricBar label={t("Poverty")} a={comparisonA.povertyRate} b={comparisonB.povertyRate} suffix="%" /><MetricBar label={t("Unemployment")} a={comparisonA.unemploymentRate} b={comparisonB.unemploymentRate} suffix="%" /></div><article className="panel compare-profile"><p className="eyebrow">{t("TERRITORY B")}</p><h2>{t(comparisonB.name)}</h2><strong className={comparisonB.margin >= 0 ? "dem-text" : "rep-text"}>{comparisonB.margin >= 0 ? "D" : "R"}+{Math.abs(comparisonB.margin).toFixed(1)}</strong>{compareLevel === "state" ? <Link href={`/states/${compareB.toLowerCase()}`}>{t("Open profile →")}</Link> : <Link href="/explore">{t("Open on map →")}</Link>}</article></div></section>}
      {view === "scenario" && <section className="workspace-view scenario-workspace"><article className="panel scenario-controls"><div><p className="eyebrow">{t("SENSITIVITY MODEL")}</p><h2>{t("Adjust the electorate")}</h2><p>{t("These controls test sensitivity around the selected historical baseline. They are not a forecast.")}</p></div>{[
        { label: t("National swing"), value: swing, setter: setSwing, min: -10, max: 10 },
        { label: t("Turnout differential"), value: turnout, setter: setTurnout, min: -8, max: 8 },
        { label: t("College shift"), value: college, setter: setCollege, min: -8, max: 8 },
        { label: t("Urban shift"), value: urban, setter: setUrban, min: -8, max: 8 },
      ].map(({ label, value, setter, min, max }) => <label key={label}><span>{label}<b>{value > 0 ? "+" : ""}{value.toFixed(1)}</b></span><input type="range" min={min} max={max} step=".5" value={value} onChange={(event) => setter(Number(event.target.value))} /></label>)}<button onClick={() => { setSwing(0); setTurnout(0); setCollege(0); setUrban(0); }}>{t("Reset")}</button></article><div className="scenario-results"><article><span>{t("Adjusted margin")}</span><strong className={scenarioMargin >= 0 ? "dem-text" : "rep-text"}>{scenarioMargin >= 0 ? "D" : "R"}+{Math.abs(scenarioMargin).toFixed(1)}</strong><small>{t("Baseline {margin}", { margin: `${summary.margin >= 0 ? "D" : "R"}+${Math.abs(summary.margin).toFixed(1)}` })}</small></article><article><span>{t("House sensitivity")}</span><strong>{houseProbability}%</strong><small>D {houseSeats} · R {435 - houseSeats}</small></article><article><span>{t("Senate sensitivity")}</span><strong>{senateProbability}%</strong><small>{t("Democratic control")}</small></article><form onSubmit={saveScenario}><label>{t("Scenario name")}<input name="name" placeholder={t("e.g. High youth turnout")} required /></label><button>{t("Save scenario")}</button></form></div>{savedScenarios.length > 0 && <div className="panel saved-scenarios"><div className="panel-head"><div><p className="eyebrow">{t("SAVED LOCALLY")}</p><h2>{t("Saved scenarios")}</h2></div></div>{savedScenarios.map((item) => <button key={item.id} onClick={() => { setSwing(item.swing); setTurnout(item.turnout); setCollege(item.college); setUrban(item.urban); }}><strong>{item.name}</strong><span>{t("Swing {swing} · turnout {turnout} · college {college} · urban {urban}", { swing: `${item.swing > 0 ? "+" : ""}${item.swing}`, turnout: `${item.turnout > 0 ? "+" : ""}${item.turnout}`, college: `${item.college > 0 ? "+" : ""}${item.college}`, urban: `${item.urban > 0 ? "+" : ""}${item.urban}` })}</span></button>)}</div>}</section>}
      {view === "timeline" && <section className="workspace-view timeline-workspace"><aside className="panel timeline-compose"><p className="eyebrow">{t("ANNOTATION")}</p><h2>{t("Add an event")}</h2><form onSubmit={addNote}><label>{t("Date")}<input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>{t("Title")}<input name="title" required placeholder={t("Debate, endorsement, filing…")} /></label><label>{t("Details")}<textarea name="detail" rows={4} placeholder={t("Why this event matters")} /></label><button>{t("Add to timeline")}</button></form></aside><article className="panel timeline-feed"><div className="panel-head"><div><p className="eyebrow">{t("EVENT STREAM")}</p><h2>{t("Polls, markets and notes")}</h2></div><div className="segmented">{(["all", "poll", "market", "note"] as const).map((item) => <button key={item} className={timelineFilter === item ? "selected" : ""} onClick={() => setTimelineFilter(item)}>{t(item)}</button>)}</div></div><div className="event-list">{timeline.map((event) => <article key={event.id}><time>{event.date}</time><i className={`event-${event.type}`} /><div><span>{t(event.type)}</span><strong>{event.title}</strong><p>{event.detail}</p>{event.url && <a href={event.url} target="_blank" rel="noreferrer">{t("Source ↗")}</a>}</div>{event.type === "note" && <button aria-label={t("Remove {account}", { account: event.title })} onClick={() => { const next = notes.filter((note) => note.id !== event.id); setNotes(next); window.localStorage.setItem("midterm-pulse-timeline-notes", JSON.stringify(next)); }}>×</button>}</article>)}</div></article></section>}
    </>}
  </>;
}
