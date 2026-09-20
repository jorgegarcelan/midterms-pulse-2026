"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { useElectionContext } from "@/components/election-context";
import { stateByCode, states } from "@/data/geography";

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
function compact(value: number) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value); }
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
  const [cursor, setCursor] = useState<number | null>(null);
  const result = useMemo(() => {
    const latestDate = Math.max(0, ...polls.map((point) => Date.parse(point.date)), ...house.map((point) => Date.parse(point.date)), ...senate.map((point) => Date.parse(point.date)));
    const cutoff = range === "all" ? 0 : latestDate - Number(range) * 86400000;
    const series = [
      { key: "polls", label: "Poll D two-party", color: "#83abe6", values: polls.map((point) => ({ date: point.date, value: 50 + point.margin / 2 })).filter((point) => Date.parse(point.date) >= cutoff) },
      { key: "house", label: "House market", color: "#55b983", values: house.map((point) => ({ date: point.date, value: point.probability * 100 })).filter((point) => Date.parse(point.date) >= cutoff) },
      { key: "senate", label: "Senate market", color: "#d6a95e", values: senate.map((point) => ({ date: point.date, value: point.probability * 100 })).filter((point) => Date.parse(point.date) >= cutoff) },
    ];
    const all = series.flatMap((item) => item.values);
    if (!all.length) return null;
    const minDate = Math.min(...all.map((point) => Date.parse(point.date)));
    const maxDate = Math.max(...all.map((point) => Date.parse(point.date)));
    const x = (date: string) => maxDate === minDate ? 0 : (Date.parse(date) - minDate) / (maxDate - minDate) * 860;
    const y = (value: number) => 245 - value / 100 * 210;
    return { series: series.map((item) => ({ ...item, points: item.values.map((point) => `${x(point.date).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ") })), minDate, maxDate, x, y };
  }, [house, polls, range, senate]);

  if (!result) return <div className="data-loading">Signal history is unavailable.</div>;
  const cursorDate = cursor === null ? null : result.minDate + (cursor / 860) * (result.maxDate - result.minDate);
  const nearest = cursorDate === null ? [] : result.series.map((series) => {
    const point = [...series.values].sort((a, b) => Math.abs(Date.parse(a.date) - cursorDate) - Math.abs(Date.parse(b.date) - cursorDate))[0];
    return { ...series, point };
  }).filter((item) => item.point);
  return <div className="linked-chart">
    <div className="linked-legend">{result.series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}<b>{item.values.at(-1)?.value.toFixed(1)}%</b></span>)}</div>
    <svg viewBox="0 0 860 260" role="img" aria-label="Linked polling and prediction market signals" onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setCursor(clamp((event.clientX - rect.left) / rect.width * 860, 0, 860)); }} onMouseLeave={() => setCursor(null)}>
      {[25, 50, 75, 100].map((value) => <g key={value}><line x1="0" x2="860" y1={result.y(value)} y2={result.y(value)} /><text x="4" y={result.y(value) - 6}>{value}%</text></g>)}
      {result.series.map((item) => <polyline key={item.key} points={item.points} fill="none" stroke={item.color} strokeWidth="2.5" />)}
      {cursor !== null && <line className="cursor-line" x1={cursor} x2={cursor} y1="25" y2="245" />}
      {forecast && <><line className="forecast-benchmark" x1="0" x2="860" y1={result.y(forecast.house.demMajority)} y2={result.y(forecast.house.demMajority)} /><text x="665" y={result.y(forecast.house.demMajority) - 6}>House forecast {forecast.house.demMajority}%</text></>}
    </svg>
    <div className="linked-axis"><span>{new Date(result.minDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span><span>{new Date(result.maxDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
    {cursorDate && <div className="cursor-readout"><strong>{new Date(cursorDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>{nearest.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}: {item.point.value.toFixed(1)}%</span>)}</div>}
  </div>;
}

function MetricBar({ label, a, b, suffix = "" }: { label: string; a: number; b: number; suffix?: string }) {
  const max = Math.max(Math.abs(a), Math.abs(b), 1);
  return <div className="compare-metric"><span>{label}</span><div><i className="dem" style={{ width: `${Math.abs(a) / max * 100}%` }} /><strong>{a.toFixed(1)}{suffix}</strong></div><div><i className="rep" style={{ width: `${Math.abs(b) / max * 100}%` }} /><strong>{b.toFixed(1)}{suffix}</strong></div></div>;
}

export function InteractiveWorkspace({ initialStateCode }: { initialStateCode?: string }) {
  const context = useElectionContext();
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
  const [answer, setAnswer] = useState("Ask about the selected geography, signals or scenario.");
  const [analystLoading, setAnalystLoading] = useState(false);

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
    const pollEvents: TimelineEvent[] = (polls?.polls || []).slice(0, 18).map((poll) => ({ id: `poll-${poll.id}`, date: poll.endDate, type: "poll", title: `${poll.pollster} · ${poll.race}`, detail: `D ${poll.dem.toFixed(1)} · R ${poll.rep.toFixed(1)} · ${poll.population}${poll.sample ? ` · n=${poll.sample.toLocaleString()}` : ""}`, url: poll.source }));
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
    const next = [{ id: String(Date.now()), name: String(form.get("name") || "Scenario"), swing, turnout, college, urban }, ...savedScenarios].slice(0, 6);
    setSavedScenarios(next); window.localStorage.setItem("midterm-pulse-scenarios", JSON.stringify(next)); event.currentTarget.reset();
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const title = String(form.get("title") || "").trim(); if (!title) return;
    const next = [{ id: `note-${Date.now()}`, date: String(form.get("date") || new Date().toISOString().slice(0, 10)), type: "note" as const, title, detail: String(form.get("detail") || "") }, ...notes];
    setNotes(next); window.localStorage.setItem("midterm-pulse-timeline-notes", JSON.stringify(next)); event.currentTarget.reset();
  }

  async function askAnalyst(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!question.trim()) return; setAnalystLoading(true);
    try { const response = await fetch("/api/analyst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, context: { geography: summary.name, cycle: context.cycle, chamber: context.chamber, historicalMargin: summary.margin, scenario: { swing, turnout, college, urban, resultingMargin: scenarioMargin } } }) }); const result = await response.json() as { answer: string }; setAnswer(result.answer); } catch { setAnswer("The analyst is temporarily unavailable. The selected data remain visible in the workspace."); } finally { setAnalystLoading(false); }
  }

  return <>
    <section className="workspace-head">
      <div><p className="eyebrow">ANALYSIS WORKSPACE</p><h1>{summary.name}</h1><p>{context.cycle} context · {context.chamber === "all" ? "All chambers" : context.chamber === "house" ? "House" : "Senate"} · shareable selection</p></div>
      {context.stateCode !== "US" && <div className="workspace-head-actions"><button className={context.pinnedStates.includes(context.stateCode) ? "active" : ""} onClick={() => context.togglePinnedState(context.stateCode)}>{context.pinnedStates.includes(context.stateCode) ? "Pinned for comparison" : "Pin for comparison"}</button><Link href="/explore">Open county map →</Link></div>}
    </section>
    <nav className="workspace-tabs" aria-label="Workspace views">{(["overview", "signals", "compare", "scenario", "timeline"] as View[]).map((item) => <button key={item} className={view === item ? "active" : ""} onClick={() => selectView(item)}>{item}</button>)}</nav>
    {error && <div className="panel data-error">{error}</div>}
    {!rows ? <div className="panel data-loading">Loading linked election datasets…</div> : <>
      {view === "overview" && <section className="workspace-view">
        <div className="workspace-kpis"><article><span>{historicalCycle} margin</span><strong className={summary.margin >= 0 ? "dem-text" : "rep-text"}>{summary.margin >= 0 ? "D" : "R"}+{Math.abs(summary.margin).toFixed(1)}</strong><small>{summary.totalVotes.toLocaleString()} votes</small></article><article><span>Population</span><strong>{compact(summary.population)}</strong><small>{summary.counties} counties</small></article><article><span>Median income</span><strong>${compact(summary.medianIncome)}</strong><small>Population-weighted county average</small></article><article><span>Bachelor&apos;s degree</span><strong>{summary.bachelorsRate.toFixed(1)}%</strong><small>Poverty {summary.povertyRate.toFixed(1)}%</small></article></div>
        <div className="workspace-overview-grid">
          <article className="panel"><div className="panel-head"><div><p className="eyebrow">{context.county ? "RACES IN SCOPE" : "COUNTY MOVEMENT"}</p><h2>{context.county ? "Current forecast board" : "Largest shifts"}</h2></div><Link href="/explore">Full map →</Link></div>{context.county ? <div className="compact-table race-compact"><div><span>Race</span><span>Chamber</span><span>Margin</span><span>Win prob.</span></div>{scopedRaces.length ? scopedRaces.map((race) => <button key={`${race.chamber}-${race.code}`} onClick={() => context.setContext({ chamber: race.chamber })}><strong>{race.state}</strong><span>{race.chamber}</span><span className={race.leader === "D" ? "dem-text" : "rep-text"}>{race.leader}+{race.margin.toFixed(1)}</span><span>{race.winProbability}%</span></button>) : <p className="table-empty">No competitive benchmark race is currently listed for this county. Statewide and national signals remain available.</p>}</div> : <div className="compact-table"><div><span>County</span><span>Margin</span><span>R shift</span><span>Votes</span></div>{topCounties.map((county) => { const margin = (county.demShare - county.repShare) * 100; return <button key={county.fips} onClick={() => context.setContext({ county: county.county })}><strong>{county.county}</strong><span className={margin >= 0 ? "dem-text" : "rep-text"}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}</span><span>{county.shiftRep >= 0 ? "R" : "D"}+{Math.abs(county.shiftRep).toFixed(1)}</span><span>{compact(county.totalVotes)}</span></button>; })}</div>}</article>
          <aside className="panel contextual-analyst"><p className="eyebrow">CONTEXTUAL ANALYST</p><h2>Ask about {summary.name}</h2><div className="answer-box"><p>{analystLoading ? "Reading the selected context…" : answer}</p></div><form onSubmit={askAnalyst}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={`Ask about ${summary.name}…`} /><button disabled={analystLoading}>Ask</button></form><div className="analyst-prompts"><button onClick={() => setQuestion(`What changed in ${summary.name} since 2020?`)}>What changed since 2020?</button><button onClick={() => setQuestion(`Which counties matter most in ${summary.name}?`)}>Which counties matter?</button></div></aside>
        </div>
      </section>}
      {view === "signals" && <section className="workspace-view"><article className="panel"><div className="panel-head"><div><p className="eyebrow">LINKED SIGNALS</p><h2>Polls, model and markets</h2></div><div className="segmented">{(["30", "90", "all"] as const).map((item) => <button key={item} className={range === item ? "selected" : ""} onClick={() => setRange(item)}>{item === "all" ? "Full cycle" : `${item} days`}</button>)}</div></div><SignalChart polls={polls?.trend || []} house={markets?.history.houseDem || []} senate={markets?.history.senateDem || []} forecast={forecast} range={range} /></article><div className="signal-summary"><article><span>House forecast</span><strong>{forecast?.house.demMajority ?? "—"}%</strong><small>Democratic majority</small></article><article><span>House market</span><strong>{((markets?.history.houseDem.at(-1)?.probability || 0) * 100).toFixed(1)}%</strong><small>Difference {(Number((markets?.history.houseDem.at(-1)?.probability || 0) * 100) - (forecast?.house.demMajority || 0)).toFixed(1)} pp vs model</small></article><article><span>Senate forecast</span><strong>{forecast?.senate.demMajority ?? "—"}%</strong><small>Democratic majority</small></article><article><span>Senate market</span><strong>{((markets?.history.senateDem.at(-1)?.probability || 0) * 100).toFixed(1)}%</strong><small>Difference {(Number((markets?.history.senateDem.at(-1)?.probability || 0) * 100) - (forecast?.senate.demMajority || 0)).toFixed(1)} pp vs model</small></article></div></section>}
      {view === "compare" && <section className="workspace-view"><div className="compare-controls panel"><label>Level<select value={compareLevel} onChange={(event) => { const next = event.target.value as "state" | "county"; setCompareLevel(next); if (next === "county") { setCompareA(countyOptions[0]?.value || ""); setCompareB(countyOptions[1]?.value || ""); } else { setCompareA(context.pinnedStates[0] || "AZ"); setCompareB(context.pinnedStates[1] || "PA"); } }}><option value="state">States</option><option value="county">Counties</option></select></label><label>Territory A<select value={compareA} onChange={(event) => setCompareA(event.target.value)}>{compareLevel === "state" ? states.map((state) => <option value={state.code} key={state.code}>{state.name}</option>) : countyOptions.map((county) => <option value={county.value} key={county.value}>{county.name}</option>)}</select></label><span>versus</span><label>Territory B<select value={compareB} onChange={(event) => setCompareB(event.target.value)}>{compareLevel === "state" ? states.map((state) => <option value={state.code} key={state.code}>{state.name}</option>) : countyOptions.map((county) => <option value={county.value} key={county.value}>{county.name}</option>)}</select></label>{compareLevel === "state" && <button onClick={() => { context.togglePinnedState(compareA); context.togglePinnedState(compareB); }}>Pin both</button>}</div><div className="compare-grid"><article className="panel compare-profile"><p className="eyebrow">TERRITORY A</p><h2>{comparisonA.name}</h2><strong className={comparisonA.margin >= 0 ? "dem-text" : "rep-text"}>{comparisonA.margin >= 0 ? "D" : "R"}+{Math.abs(comparisonA.margin).toFixed(1)}</strong>{compareLevel === "state" ? <Link href={`/states/${compareA.toLowerCase()}`}>Open profile →</Link> : <Link href="/explore">Open on map →</Link>}</article><div className="panel compare-metrics"><MetricBar label="Democratic share" a={comparisonA.demShare} b={comparisonB.demShare} suffix="%" /><MetricBar label="Bachelor's degree" a={comparisonA.bachelorsRate} b={comparisonB.bachelorsRate} suffix="%" /><MetricBar label="Median income ($000s)" a={comparisonA.medianIncome / 1000} b={comparisonB.medianIncome / 1000} /><MetricBar label="Poverty" a={comparisonA.povertyRate} b={comparisonB.povertyRate} suffix="%" /><MetricBar label="Unemployment" a={comparisonA.unemploymentRate} b={comparisonB.unemploymentRate} suffix="%" /></div><article className="panel compare-profile"><p className="eyebrow">TERRITORY B</p><h2>{comparisonB.name}</h2><strong className={comparisonB.margin >= 0 ? "dem-text" : "rep-text"}>{comparisonB.margin >= 0 ? "D" : "R"}+{Math.abs(comparisonB.margin).toFixed(1)}</strong>{compareLevel === "state" ? <Link href={`/states/${compareB.toLowerCase()}`}>Open profile →</Link> : <Link href="/explore">Open on map →</Link>}</article></div></section>}
      {view === "scenario" && <section className="workspace-view scenario-workspace"><article className="panel scenario-controls"><div><p className="eyebrow">SENSITIVITY MODEL</p><h2>Adjust the electorate</h2><p>These controls test sensitivity around the selected historical baseline. They are not a forecast.</p></div>{[
        { label: "National swing", value: swing, setter: setSwing, min: -10, max: 10 },
        { label: "Turnout differential", value: turnout, setter: setTurnout, min: -8, max: 8 },
        { label: "College shift", value: college, setter: setCollege, min: -8, max: 8 },
        { label: "Urban shift", value: urban, setter: setUrban, min: -8, max: 8 },
      ].map(({ label, value, setter, min, max }) => <label key={label}><span>{label}<b>{value > 0 ? "+" : ""}{value.toFixed(1)}</b></span><input type="range" min={min} max={max} step=".5" value={value} onChange={(event) => setter(Number(event.target.value))} /></label>)}<button onClick={() => { setSwing(0); setTurnout(0); setCollege(0); setUrban(0); }}>Reset</button></article><div className="scenario-results"><article><span>Adjusted margin</span><strong className={scenarioMargin >= 0 ? "dem-text" : "rep-text"}>{scenarioMargin >= 0 ? "D" : "R"}+{Math.abs(scenarioMargin).toFixed(1)}</strong><small>Baseline {summary.margin >= 0 ? "D" : "R"}+{Math.abs(summary.margin).toFixed(1)}</small></article><article><span>House sensitivity</span><strong>{houseProbability}%</strong><small>D {houseSeats} · R {435 - houseSeats}</small></article><article><span>Senate sensitivity</span><strong>{senateProbability}%</strong><small>Democratic control</small></article><form onSubmit={saveScenario}><label>Scenario name<input name="name" placeholder="e.g. High youth turnout" required /></label><button>Save scenario</button></form></div>{savedScenarios.length > 0 && <div className="panel saved-scenarios"><div className="panel-head"><div><p className="eyebrow">SAVED LOCALLY</p><h2>Saved scenarios</h2></div></div>{savedScenarios.map((item) => <button key={item.id} onClick={() => { setSwing(item.swing); setTurnout(item.turnout); setCollege(item.college); setUrban(item.urban); }}><strong>{item.name}</strong><span>Swing {item.swing > 0 ? "+" : ""}{item.swing} · turnout {item.turnout > 0 ? "+" : ""}{item.turnout} · college {item.college > 0 ? "+" : ""}{item.college} · urban {item.urban > 0 ? "+" : ""}{item.urban}</span></button>)}</div>}</section>}
      {view === "timeline" && <section className="workspace-view timeline-workspace"><aside className="panel timeline-compose"><p className="eyebrow">ANNOTATION</p><h2>Add an event</h2><form onSubmit={addNote}><label>Date<input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Title<input name="title" required placeholder="Debate, endorsement, filing…" /></label><label>Details<textarea name="detail" rows={4} placeholder="Why this event matters" /></label><button>Add to timeline</button></form></aside><article className="panel timeline-feed"><div className="panel-head"><div><p className="eyebrow">EVENT STREAM</p><h2>Polls, markets and notes</h2></div><div className="segmented">{(["all", "poll", "market", "note"] as const).map((item) => <button key={item} className={timelineFilter === item ? "selected" : ""} onClick={() => setTimelineFilter(item)}>{item}</button>)}</div></div><div className="event-list">{timeline.map((event) => <article key={event.id}><time>{event.date}</time><i className={`event-${event.type}`} /><div><span>{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p>{event.url && <a href={event.url} target="_blank" rel="noreferrer">Source ↗</a>}</div>{event.type === "note" && <button aria-label={`Remove ${event.title}`} onClick={() => { const next = notes.filter((note) => note.id !== event.id); setNotes(next); window.localStorage.setItem("midterm-pulse-timeline-notes", JSON.stringify(next)); }}>×</button>}</article>)}</div></article></section>}
    </>}
  </>;
}
