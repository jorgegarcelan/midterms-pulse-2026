"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { CandidateAvatar } from "@/components/candidates/candidate-avatar";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { modelRatingLabel, RATERS } from "@/lib/expert-ratings";
import { raceName, raceSlug } from "@/lib/races";
import {
  candidateState, demProbability, expertRatings, fecCandidateUrl, fecNameMatches, fecSearchUrl, partyProbability, partyTone, wikipediaUrl,
  type Candidate, type CandidateRace,
} from "@/lib/candidates";
import "./candidates.css";

type FecCandidate = { id: string; name: string; party: string; status: string; finance: { receipts: number; disbursements: number; cashOnHand: number; debt: number; through: string | null } | null; profileUrl: string };
type FecFeed = { candidates: FecCandidate[]; unavailable?: boolean };

const SYSTEM_NOTES: Record<CandidateRace["system"], string | null> = {
  partisan: null,
  "top-two": "Top-two system: the two leading primary finishers advance regardless of party.",
  "top-four": "Alaska's top-four primary sends four candidates to a ranked-choice general election.",
  jungle: "Louisiana cancelled its 2026 House primaries: every candidate runs on 3 November and, if nobody passes 50%, the top two meet in a 12 December runoff.",
};

function money(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function CandidateProfile({ candidate, race, opponents, retrieved, sharedParty }: { candidate: Candidate; race: CandidateRace; opponents: Candidate[]; retrieved: string; sharedParty: boolean }) {
  const t = useT();
  const intl = useIntlLocale();
  const state = candidateState(candidate);
  const stateName = t(stateByCode.get(state)?.name || state);
  const label = raceName({ chamber: candidate.chamber, code: candidate.race, state }, t);
  const raceHref = `/races/${raceSlug({ chamber: candidate.chamber, code: candidate.race })}`;
  const [model, setModel] = useState<ForecastRace | null | undefined>(undefined);
  const [fec, setFec] = useState<{ match: FecCandidate | null; unavailable: boolean } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<{ races: ForecastRace[] }>)
      .then((feed) => setModel(feed.races.find((item) => item.chamber === candidate.chamber && item.code === candidate.race) || null))
      .catch(() => { if (!controller.signal.aborted) setModel(null); });
    const district = candidate.chamber === "house" ? `&district=${candidate.race.slice(3)}` : "";
    fetch(`/api/candidates?state=${state}&office=${candidate.chamber === "house" ? "H" : "S"}${district}`, { signal: controller.signal })
      .then((response) => response.json() as Promise<FecFeed>)
      .then((feed) => {
        // Prefer the FEC id of a sitting member; otherwise match the filing by name.
        // Filings that belong to a rival sitting member (namesakes such as the two Dan Sullivans) are skipped.
        const taken = new Set(opponents.flatMap((item) => item.fecIds));
        const match = feed.candidates.find((item) => candidate.fecIds.includes(item.id))
          || feed.candidates.filter((item) => !taken.has(item.id) && fecNameMatches(item.name, candidate.name)).sort((a, b) => (b.finance?.receipts || 0) - (a.finance?.receipts || 0))[0] || null;
        setFec({ match, unavailable: Boolean(feed.unavailable) });
      })
      .catch(() => { if (!controller.signal.aborted) setFec({ match: null, unavailable: true }); });
    return () => controller.abort();
  }, [candidate.chamber, candidate.fecIds, candidate.name, candidate.race, opponents, state]);

  const chance = model ? partyProbability(candidate, model, sharedParty) : null;
  const book = expertRatings(model || undefined);
  const status = candidate.incumbent ? t("Incumbent") : race.open ? t("Open-seat candidate") : t("Challenger");
  const incumbent = race.incumbents[0];
  const dem = model ? demProbability(model) : null;
  const sittingElsewhere = candidate.currentOffice && !candidate.incumbent;
  const systemNote = SYSTEM_NOTES[race.system];
  const officeFecId = candidate.fecIds.find((id) => id[0] === (candidate.chamber === "house" ? "H" : "S"));
  const fecUrl = fec?.match?.profileUrl || (officeFecId ? fecCandidateUrl(officeFecId) : fecSearchUrl(candidate.name));
  const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" });

  return <>
    <nav className="cand-crumbs" aria-label={t("Breadcrumb")}><Link href="/candidates">{t("Candidates")}</Link><span>/</span><Link href={raceHref}>{label}</Link></nav>
    <header className={`cand-hero ${partyTone(candidate.party)}`}>
      <CandidateAvatar candidate={candidate} size="lg" />
      <div>
        <p className="eyebrow">{candidate.chamber === "senate" ? t("U.S. SENATE") : t("U.S. HOUSE")} · {stateName.toUpperCase()}{race.special ? ` · ${t("SPECIAL ELECTION")}` : ""}</p>
        <h1>{candidate.name}</h1>
        <div className="cand-chips">
          <span className="cand-party chip"><i />{t(candidate.partyLabel)}</span>
          <span className={`chip${candidate.incumbent ? " incumbent" : ""}`}>{status}</span>
          <Link className="chip link" href={raceHref}>{label} →</Link>
          {sittingElsewhere && <span className="chip">{t("Sitting member of Congress ({office})", { office: candidate.currentOffice?.endsWith("Senate") ? t("{code} Senate", { code: candidate.currentOffice.slice(0, 2) }) : candidate.currentOffice || "" })}</span>}
        </div>
        {!candidate.incumbent && incumbent && <p className="cand-sub">{race.open
          ? t("Open seat: {name} ({party}) is not on the ballot.", { name: incumbent.name, party: incumbent.party || "—" })
          : t("Challenging {name} ({party}).", { name: race.incumbents.map((item) => item.name).join(" / "), party: race.incumbents.map((item) => item.party || "—").join("/") })}</p>}
        {!incumbent && race.notes[0] && <p className="cand-sub">{race.notes[0]}</p>}
      </div>
    </header>

    <div className="cand-profile-grid">
      <section className="panel cand-glance">
        <div className="panel-head"><h2>{t("The race at a glance")}</h2><Link className="panel-tag" href={raceHref}>{t("Full race profile →")}</Link></div>
        <div className="cand-kpis">
          <div><small>{candidate.party === "D" && !sharedParty ? t("Democratic win chance") : candidate.party === "R" && !sharedParty ? t("Republican win chance") : t("Win chance")}</small>
            <strong className={partyTone(candidate.party)}>{model === undefined ? "…" : chance !== null ? `${chance}%` : "—"}</strong>
            <span>{model && dem !== null ? (sharedParty ? t("The model forecasts parties, and this ballot has more than one {party} candidate", { party: t(candidate.partyLabel) }) : chance === null ? t("Model tracks Democrats vs Republicans only") : t("MP-26 simulation")) : model === null ? t("Not in the model") : ""}</span></div>
          <div><small>{t("Projected margin")}</small><strong className={model ? (model.leader === "D" ? "dem" : "rep") : ""}>{model ? `${model.leader}+${model.margin.toFixed(1)}` : model === undefined ? "…" : "—"}</strong><span>{model && dem !== null ? t(modelRatingLabel(dem)) : ""}</span></div>
        </div>
        <div className="cand-raters">
          {RATERS.map((rater) => <a key={rater.key} href={rater.url} target="_blank" rel="noreferrer"><small>{rater.short}</small><b className={/D$/.test(book?.[rater.key] || "") ? "dem" : /R$/.test(book?.[rater.key] || "") ? "rep" : ""}>{book?.[rater.key] ? t(book[rater.key] as string) : "—"}</b></a>)}
        </div>
        {systemNote && <p className="cand-note">{t(systemNote)}</p>}
        <h3>{opponents.length ? t("On the same ballot") : t("Running unopposed")}</h3>
        {opponents.length > 0 && <ul className="cand-opponents">{opponents.map((item) => <li key={item.slug} className={partyTone(item.party)}>
          <CandidateAvatar candidate={item} size="sm" />
          <Link href={`/candidates/${item.slug}`}>{item.name}</Link>
          <span className="cand-party"><i />{t(item.partyLabel)}</span>
          {item.incumbent && <span className="chip incumbent">{t("Incumbent")}</span>}
        </li>)}</ul>}
      </section>

      <div className="cand-side">
      <section className="panel cand-finance">
        <div className="panel-head"><h2>{t("Campaign finance")}</h2><span className="panel-tag">FEC · {t("live")}</span></div>
        {!fec && <div className="cand-money skeleton-block" aria-busy="true" />}
        {fec?.match?.finance && <>
          <div className="cand-money">
            <div><small>{t("Raised")}</small><strong>{money(fec.match.finance.receipts, intl)}</strong></div>
            <div><small>{t("Spent")}</small><strong>{money(fec.match.finance.disbursements, intl)}</strong></div>
            <div><small>{t("Cash on hand")}</small><strong>{money(fec.match.finance.cashOnHand, intl)}</strong></div>
          </div>
          <p className="cand-note">{fec.match.finance.through ? t("Reported through {date} · 2025–26 cycle · principal campaign committee.", { date: date(fec.match.finance.through) }) : t("2025–26 cycle · principal campaign committee.")}</p>
        </>}
        {fec?.match && !fec.match.finance && <p className="cand-note">{t("Registered with the FEC as {name}, but no financial report is available yet.", { name: fec.match.name })}</p>}
        {fec && !fec.match && <p className="cand-note">{fec.unavailable ? t("The FEC service is not responding right now. Try again later.") : t("No matching FEC filing found for this candidate. Candidates who raise or spend less than $5,000 do not have to register.")}</p>}
      </section>

      <section className="panel cand-links">
        <div className="panel-head"><h2>{t("Sources and links")}</h2></div>
        <ul>
          <li><Link href={raceHref}>{t("Race profile: polls, history and demographics")}</Link></li>
          {candidate.wikipedia && <li><a href={wikipediaUrl(candidate.wikipedia)} target="_blank" rel="noreferrer">{t("Wikipedia article")} ↗</a></li>}
          <li><a href={fecUrl} target="_blank" rel="noreferrer">{fec?.match || officeFecId ? t("FEC candidate profile") : t("Search the FEC")} ↗</a></li>
          {candidate.bioguide && <li><a href={`https://bioguide.congress.gov/search/bio/${candidate.bioguide}`} target="_blank" rel="noreferrer">{t("Congressional biography")} ↗</a></li>}
        </ul>
        <p className="source-note">{t("Ballot data from Wikipedia's candidate tables, retrieved {date}. Finance from the Federal Election Commission, refreshed every six hours.", { date: date(retrieved) })}</p>
      </section>
      </div>
    </div>
  </>;
}
