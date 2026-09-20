"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useElectionContext } from "@/components/election-context";
import { SiteFooter } from "@/components/site-footer";
import { stateByCode } from "@/data/geography";
import { electionSnapshot, type Race } from "@/data/election";
import { raceSlug } from "@/lib/races";

const suggestedQuestions = [
  "What is driving the House forecast?",
  "Which Senate race is closest?",
  "How should I read a 62% probability?",
];

type LiveForecast = {
  runDate: string;
  version: string;
  simulations: number;
  house: { demMajority: number; demSeats: number; repSeats: number };
  senate: { demMajority: number; demSeats: number; repSeats: number };
  genericBallot: { dem: number; rep: number; margin: number; effectivePolls: number; latestPoll: string; source: string };
  races: Race[];
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

function PartyBar({ democratic, republican }: { democratic: number; republican: number }) {
  const undecided = Math.max(0, 100 - democratic - republican);
  return (
    <div className="party-bar" aria-label={`${democratic}% Democratic, ${republican}% Republican`}>
      <span className="party-bar-dem" style={{ width: `${democratic}%` }} />
      <span className="party-bar-undecided" style={{ width: `${undecided}%` }} />
      <span className="party-bar-rep" style={{ width: `${republican}%` }} />
    </div>
  );
}

function Sparkline({ currentMargin }: { currentMargin: number }) {
  const values = [...electionSnapshot.genericBallot.history.slice(0, -1), { date: "2026-09-20", margin: currentMargin }];
  const minimum = Math.floor(Math.min(...values.map((item) => item.margin)) - 1);
  const maximum = Math.ceil(Math.max(...values.map((item) => item.margin)) + 1);
  const span = Math.max(1, maximum - minimum);
  const points = values.map((item, index) => {
    const x = (index / (values.length - 1)) * 360;
    const y = 76 - ((item.margin - minimum) / span) * 60;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="sparkline-wrap" aria-label="Democratic generic ballot margin since May">
      <svg viewBox="0 0 360 86" role="img">
        <defs>
          <linearGradient id="line-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#4f8cff" stopOpacity=".34" />
            <stop offset="1" stopColor="#4f8cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M 0,86 L ${points} L 360,86 Z`} fill="url(#line-fill)" />
        <polyline points={points} fill="none" stroke="#73a7ff" strokeWidth="3" />
        {values.map((item, index) => {
          const x = (index / (values.length - 1)) * 360;
          const y = 76 - ((item.margin - minimum) / span) * 60;
          return <circle key={item.date} cx={x} cy={y} r="4" fill="#d9e7ff" stroke="#2467d6" strokeWidth="2" />;
        })}
      </svg>
      <div className="sparkline-axis"><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span></div>
    </div>
  );
}

function RaceRow({ race }: { race: Race }) {
  const isDem = race.leader === "D";
  return (
    <Link className="race-row" href={`/races/${raceSlug(race)}`} aria-label={`${race.state}: ${race.leader} leads by ${race.margin} points`}>
      <span className="race-state"><b>{race.code}</b><span>{race.state}</span></span>
      <span className="race-meter" aria-hidden="true"><i className={isDem ? "dem" : "rep"} style={{ width: `${Math.min(100, race.winProbability)}%` }} /></span>
      <span className={`race-lead ${isDem ? "dem-text" : "rep-text"}`}>{race.leader}+{race.margin.toFixed(1)}</span>
      <span className="race-prob">{race.winProbability}%</span>
      <span className="arrow">↗</span>
    </Link>
  );
}

function getFallbackAnswer(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("senate") || normalized.includes("closest")) {
    return "Iowa is the closest Senate contest in this snapshot: Republicans lead the benchmark by 2.7 points with a 55% win probability. Alaska and Maine remain inside four points, so correlated national movement could change control quickly.";
  }
  if (normalized.includes("62") || normalized.includes("probab")) {
    return "A 62% chance is an edge, not a call. In repeated elections under comparable assumptions, Democrats would win the Senate majority about six times in ten and fail about four times in ten. The uncertainty is concentrated in Iowa, Maine, Texas and Alaska.";
  }
  return "The House signal is being driven by a Democratic generic-ballot advantage of 7.4 points and a public benchmark projecting 231 Democratic seats. The main caveat is district geography: national vote movement does not translate evenly into all 435 seats.";
}

export default function Home() {
  const electionContext = useElectionContext();
  const [chamber, setChamber] = useState<"house" | "senate">("senate");
  const [swing, setSwing] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Ask about the model, a race, or what changed. Every answer is constrained to the current snapshot.");
  const [loading, setLoading] = useState(false);
  const [liveForecast, setLiveForecast] = useState<LiveForecast | null>(null);
  const baselineRaces = liveForecast?.races || electionSnapshot.races;
  const displayedRaces = useMemo(() => baselineRaces.filter((race) => race.chamber === chamber).sort((a, b) => a.margin - b.margin).slice(0, 6), [baselineRaces, chamber]);
  const house = liveForecast?.house || electionSnapshot.house;
  const senate = liveForecast?.senate || electionSnapshot.senate;
  const ballot = liveForecast?.genericBallot || electionSnapshot.genericBallot;
  const houseProbability = Math.max(5, Math.min(99, house.demMajority + swing * 4));
  const senateProbability = Math.max(5, Math.min(95, senate.demMajority + swing * 5));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/model").then((response) => {
      if (!response.ok) throw new Error("Forecast feed unavailable");
      return response.json() as Promise<LiveForecast>;
    }).then((payload) => { if (!cancelled) setLiveForecast(payload); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: "set_national_swing",
      title: "Set national swing",
      description: "Set the visible Scenario Lab national swing from R+5 to D+5 and return the updated control probabilities.",
      inputSchema: { type: "object", properties: { swing: { type: "integer", minimum: -5, maximum: 5 } }, required: ["swing"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = (input as { swing?: unknown })?.swing;
        if (!Number.isInteger(value) || Number(value) < -5 || Number(value) > 5) throw new Error("swing must be an integer from -5 to 5");
        const next = Number(value);
        setSwing(next);
        return {
          swing: next,
          houseDemMajority: Math.max(5, Math.min(99, electionSnapshot.house.demMajority + next * 4)),
          senateDemMajority: Math.max(5, Math.min(95, electionSnapshot.senate.demMajority + next * 5)),
        };
      },
    });

    register({
      name: "select_race_chamber",
      title: "Select race chamber",
      description: "Switch the visible race board between Senate and House contests.",
      inputSchema: { type: "object", properties: { chamber: { type: "string", enum: ["senate", "house"] } }, required: ["chamber"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = (input as { chamber?: unknown })?.chamber;
        if (value !== "senate" && value !== "house") throw new Error("chamber must be senate or house");
        setChamber(value);
        return { chamber: value, visibleRaces: electionSnapshot.races.filter((race) => race.chamber === value).length };
      },
    });

    return () => lifecycle.abort();
  }, []);

  async function askAnalyst(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: { geography: stateByCode.get(electionContext.stateCode)?.name || "United States", cycle: electionContext.cycle, chamber: electionContext.chamber, scenario: { swing } } }),
      });
      if (!response.ok) throw new Error("Analyst unavailable");
      const data = (await response.json()) as { answer: string };
      setAnswer(data.answer);
    } catch {
      setAnswer(getFallbackAnswer(question));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-main">
      <section className="dashboard-shell" id="top">
        <section className="brand-hero">
          <div className="brand-hero-copy">
            <p className="eyebrow">2026 U.S. MIDTERMS · NATIONAL OVERVIEW</p>
            <h1>Congressional outlook</h1>
            <p className="hero-deck">Current chamber forecasts, polling, prediction markets and historical election data.</p>
            <div className="hero-actions"><Link className="primary-action" href="/districts">Explore 435 districts</Link><Link className="secondary-action" href="/model">Inspect the model <span>→</span></Link></div>
          </div>
          <div className="countdown"><strong>{electionSnapshot.daysToElection}</strong><span>days to election</span><small>November 3, 2026</small></div>
        </section>

        <section className="forecast-grid" id="forecast" aria-label="Control forecast">
          <article className="forecast-card house-card">
            <div className="card-kicker"><span>HOUSE</span><small>435 seats</small></div>
            <div className="probability-line"><strong>{houseProbability}%</strong><span>chance of a<br /><b>Democratic majority</b></span></div>
            <div className="seat-line"><b className="dem-text">D {house.demSeats}</b><i>218 TO WIN</i><b className="rep-text">{house.repSeats} R</b></div>
            <PartyBar democratic={house.demSeats / 4.35} republican={house.repSeats / 4.35} />
            <p className="source-note">{liveForecast ? `${liveForecast.version} · ${liveForecast.simulations.toLocaleString("en-US")} simulations · ${liveForecast.runDate}` : "Dated local snapshot"}</p>
          </article>

          <article className="forecast-card senate-card">
            <div className="card-kicker"><span>SENATE</span><small>100 seats</small></div>
            <div className="probability-line"><strong>{senateProbability}%</strong><span>chance of a<br /><b>Democratic majority</b></span></div>
            <div className="seat-line"><b className="dem-text">D {senate.demSeats}</b><i>51 TO WIN</i><b className="rep-text">{senate.repSeats} R</b></div>
            <PartyBar democratic={senate.demSeats} republican={senate.repSeats} />
            <p className="source-note">{liveForecast ? `${liveForecast.version} · ${liveForecast.simulations.toLocaleString("en-US")} simulations · ${liveForecast.runDate}` : "Dated local snapshot"}</p>
          </article>

          <article className="forecast-card ballot-card" id="polls">
            <div className="card-kicker"><span>GENERIC BALLOT</span><small>polling average</small></div>
            <div className="ballot-value"><strong>{ballot.margin >= 0 ? "D" : "R"}+{Math.abs(ballot.margin).toFixed(1)}</strong><span>{liveForecast ? `${liveForecast.genericBallot.effectivePolls} ${liveForecast.genericBallot.effectivePolls === 1 ? "input" : "polls"}` : "dated snapshot"}</span></div>
            <PartyBar democratic={ballot.dem} republican={ballot.rep} />
            <div className="ballot-labels"><b>D {ballot.dem.toFixed(1)}%</b><span>two-party margin</span><b>R {ballot.rep.toFixed(1)}%</b></div>
            <Sparkline currentMargin={ballot.margin} />
          </article>
        </section>

        <section className="workbench-grid">
          <article className="panel races-panel" id="races">
            <div className="panel-head">
              <div><p className="eyebrow">RACE BOARD</p><h2>Closest contests</h2></div>
              <div className="segmented" role="group" aria-label="Choose chamber"><button className={chamber === "senate" ? "selected" : ""} onClick={() => setChamber("senate")}>Senate</button><button className={chamber === "house" ? "selected" : ""} onClick={() => setChamber("house")}>House</button></div>
            </div>
            <div className="race-header"><span>Race</span><span>Model confidence</span><span>Margin</span><span>Win prob.</span><span /></div>
            <div className="race-list">{displayedRaces.map((race) => <RaceRow key={race.code} race={race} />)}</div>
            <Link className="text-button" href="/races">Open complete race directory <span>→</span></Link>
          </article>

          <aside className="panel analyst-panel">
            <div className="analyst-title"><div className="pulse-orb"><span /></div><div><p className="eyebrow">AI ANALYST</p><h2>Ask the election desk</h2></div></div>
            <div className="answer-box"><p>{loading ? "Reading the current snapshot…" : answer}</p><span>Sources: current snapshot · methodology notes</span></div>
            <div className="suggestions">{suggestedQuestions.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)}>{item}</button>)}</div>
            <form onSubmit={askAnalyst}>
              <label className="sr-only" htmlFor="analyst-question">Question for the AI analyst</label>
              <input id="analyst-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a race or the model…" />
              <button aria-label="Ask analyst" disabled={loading}>↗</button>
            </form>
          </aside>
        </section>

        <section className="panel simulator" id="methodology">
          <div><p className="eyebrow">SCENARIO LAB</p><h2>Test a national swing</h2><p>Move the national environment to see how a uniform swing changes the provisional control probabilities. This is a sensitivity test, not a prediction.</p><div className="method-links"><a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noreferrer">House ratings ↗</a><a href="https://vote-scope.com/en/us/senate/" target="_blank" rel="noreferrer">Senate benchmark ↗</a><a href="https://uspollingdata.com/polls/generic-ballot/" target="_blank" rel="noreferrer">Generic ballot ↗</a></div></div>
          <div className="slider-block">
            <div className="slider-labels"><span>R+5</span><strong>{swing === 0 ? "Current baseline" : `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}`}</strong><span>D+5</span></div>
            <input aria-label="National swing" type="range" min="-5" max="5" step="1" value={swing} onChange={(event) => setSwing(Number(event.target.value))} />
            <button type="button" onClick={() => setSwing(0)}>Reset scenario</button>
          </div>
        </section>

        <SiteFooter />
      </section>
    </main>
  );
}
