"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { stateByCode, stateFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { parseRaceSlug } from "@/lib/races";

type DistrictProperties = { GEOID: string; STATEFP: string; CD119FP: string; NAMELSAD: string };
type DistrictCollection = FeatureCollection<Geometry, DistrictProperties>;
type Candidate = { id: string; name: string; party: string; partyName: string; status: string; committee: { id: string; name: string } | null; finance: { receipts: number; disbursements: number; cashOnHand: number; debt: number; individualContributions: number; through: string | null } | null; profileUrl: string };
type Poll = { id: string; pollster: string; race: string; state?: string; dem: number; rep: number; endDate: string; population: string; source: string };

function displayName(value: string) {
  const [last, ...rest] = value.split(",");
  const name = [...rest, last].join(" ").trim().toLowerCase();
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }

function RaceMiniMap({ geography, race }: { geography: DistrictCollection; race: ForecastRace }) {
  const features = geography.features.filter((feature) => feature.properties.STATEFP === stateFips[race.state]);
  const collection: FeatureCollection<Geometry, DistrictProperties> = { type: "FeatureCollection", features };
  const projection = geoAlbersUsa().fitExtent([[12, 12], [508, 298]], collection);
  const draw = geoPath(projection);
  return <svg viewBox="0 0 520 310" role="img" aria-label={`${race.state} congressional geography`}>{features.map((feature) => {
    const code = `${race.state}-${feature.properties.CD119FP}`;
    const active = race.chamber === "senate" || code === race.code;
    return <path key={feature.properties.GEOID} d={draw(feature) || ""} className={active ? (race.leader === "D" ? "active dem" : "active rep") : ""} />;
  })}</svg>;
}

