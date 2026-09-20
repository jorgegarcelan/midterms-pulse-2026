"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useElectionContext } from "@/components/election-context";
import { pollMapMargins, seedPolls, type Poll } from "@/data/polls";
import { StateTileMap } from "@/components/state-tile-map";

const STORAGE_KEY = "midterm-pulse-user-polls";

type TrendPoint = { date: string; dem: number; rep: number; margin: number; polls: number };
type PollFeed = { meta: { run_date: string; n_polls: number; latest_field_end: string }; polls: Poll[]; trend: TrendPoint[]; source: string };

function PollingTrend({ values }: { values: TrendPoint[] }) {
  if (!values.length) return <div className="market-empty">Waiting for the polling trend…</div>;
  const min = Math.min(...values.map((item) => item.margin), 0) - 1;
  const max = Math.max(...values.map((item) => item.margin), 0) + 1;
  const points = values.map((item, index) => {
    const x = values.length === 1 ? 0 : index / (values.length - 1) * 620;
    const y = 190 - (item.margin - min) / (max - min) * 155;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = values.at(-1);
  return <><div className="large-trend" aria-label="Generic ballot Democratic margin trend"><svg viewBox="0 0 620 220"><line x1="0" x2="620" y1={190 - (0 - min) / (max - min) * 155} y2={190 - (0 - min) / (max - min) * 155} stroke="#59616d" strokeDasharray="5 6" /><polyline points={points} fill="none" stroke="#7ca6f8" strokeWidth="4" /></svg><div><span>{values[0]?.date.slice(5)}</span><span>{values[Math.floor(values.length / 2)]?.date.slice(5)}</span><span>{latest?.date.slice(5)}</span></div></div><p className="chart-note">Weekly average from {values.reduce((sum, item) => sum + item.polls, 0)} poll observations in the visible period.</p></>;
}

function PollRow({ poll }: { poll: Poll }) {
  const margin = poll.dem - poll.rep;
  const demWidth = Math.max(0, Math.min(100, poll.dem));
  const repWidth = Math.max(0, Math.min(100, poll.rep));
  return (
    <article className="poll-row">
      <div className="poll-meta"><strong>{poll.race}</strong><span>{poll.pollster} · {poll.population}{poll.sample ? ` · n=${poll.sample.toLocaleString()}` : ""}</span></div>
      <div className="poll-bars" aria-label={`Democrat ${poll.dem}, Republican ${poll.rep}`}>
        <span className="poll-bar dem" style={{ width: `${demWidth}%` }}><i>D {poll.dem.toFixed(1)}</i></span>
        <span className="poll-bar rep" style={{ width: `${repWidth}%` }}><i>R {poll.rep.toFixed(1)}</i></span>
      </div>
      <div className={`poll-margin ${margin >= 0 ? "dem-text" : "rep-text"}`}>{margin >= 0 ? "D" : "R"}+{Math.abs(margin).toFixed(1)}<small>{poll.endDate.slice(5)}</small></div>
    </article>
  );
}

export function PollsExplorer() {
  const electionContext = useElectionContext();
  const [userPolls, setUserPolls] = useState<Poll[]>([]);
  const [livePolls, setLivePolls] = useState<Poll[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [feedMeta, setFeedMeta] = useState<PollFeed["meta"] | null>(null);
  const [feedSource, setFeedSource] = useState("Connecting to live feed…");
  const [feedError, setFeedError] = useState("");
  const [filter, setFilter] = useState<"All" | Poll["chamber"]>("All");
  const [search, setSearch] = useState("");
  const [population, setPopulation] = useState<"All" | Poll["population"]>("All");
  const [windowDays, setWindowDays] = useState<"30" | "90" | "all">("90");
  const [sort, setSort] = useState<"newest" | "margin" | "sample">("newest");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let timer = 0;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) timer = window.setTimeout(() => setUserPolls(JSON.parse(saved) as Poll[]), 0);
    } catch { /* local preferences are optional */ }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/polls/live").then((response) => {
      if (!response.ok) throw new Error("Polling feed unavailable");
      return response.json() as Promise<PollFeed>;
    }).then((payload) => {
      if (cancelled) return;
      setLivePolls(payload.polls);
      setTrend(payload.trend);
      setFeedMeta(payload.meta);
      setFeedSource(payload.source);
    }).catch(() => { if (!cancelled) setFeedError("Live feed unavailable; showing the dated local snapshot."); });
    return () => { cancelled = true; };
  }, []);

  const polls = useMemo(() => {
    const sourcePolls = [...userPolls, ...(livePolls.length ? livePolls : seedPolls)];
    const latestDate = Math.max(0, ...sourcePolls.map((poll) => Date.parse(poll.endDate)));
    const cutoff = windowDays === "all" ? 0 : latestDate - Number(windowDays) * 86400000;
    const contextChamber = electionContext.chamber === "all" ? null : electionContext.chamber === "house" ? "House" : "Senate";
    return sourcePolls
      .filter((poll) => (filter === "All" || poll.chamber === filter) && (!contextChamber || poll.chamber === contextChamber || poll.chamber === "Generic") && (population === "All" || poll.population === population) && (!search || `${poll.pollster} ${poll.race} ${poll.state}`.toLowerCase().includes(search.toLowerCase())) && Date.parse(poll.endDate) >= cutoff)
      .sort((a, b) => sort === "margin" ? Math.abs((b.dem - b.rep)) - Math.abs((a.dem - a.rep)) : sort === "sample" ? b.sample - a.sample : b.endDate.localeCompare(a.endDate));
  }, [electionContext.chamber, filter, livePolls, population, search, sort, userPolls, windowDays]);

  function addPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const dem = Number(form.get("dem"));
    const rep = Number(form.get("rep"));
    const race = String(form.get("race") || "").trim();
    const pollster = String(form.get("pollster") || "").trim();
    if (!race || !pollster || !Number.isFinite(dem) || !Number.isFinite(rep) || dem < 0 || rep < 0 || dem + rep > 100) {
      setNotice("Check the pollster, race and vote shares.");
      return;
    }
    const next: Poll = {
      id: `local-${Date.now()}`,
      pollster,
      race,
      state: String(form.get("state") || "US").toUpperCase().slice(0, 2),
      chamber: String(form.get("chamber")) as Poll["chamber"],
      dem,
      rep,
      sample: Number(form.get("sample")) || 0,
      population: String(form.get("population")) as Poll["population"],
      endDate: String(form.get("endDate")),
      source: "User entry",
    };
    const updated = [next, ...userPolls];
    setUserPolls(updated);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    event.currentTarget.reset();
    setNotice("Poll added to this device.");
  }

  return (
    <>
      <section className="page-intro">
        <div><p className="eyebrow">2026 POLLING</p><h1>Polling tracker</h1><p>Individual toplines, national trend and locally saved research entries, with source and field dates attached.</p></div>
        <div className="stat-stamp"><strong>{feedMeta?.n_polls.toLocaleString() || seedPolls.length + userPolls.length}</strong><span>polls indexed</span><small>{feedMeta ? `${feedSource} · through ${feedMeta.latest_field_end}` : feedError || feedSource}</small></div>
      </section>

      <section className="split-grid map-grid">
        <article className="panel map-panel"><div className="panel-head"><div><p className="eyebrow">BATTLEGROUND MAP</p><h2>Latest margin signal</h2></div><span className="panel-tag">D ↔ R</span></div><StateTileMap values={pollMapMargins} label="Latest polling margin by battleground state" /><p className="chart-note">Tiles without a current benchmark remain neutral. Hover a state for its margin.</p></article>
        <article className="panel trend-panel"><div className="panel-head"><div><p className="eyebrow">GENERIC BALLOT</p><h2>Weekly movement</h2></div>{trend.at(-1) && <span className={`big-signal ${trend.at(-1)!.margin >= 0 ? "dem-text" : "rep-text"}`}>{trend.at(-1)!.margin >= 0 ? "D" : "R"}+{Math.abs(trend.at(-1)!.margin).toFixed(1)}</span>}</div><PollingTrend values={trend} /></article>
      </section>

      <section className="split-grid polls-workbench">
        <article className="panel poll-list-panel">
          <div className="panel-head"><div><p className="eyebrow">POLL FEED</p><h2>Latest toplines</h2></div><div className="segmented">{(["All", "Generic", "Senate", "House"] as const).map((item) => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div></div>
          <div className="poll-filter-grid"><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pollster, race or state" /></label><label>Population<select value={population} onChange={(event) => setPopulation(event.target.value as typeof population)}><option>All</option><option>LV</option><option>RV</option><option>A</option></select></label><label>Period<select value={windowDays} onChange={(event) => setWindowDays(event.target.value as typeof windowDays)}><option value="30">30 days</option><option value="90">90 days</option><option value="all">Full cycle</option></select></label><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest</option><option value="margin">Largest margin</option><option value="sample">Sample size</option></select></label></div>
          <p className="filter-summary">Showing {polls.length} records · global context: {electionContext.chamber === "all" ? "all chambers" : electionContext.chamber}</p>
          <div className="poll-list">{polls.map((poll) => <PollRow key={poll.id} poll={poll} />)}</div>
        </article>
        <aside className="panel add-poll-panel">
          <p className="eyebrow">LOCAL RESEARCH QUEUE</p><h2>Add a poll</h2><p>Entries stay in this browser for now. A shared database and review workflow come next.</p>
          <form onSubmit={addPoll} className="data-form">
            <label>Pollster<input name="pollster" required placeholder="Pollster name" /></label>
            <label>Race<input name="race" required placeholder="e.g. Maine Senate" /></label>
            <div className="form-row"><label>State<input name="state" defaultValue="US" maxLength={2} /></label><label>Chamber<select name="chamber" defaultValue="Senate"><option>Generic</option><option>House</option><option>Senate</option></select></label></div>
            <div className="form-row"><label>Dem %<input name="dem" type="number" step="0.1" min="0" max="100" required /></label><label>Rep %<input name="rep" type="number" step="0.1" min="0" max="100" required /></label></div>
            <div className="form-row"><label>Sample<input name="sample" type="number" min="0" /></label><label>Population<select name="population"><option>LV</option><option>RV</option><option>A</option></select></label></div>
            <label>Field end<input name="endDate" type="date" defaultValue="2026-09-19" required /></label>
            <button className="primary-action" type="submit">Add poll</button>{notice && <p className="form-notice" role="status">{notice}</p>}
          </form>
        </aside>
      </section>
    </>
  );
}
