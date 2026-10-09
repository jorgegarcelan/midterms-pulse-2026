"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { stateByCode, stateFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { MODEL_VERSION } from "@/lib/mp26";
import { parseRaceSlug, raceSlug } from "@/lib/races";
import { RaceDemographics } from "@/components/race/race-demographics";
import { RaceExperts } from "@/components/race/race-experts";
import { RaceHistory } from "@/components/race/race-history";
import { RaceSignals } from "@/components/race/race-signals";
import { ShareImageButton } from "@/components/share-image-button";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

type DistrictProperties = { GEOID: string; STATEFP: string; CD119FP: string; NAMELSAD: string };
type DistrictCollection = FeatureCollection<Geometry, DistrictProperties>;
type Candidate = { id: string; name: string; party: string; partyName: string; status: string; committee: { id: string; name: string } | null; finance: { receipts: number; disbursements: number; cashOnHand: number; debt: number; individualContributions: number; through: string | null } | null; profileUrl: string };

function displayName(value: string) {
  const [last, ...rest] = value.split(",");
  const name = [...rest, last].join(" ").trim().toLowerCase();
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function money(value: number, locale: string) { return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value); }

function RaceMiniMap({ geography, race }: { geography: DistrictCollection; race: ForecastRace }) {
  const t = useT();
  const features = geography.features.filter((feature) => feature.properties.STATEFP === stateFips[race.state]);
  const collection: FeatureCollection<Geometry, DistrictProperties> = { type: "FeatureCollection", features };
  const projection = geoAlbersUsa().fitExtent([[12, 12], [508, 298]], collection);
  const draw = geoPath(projection);
  return <svg viewBox="0 0 520 310" role="img" aria-label={t("{state} congressional geography", { state: race.state })}>{features.map((feature) => {
    const code = `${race.state}-${feature.properties.CD119FP}`;
    const active = race.chamber === "senate" || code === race.code;
    return <path key={feature.properties.GEOID} d={draw(feature) || ""} className={active ? (race.leader === "D" ? "active dem" : "active rep") : ""} />;
  })}</svg>;
}