export function RaceProfile({ slug }: { slug: string }) {
  const parsed = useMemo(() => parseRaceSlug(slug), [slug]);
  const [race, setRace] = useState<ForecastRace | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [geography, setGeography] = useState<DistrictCollection | null>(null);
  const [loading, setLoading] = useState(Boolean(parsed));

  useEffect(() => {
    if (!parsed) return;
    const controller = new AbortController();
    const district = parsed.chamber === "house" ? parsed.code.slice(3) : "";
    Promise.all([
      fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<{ races: ForecastRace[] }>),
      fetch(`/api/candidates?state=${parsed.state}&office=${parsed.chamber === "house" ? "H" : "S"}${district ? `&district=${district}` : ""}`, { signal: controller.signal }).then((response) => response.json() as Promise<{ candidates: Candidate[] }>),
      fetch("/api/polls/live", { signal: controller.signal }).then((response) => response.json() as Promise<{ polls: Poll[] }>),
      fetch("/data/congressional-districts-119.geojson", { signal: controller.signal }).then((response) => response.json() as Promise<DistrictCollection>),
    ]).then(([model, fec, pollFeed, geo]) => {
      setRace(model.races.find((item) => item.chamber === parsed.chamber && item.code === parsed.code) || null);
      setCandidates(fec.candidates || []);
      setPolls(pollFeed.polls || []);
      setGeography(geo);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => controller.abort();
  }, [parsed, slug]);

  const relevantPolls = useMemo(() => polls.filter((poll) => poll.state === parsed?.state || poll.race === "Generic ballot").slice(0, 8), [parsed?.state, polls]);
  if (loading) return <section className="panel model-loading">Assembling model, FEC and Census data…</section>;
  if (!parsed || !race) return <section className="panel race-not-found"><p className="eyebrow">RACE NOT FOUND</p><h1>No modeled race matches this URL.</h1><Link href="/races">Return to race directory →</Link></section>;
  const stateName = stateByCode.get(race.state)?.name || race.state;
  const title = race.chamber === "senate" ? `${stateName} Senate` : `${stateName} ${race.code.slice(3)}`;

  return <>
    <nav className="race-breadcrumb" aria-label="Breadcrumb"><Link href="/races">All races</Link><span>/</span><Link href={`/states/${race.state.toLowerCase()}`}>{stateName}</Link><span>/</span><b>{race.chamber === "house" ? race.code : "Senate"}</b></nav>
    <section className="race-profile-head"><div><p className="eyebrow">{race.chamber === "house" ? "U.S. HOUSE" : "U.S. SENATE"} · 2026 GENERAL ELECTION</p><h1>{title}</h1><div className="race-profile-tags"><span>{race.rating}</span>{race.special && <span>Special election</span>}<span>{race.pollCount ?? 0} race polls in benchmark</span></div></div><div className={`race-callout ${race.leader === "D" ? "dem" : "rep"}`}><span>MODEL LEAD</span><strong>{race.leader}+{race.margin.toFixed(1)}</strong><small>{race.winProbability}% win probability</small></div></section>
    <section className="race-profile-grid">
      <div className="race-profile-main">
        <article className="panel race-benchmark"><div className="panel-head"><div><p className="eyebrow">FORECAST SNAPSHOT</p><h2>Projected two-party vote</h2></div><span className="panel-tag">MP-26 v0.1</span></div><div className="race-share"><span className="dem" style={{ width: `${race.demVote || 50}%` }}><b>D {race.demVote?.toFixed(1) || "—"}%</b></span><span className="rep" style={{ width: `${race.repVote || 50}%` }}><b>R {race.repVote?.toFixed(1) || "—"}%</b></span></div><div className="race-metric-grid"><div><span>Win probability</span><strong>{race.winProbability}% {race.leader}</strong></div><div><span>Close-race probability</span><strong>{race.closeProbability}%</strong></div><div><span>2024 baseline</span><strong>{race.baselineDem !== null && race.baselineRep !== null ? `${race.baselineDem > race.baselineRep ? "D" : "R"}+${Math.abs(race.baselineDem - race.baselineRep).toFixed(1)}` : "—"}</strong></div><div><span>Rating</span><strong>{race.rating}</strong></div></div></article>
        <article className="panel candidate-panel"><div className="panel-head"><div><p className="eyebrow">FEC FILINGS</p><h2>Filed candidates</h2></div><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer">Federal Election Commission ↗</a></div><div className="candidate-list">{candidates.map((candidate) => <a key={candidate.id} href={candidate.profileUrl} target="_blank" rel="noreferrer" className={`candidate-row party-${candidate.party.toLowerCase()}`}><div className="candidate-party">{candidate.party}</div><div><strong>{displayName(candidate.name)}</strong><span>{candidate.status}{candidate.committee ? ` · ${candidate.committee.name}` : ""}</span></div><dl><div><dt>Raised</dt><dd>{candidate.finance ? money(candidate.finance.receipts) : "—"}</dd></div><div><dt>Cash</dt><dd>{candidate.finance ? money(candidate.finance.cashOnHand) : "—"}</dd></div><div><dt>Spent</dt><dd>{candidate.finance ? money(candidate.finance.disbursements) : "—"}</dd></div></dl><em>FEC ↗</em></a>)}{candidates.length === 0 && <p className="table-empty">The FEC feed is temporarily unavailable or has no active filed candidates for this race.</p>}</div><p className="chart-note">Candidate status and finance totals are official FEC filings, not endorsements. Financial coverage dates vary by committee.</p></article>
        <article className="panel race-polls"><div className="panel-head"><div><p className="eyebrow">POLLING CONTEXT</p><h2>Latest usable signals</h2></div><Link href="/polls">All polls →</Link></div><div className="profile-poll-list">{relevantPolls.map((poll) => <a key={poll.id} href={poll.source} target="_blank" rel="noreferrer"><span><strong>{poll.pollster}</strong><small>{poll.race} · {poll.population} · {poll.endDate}</small></span><b className={poll.dem >= poll.rep ? "dem-text" : "rep-text"}>{poll.dem >= poll.rep ? "D" : "R"}+{Math.abs(poll.dem - poll.rep).toFixed(1)}</b></a>)}{relevantPolls.length === 0 && <p className="table-empty">No verified public poll is attached to this profile yet.</p>}</div></article>
      </div>
      <aside className="race-profile-side">
        <article className="panel race-geo"><div className="panel-head"><div><p className="eyebrow">GEOGRAPHY</p><h2>{race.chamber === "house" ? race.code : stateName}</h2></div></div>{geography && <RaceMiniMap geography={geography} race={race} />}<Link href={`/districts?state=${race.state}`}>Open in district map →</Link></article>
        <article className="panel profile-sources"><p className="eyebrow">SOURCE LEDGER</p><h2>What this page uses</h2><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><span>Forecast benchmark</span><b>Vote-Scope ↗</b></a><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer"><span>Candidates + finance</span><b>FEC ↗</b></a><a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><span>District boundary</span><b>Census ↗</b></a><Link href="/methodology"><span>Model assumptions</span><b>Methodology →</b></Link></article>
        <article className="panel market-availability"><p className="eyebrow">PREDICTION MARKETS</p><h2>Verified markets only</h2><p>No district-level contract is attached unless it resolves to this exact race. National House and Senate control markets remain available in the markets dashboard.</p><Link href="/markets">Open markets →</Link></article>
      </aside>
    </section>
  </>;
}
