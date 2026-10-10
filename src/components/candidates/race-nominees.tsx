"use client";

import { useEffect, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { CandidateAvatar } from "@/components/candidates/candidate-avatar";
import { loadCandidates, partyTone, raceKey, type Candidate, type CandidateRace } from "@/lib/candidates";
import "./candidates.css";

const PARTY_ORDER = ["D", "R", "I", "L", "G", "O"];

/*
  The general-election ballot for one race, from the candidate directory.
  Usage: <RaceNominees chamber="house" code="PA-07" /> or <RaceNominees chamber="senate" code="GA" />.
*/
export function RaceNominees({ chamber, code, title = true }: { chamber: "house" | "senate"; code: string; title?: boolean }) {
  const t = useT();
  const intl = useIntlLocale();
  const [state, setState] = useState<{ race: CandidateRace | null; candidates: Candidate[]; retrieved: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadCandidates().then((data) => {
      if (!active) return;
      const race = data.races[raceKey({ chamber, code })] || null;
      const bySlug = new Map(data.candidates.map((candidate) => [candidate.slug, candidate]));
      const candidates = (race?.candidates || []).flatMap((slug) => bySlug.get(slug) || [])
        .sort((a, b) => PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party) || a.name.localeCompare(b.name));
      setState({ race, candidates, retrieved: data.retrieved });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [chamber, code]);

  if (failed || (state && !state.race)) return null;
  const date = state ? new Date(`${state.retrieved}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" }) : "";
  return <div className="race-nominees">
    {title && <div className="race-nominees-head"><h3>{t("On the ballot")}</h3>{state && <small>{t("Candidate lists retrieved {date}", { date })}</small>}</div>}
    {!state ? <ul aria-busy="true">{[0, 1].map((index) => <li key={index} className="skeleton" />)}</ul>
      : state.candidates.length === 0 ? <p className="cand-note">{t("No general-election candidates listed yet.")}</p>
      : <ul>{state.candidates.map((candidate) => <li key={candidate.slug} className={partyTone(candidate.party)}>
        <CandidateAvatar candidate={candidate} size="sm" />
        <span><Link href={`/candidates/${candidate.slug}`}>{candidate.name}</Link><small className="cand-party"><i />{t(candidate.partyLabel)}</small></span>
        {candidate.incumbent && <span className="chip incumbent">{t("Incumbent")}</span>}
      </li>)}</ul>}
  </div>;
}