export function RaceProfile({ slug }: { slug: string }) {
  const t = useT();
  const intl = useIntlLocale();
  const parsed = useMemo(() => parseRaceSlug(slug), [slug]);
  const [race, setRace] = useState<ForecastRace | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [houseMajority, setHouseMajority] = useState<number | undefined>();
  const [geography, setGeography] = useState<DistrictCollection | null>(null);
  const [loading, setLoading] = useState(Boolean(parsed));

  useEffect(() => {
    if (!parsed) return;
    const controller = new AbortController();
    const district = parsed.chamber === "house" ? parsed.code.slice(3) : "";
    Promise.all([
      fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<{ races: ForecastRace[]; house: { demMajority: number } }>),
      fetch(`/api/candidates?state=${parsed.state}&office=${parsed.chamber === "house" ? "H" : "S"}${district ? `&district=${district}` : ""}`, { signal: controller.signal }).then((response) => response.json() as Promise<{ candidates: Candidate[] }>),
      fetch("/data/congressional-districts-119.geojson", { signal: controller.signal }).then((response) => response.json() as Promise<DistrictCollection>),
    ]).then(([model, fec, geo]) => {
      setRace(model.races.find((item) => item.chamber === parsed.chamber && item.code === parsed.code) || null);
      setCandidates(fec.candidates || []);
      setHouseMajority(model.house?.demMajority);
      setGeography(geo);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => controller.abort();
  }, [parsed, slug]);

  if (loading) return <section className="panel model-loading">{t("Assembling model, FEC and Census data…")}</section>;
  if (!parsed || !race) return <section className="panel race-not-found"><p className="eyebrow">{t("RACE NOT FOUND")}</p><h1>{t("No modeled race matches this URL.")}</h1><Link href="/races">{t("Return to race directory →")}</Link></section>;
  const stateName = t(stateByCode.get(race.state)?.name || race.state);
  const title = race.chamber === "senate" ? t("{state} Senate", { state: stateName }) : race.code.endsWith("-00") ? t("{state} at-large", { state: stateName }) : t("{state} {district}", { state: stateName, district: race.code.slice(3) });

  return <>
    <nav className="race-breadcrumb" aria-label={t("Breadcrumb")}><Link href="/races">{t("All races")}</Link><span>/</span><Link href={`/states/${race.state.toLowerCase()}`}>{stateName}</Link><span>/</span><b>{race.chamber === "house" ? race.code : t("Senate")}</b></nav>
    <section className="race-profile-head"><div><p className="eyebrow">{race.chamber === "house" ? t("U.S. HOUSE") : t("U.S. SENATE")} · {t("2026 GENERAL ELECTION")}</p><h1>{title}</h1><div className="race-profile-tags"><span>{t(race.rating)}</span>{race.special && <span>{t("Special election")}</span>}<span>{t("{count} race polls in benchmark", { count: race.pollCount ?? 0 })}</span></div><ShareImageButton href={`/api/share/race/${raceSlug(race)}`} /></div><div className={`race-callout ${race.leader === "D" ? "dem" : "rep"}`}><span>{t("MODEL LEAD")}</span><strong>{race.leader}+{race.margin.toFixed(1)}</strong><small>{t("{probability}% win probability", { probability: race.winProbability })}</small></div></section>
    <section className="race-profile-grid">
      <div className="race-profile-main">
        <article className="panel race-benchmark"><div className="panel-head"><div><p className="eyebrow">{t("FORECAST SNAPSHOT")}</p><h2>{t("Projected two-party vote")}</h2></div><span className="panel-tag">{MODEL_VERSION}</span></div><div className="race-share"><span className="dem" style={{ width: `${race.demVote || 50}%` }}><b>D {race.demVote?.toFixed(1) || "—"}%</b></span><span className="rep" style={{ width: `${race.repVote || 50}%` }}><b>R {race.repVote?.toFixed(1) || "—"}%</b></span></div><div className="race-metric-grid"><div><span>{t("Win probability")}</span><strong>{race.winProbability}% {race.leader}</strong></div><div><span>{t("Close-race probability")}</span><strong>{race.closeProbability}%</strong></div><div><span>{t("2024 baseline")}</span><strong>{race.baselineDem !== null && race.baselineRep !== null ? `${race.baselineDem > race.baselineRep ? "D" : "R"}+${Math.abs(race.baselineDem - race.baselineRep).toFixed(1)}` : "—"}</strong></div><div><span>{t("Rating")}</span><strong>{t(race.rating)}</strong></div></div></article>
        <RaceExperts race={race} />
        <article className="panel candidate-panel"><div className="panel-head"><div><p className="eyebrow">{t("FEC FILINGS")}</p><h2>{t("Filed candidates")}</h2></div><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer">{t("Federal Election Commission ↗")}</a></div><div className="candidate-list">{candidates.map((candidate) => <a key={candidate.id} href={candidate.profileUrl} target="_blank" rel="noreferrer" className={`candidate-row party-${candidate.party.toLowerCase()}`}><div className="candidate-party">{candidate.party}</div><div><strong>{displayName(candidate.name)}</strong><span>{t(candidate.status)}{candidate.committee ? ` · ${candidate.committee.name}` : ""}</span></div><dl><div><dt>{t("Raised")}</dt><dd>{candidate.finance ? money(candidate.finance.receipts, intl) : "—"}</dd></div><div><dt>{t("Cash")}</dt><dd>{candidate.finance ? money(candidate.finance.cashOnHand, intl) : "—"}</dd></div><div><dt>{t("Spent")}</dt><dd>{candidate.finance ? money(candidate.finance.disbursements, intl) : "—"}</dd></div></dl><em>FEC ↗</em></a>)}{candidates.length === 0 && <p className="table-empty">{t("The FEC feed is temporarily unavailable or has no active filed candidates for this race.")}</p>}</div><p className="chart-note">{t("Candidate status and finance totals are official FEC filings, not endorsements. Financial coverage dates vary by committee.")}</p></article>
      </div>
      <aside className="race-profile-side">
        <article className="panel race-geo"><div className="panel-head"><div><p className="eyebrow">{t("GEOGRAPHY")}</p><h2>{race.chamber === "house" ? race.code : stateName}</h2></div></div>{geography && <RaceMiniMap geography={geography} race={race} />}<Link href={`/districts?state=${race.state}`}>{t("Open in district map →")}</Link></article>
        <article className="panel profile-sources"><p className="eyebrow">{t("SOURCE LEDGER")}</p><h2>{t("What this page uses")}</h2><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><span>{t("Forecast benchmark")}</span><b>Vote-Scope ↗</b></a><a href="https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_election_ratings" target="_blank" rel="noreferrer"><span>{t("Expert ratings")}</span><b>Cook · IE · Sabato ↗</b></a><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer"><span>{t("Candidates + finance")}</span><b>FEC ↗</b></a><a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><span>{t("District boundary")}</span><b>{t("Census ↗")}</b></a><a href="https://github.com/fivethirtyeight/election-results" target="_blank" rel="noreferrer"><span>{t("Election history")}</span><b>538 · MIT ↗</b></a><a href="https://polymarket.com" target="_blank" rel="noreferrer"><span>{t("Prediction markets")}</span><b>Polymarket ↗</b></a><a href="https://censusreporter.org" target="_blank" rel="noreferrer"><span>{t("Demographics")}</span><b>{t("Census ACS ↗")}</b></a><Link href="/how-it-works"><span>{t("Model assumptions")}</span><b>{t("How it works →")}</b></Link></article>
      </aside>
    </section>
    <section className="race-deep">
      <RaceHistory race={race} />
      <RaceSignals race={race} houseMajority={houseMajority} />
      <RaceDemographics race={race} />
    </section>
  </>;
}
