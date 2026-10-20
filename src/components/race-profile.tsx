"use client";

import "@/app/motion-b.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/i18n/link";
import { geoAlbersUsa, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { stateByCode, stateFips } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { parseRaceSlug, raceSlug } from "@/lib/races";
import { consensus } from "@/lib/expert-ratings";

const tone = (score: number) => (score >= .25 ? "dem-text" : score <= -.25 ? "rep-text" : "toss-text");
import { RaceDemographics } from "@/components/race/race-demographics";
import { RaceExperts } from "@/components/race/race-experts";
import { RaceNominees } from "@/components/candidates/race-nominees";
import { RaceHistory } from "@/components/race/race-history";
import { RaceSignals } from "@/components/race/race-signals";
import { RaceReadingsView } from "@/components/readings/readings";
import type { RaceReadings } from "@/lib/readings-shared";
import { ShareImageButton } from "@/components/share-image-button";
import { useIntlLocale, useLocalePath, useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";

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
  const router = useRouter();
  const localize = useLocalePath();
  const [hovered, setHovered] = useState("");
  const { features, draw } = useMemo(() => {
    const list = geography.features.filter((feature) => feature.properties.STATEFP === stateFips[race.state]);
    const collection: FeatureCollection<Geometry, DistrictProperties> = { type: "FeatureCollection", features: list };
    return { features: list, draw: geoPath(geoAlbersUsa().fitExtent([[12, 12], [508, 298]], collection)) };
  }, [geography, race.state]);
  const house = race.chamber === "house";
  const open = (code: string) => { if (house && code !== race.code) router.push(localize(`/races/${code.toLowerCase()}`)); };
  return <div className="race-mini-map">
    <svg viewBox="0 0 520 310" role="img" aria-label={t("{state} congressional geography", { state: race.state })} onPointerLeave={() => setHovered("")}>{features.map((feature, index) => {
      const code = `${race.state}-${feature.properties.CD119FP}`;
      const active = !house || code === race.code;
      return <path
        key={feature.properties.GEOID}
        d={draw(feature) || ""}
        style={{ "--i": index } as React.CSSProperties}
        className={`${active ? (race.leader === "D" ? "active dem" : "active rep") : ""}${hovered === code ? " peek" : ""}`}
        onPointerEnter={() => setHovered(code)}
        onClick={() => open(code)}
      />;
    })}</svg>
    {house && <span className={`race-mini-label${hovered ? " show" : ""}`} aria-hidden="true">{hovered && hovered !== race.code ? t("{code} · open race →", { code: hovered }) : race.code}</span>}
  </div>;
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
  const [readings, setReadings] = useState<RaceReadings | null>(null);

  // The four readings load on their own: markets and polls should not hold up the page.
  useEffect(() => {
    if (!parsed) return;
    const controller = new AbortController();
    fetch(`/api/readings?race=${parsed.chamber}:${parsed.code}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<RaceReadings> : null)
      .then(setReadings).catch(() => undefined);
    return () => controller.abort();
  }, [parsed]);

  useEffect(() => {
    if (!parsed) return;
    const controller = new AbortController();
    const district = parsed.chamber === "house" ? parsed.code.slice(3) : "";
    Promise.all([
      fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<{ races: ForecastRace[]; house: { demMajority: number } }>),
      fetch(`/api/candidates?state=${parsed.state}&office=${parsed.chamber === "house" ? "H" : "S"}${district ? `&district=${district}` : ""}`, { signal: controller.signal }).then((response) => response.json() as Promise<{ candidates: Candidate[] }>),
      fetch("/data/congressional-districts-2026.geojson", { signal: controller.signal }).then((response) => response.json() as Promise<DistrictCollection>),
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
  const newLines = race.baselineKind === "pres-new-lines";
  const agreed = consensus(race);

  return <>
    <nav className="race-breadcrumb" aria-label={t("Breadcrumb")}><Link href="/races">{t("All races")}</Link><span>/</span><Link href={`/states/${race.state.toLowerCase()}`}>{stateName}</Link><span>/</span><b>{race.chamber === "house" ? race.code : t("Senate")}</b></nav>
    <section className="race-profile-head"><div><p className="eyebrow">{race.chamber === "house" ? t("U.S. HOUSE") : t("U.S. SENATE")} · {t("2026 GENERAL ELECTION")}</p><h1>{title}</h1><div className="race-profile-tags">{agreed && <span className={tone(agreed.score)}>{t("Rating: {label}", { label: t(agreed.label) })}</span>}{race.baselineMargin !== null && <span>{t("2024: {lean}", { lean: `${race.baselineMargin >= 0 ? "D" : "R"}+${Math.abs(race.baselineMargin).toFixed(1)}` })}</span>}{race.special && <span>{t("Special election")}</span>}</div><ShareImageButton href={`/api/share/race/${raceSlug(race)}`} /></div>{readings?.polls
      ? <div className={`race-callout ${readings.polls.margin >= 0 ? "dem" : "rep"}`}><span>{t("POLLING AVERAGE")}</span><strong>{readings.polls.margin >= 0 ? readings.side : "R"}+<CountUp value={Math.abs(readings.polls.margin)} decimals={1} duration={1100} /></strong><small>{t("{n} polls, latest {date}", { n: readings.polls.polls, date: new Date(`${readings.polls.latest}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) })}</small></div>
      : <div className={`race-callout ${(agreed?.score ?? 0) >= 0 ? "dem" : "rep"}`}><span>{t("EXPERT RATING")}</span><strong className="race-callout-rating">{agreed ? t(agreed.label) : "—"}</strong><small>{readings ? t("No public polls of this race") : "…"}</small></div>}</section>
    <section className="panel race-readings">
      <div className="panel-head"><div><p className="eyebrow">{t("FOUR READINGS")}</p><h2>{t("What the polls, the markets and the two models say")}</h2></div></div>
      {readings ? <RaceReadingsView readings={readings} variant="panel" /> : <div className="race-readings-wait" aria-busy="true" />}
    </section>
    <RaceSignals race={race} houseMajority={houseMajority} census={readings?.census?.margin ?? null} />
    <section className="race-profile-grid">
      <div className="race-profile-main">
        
        <RaceExperts race={race} />
        <RaceNominees chamber={race.chamber} code={race.code} />
        <article className="panel candidate-panel"><div className="panel-head"><div><p className="eyebrow">{t("FEC FILINGS")}</p><h2>{t("Filed candidates")}</h2></div><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer">{t("Federal Election Commission ↗")}</a></div><div className="candidate-list">{candidates.map((candidate) => <a key={candidate.id} href={candidate.profileUrl} target="_blank" rel="noreferrer" className={`candidate-row party-${candidate.party.toLowerCase()}`}><div className="candidate-party">{candidate.party}</div><div><strong>{displayName(candidate.name)}</strong><span>{t(candidate.status)}{candidate.committee ? ` · ${candidate.committee.name}` : ""}</span></div><dl><div><dt>{t("Raised")}</dt><dd>{candidate.finance ? money(candidate.finance.receipts, intl) : "—"}</dd></div><div><dt>{t("Cash")}</dt><dd>{candidate.finance ? money(candidate.finance.cashOnHand, intl) : "—"}</dd></div><div><dt>{t("Spent")}</dt><dd>{candidate.finance ? money(candidate.finance.disbursements, intl) : "—"}</dd></div></dl><em>FEC ↗</em></a>)}{candidates.length === 0 && <p className="table-empty">{t("The FEC feed is temporarily unavailable or has no active filed candidates for this race.")}</p>}</div><p className="chart-note">{t("Candidate status and finance totals are official FEC filings, not endorsements. Financial coverage dates vary by committee.")}</p></article>
      </div>
      <aside className="race-profile-side">
        <article className="panel race-geo"><div className="panel-head"><div><p className="eyebrow">{t("GEOGRAPHY")}</p><h2>{race.chamber === "house" ? race.code : stateName}</h2></div></div>{geography && <RaceMiniMap geography={geography} race={race} />}<Link href={`/races?view=map&state=${race.state}`}>{t("Open in district map →")}</Link></article>
        <article className="panel profile-sources"><p className="eyebrow">{t("SOURCE LEDGER")}</p><h2>{t("What this page uses")}</h2><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><span>{t("Forecast benchmark")}</span><b>Vote-Scope ↗</b></a><a href="https://en.wikipedia.org/wiki/2026_United_States_House_of_Representatives_election_ratings" target="_blank" rel="noreferrer"><span>{t("Expert ratings")}</span><b>Cook · IE · Sabato ↗</b></a><a href="https://www.fec.gov/data/candidates/" target="_blank" rel="noreferrer"><span>{t("Candidates + finance")}</span><b>FEC ↗</b></a>{newLines ? <a href="https://www2.census.gov/geo/tiger/TIGER2026/CD/" target="_blank" rel="noreferrer"><span>{t("District boundary (2026 map)")}</span><b>{t("Census TIGER 2026 ↗")}</b></a> : <a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><span>{t("District boundary")}</span><b>{t("Census ↗")}</b></a>}{newLines && <a href="https://www.the-downballot.com/p/the-downballots-calculations-of-presidential" target="_blank" rel="noreferrer"><span>{t("2024 presidential, new lines")}</span><b>The Downballot ↗</b></a>}<a href="https://github.com/fivethirtyeight/election-results" target="_blank" rel="noreferrer"><span>{t("Election history")}</span><b>538 · MIT ↗</b></a><a href="https://polymarket.com" target="_blank" rel="noreferrer"><span>{t("Prediction markets")}</span><b>Polymarket ↗</b></a><a href="https://censusreporter.org" target="_blank" rel="noreferrer"><span>{t("Demographics")}</span><b>{t("Census ACS ↗")}</b></a><Link href="/how-it-works"><span>{t("Model assumptions")}</span><b>{t("How it works →")}</b></Link></article>
      </aside>
    </section>
    <section className="race-deep">
      <RaceHistory race={race} />
      <RaceDemographics race={race} />
    </section>
  </>;
}
