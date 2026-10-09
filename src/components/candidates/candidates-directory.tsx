"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { CandidateAvatar } from "@/components/candidates/candidate-avatar";
import { stateByCode, states } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { raceName, raceSlug } from "@/lib/races";
import {
  candidateState, competitiveness, expertRatings, isCompetitive, loadCandidates, PARTY_NAMES, partyProbability, partyTone, raceKey, sharesParty,
  type Candidate, type CandidateData, type CandidateParty, type CandidateRace,
} from "@/lib/candidates";
import "./candidates.css";

type ModelFeed = { races: ForecastRace[]; runDate: string; version: string };
type Row = { candidate: Candidate; race: CandidateRace; model?: ForecastRace; sharedParty: boolean; search: string };
type Status = "all" | "incumbent" | "challenger" | "open";
type Sort = "competitive" | "state" | "name";

const PAGE = 48;
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CandidatesDirectory() {
  const t = useT();
  const intl = useIntlLocale();
  const params = useSearchParams();
  const [data, setData] = useState<CandidateData | null>(null);
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(params.get("q") || "");
  const [chamber, setChamber] = useState(params.get("chamber") || "all");
  const [party, setParty] = useState(params.get("party") || "all");
  const [state, setState] = useState(params.get("state") || "all");
  const [status, setStatus] = useState<Status>((params.get("status") as Status) || "all");
  const [competitiveOnly, setCompetitiveOnly] = useState(params.get("competitive") === "1");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) || "competitive");
  const [view, setView] = useState<"cards" | "list">(params.get("view") === "list" ? "list" : "cards");
  const [limit, setLimit] = useState(PAGE);
  const search = useDeferredValue(query);

  useEffect(() => {
    const controller = new AbortController();
    loadCandidates().then(setData).catch(() => setFailed(true));
    fetch("/api/model", { signal: controller.signal }).then((response) => response.json() as Promise<ModelFeed>).then(setModel).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Keep the filters in the URL so a filtered view can be shared with the desk.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (chamber !== "all") next.set("chamber", chamber);
    if (party !== "all") next.set("party", party);
    if (state !== "all") next.set("state", state);
    if (status !== "all") next.set("status", status);
    if (competitiveOnly) next.set("competitive", "1");
    if (sort !== "competitive") next.set("sort", sort);
    if (view !== "cards") next.set("view", view);
    const href = `${window.location.pathname}${next.size ? `?${next}` : ""}`;
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [chamber, competitiveOnly, party, query, sort, state, status, view]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const byRace = new Map((model?.races || []).map((race) => [raceKey(race), race]));
    const bySlug = new Map(data.candidates.map((candidate) => [candidate.slug, candidate]));
    return data.candidates.map((candidate) => {
      const race = data.races[raceKey({ chamber: candidate.chamber, code: candidate.race })];
      const code = candidateState(candidate);
      const stateName = stateByCode.get(code)?.name || code;
      const shortCode = candidate.race.replace(/-0(\d)$/, "-$1");
      const names = raceName({ chamber: candidate.chamber, code: candidate.race, state: code }, t);
      return {
        candidate, race, model: byRace.get(raceKey({ chamber: candidate.chamber, code: candidate.race })), sharedParty: sharesParty(candidate, race, bySlug),
        search: fold(`${candidate.name} ${candidate.race} ${shortCode} ${shortCode.replace("-", " ")} ${stateName} ${t(stateName)} ${names} ${candidate.chamber === "senate" ? `${code} senate ${t("Senate")}` : ""}`),
      };
    });
  }, [data, model, t]);

  const filtered = useMemo(() => {
    const needle = fold(search.trim());
    const list = rows.filter(({ candidate, race, model: forecast, search: haystack }) => {
      if (chamber !== "all" && candidate.chamber !== chamber) return false;
      if (party !== "all" && (party === "other" ? ["D", "R", "I"].includes(candidate.party) : candidate.party !== party)) return false;
      if (state !== "all" && candidateState(candidate) !== state) return false;
      if (status === "incumbent" && !candidate.incumbent) return false;
      if (status === "challenger" && (candidate.incumbent || race.open)) return false;
      if (status === "open" && !race.open) return false;
      if (competitiveOnly && !isCompetitive(forecast)) return false;
      return !needle || needle.split(/\s+/).every((word) => haystack.includes(word));
    });
    const partyOrder = (value: CandidateParty) => ["D", "R", "I", "L", "G", "O"].indexOf(value);
    const byRace = (a: Row, b: Row) => a.candidate.chamber.localeCompare(b.candidate.chamber) * -1 || a.candidate.race.localeCompare(b.candidate.race) || partyOrder(a.candidate.party) - partyOrder(b.candidate.party);
    return list.sort((a, b) => {
      if (sort === "name") return surname(a.candidate.name).localeCompare(surname(b.candidate.name), intl) || a.candidate.name.localeCompare(b.candidate.name, intl);
      if (sort === "state") return t(stateByCode.get(candidateState(a.candidate))?.name || "").localeCompare(t(stateByCode.get(candidateState(b.candidate))?.name || ""), intl) || byRace(a, b);
      return competitiveness(a.model) - competitiveness(b.model) || byRace(a, b);
    });
  }, [chamber, competitiveOnly, intl, party, rows, search, sort, state, status, t]);

  const reset = () => { setQuery(""); setChamber("all"); setParty("all"); setState("all"); setStatus("all"); setCompetitiveOnly(false); setSort("competitive"); };
  const filtersKey = [search, chamber, party, state, status, competitiveOnly, sort].join("|");
  const [shownKey, setShownKey] = useState(filtersKey);
  if (shownKey !== filtersKey) { setShownKey(filtersKey); setLimit(PAGE); }
  const visible = filtered.slice(0, limit);
  const retrieved = data ? new Date(`${data.retrieved}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric" }) : null;

  return <>
    <section className="page-intro">
      <div>
        <p className="eyebrow">{t("HOUSE + SENATE · GENERAL-ELECTION CANDIDATES")}</p>
        <h1>{t("Who is on the ballot")}</h1>
        <p>{t("Every nominee for the 435 House seats and 35 Senate races on 3 November, with the model's odds and the handicappers' ratings for each race.")}</p>
      </div>
      <div className="stat-stamp"><strong>{data ? filtered.length.toLocaleString(intl) : "—"}</strong><span>{t("candidates in view")}</span><small>{retrieved ? t("Lists retrieved {date}", { date: retrieved }) : t("Loading candidates…")}</small></div>
    </section>

    <section className="panel cand-directory">
      <div className="cand-filters">
        <label className="cand-search">{t("Search")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Name, state or district (PA-07)…")} /></label>
        <label>{t("State")}<select value={state} onChange={(event) => setState(event.target.value)}><option value="all">{t("All states")}</option>{states.filter((item) => item.code !== "DC").map((item) => <option key={item.code} value={item.code}>{t(item.name)}</option>)}</select></label>
        <label>{t("Party")}<select value={party} onChange={(event) => setParty(event.target.value)}><option value="all">{t("All parties")}</option>{(["D", "R", "I", "L", "G"] as CandidateParty[]).map((code) => <option key={code} value={code}>{t(PARTY_NAMES[code])}</option>)}<option value="other">{t("Other parties")}</option></select></label>
        <label>{t("Sort by")}<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="competitive">{t("Most competitive")}</option><option value="state">{t("State")}</option><option value="name">{t("Surname")}</option></select></label>
        <div className="cand-filter-row">
        <div className="cand-segment" role="group" aria-label={t("Chamber")}>{[["all", t("Both chambers")], ["house", t("House")], ["senate", t("Senate")]].map(([value, label]) => <button key={value} type="button" aria-pressed={chamber === value} onClick={() => setChamber(value)}>{label}</button>)}</div>
        <div className="cand-segment" role="group" aria-label={t("Status")}>{([["all", t("Everyone")], ["incumbent", t("Incumbents")], ["challenger", t("Challengers")], ["open", t("Open seats")]] as [Status, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
        <label className="cand-toggle"><input type="checkbox" checked={competitiveOnly} onChange={(event) => setCompetitiveOnly(event.target.checked)} /><span>{t("Competitive races only")}</span></label>
        <div className="cand-segment cand-view" role="group" aria-label={t("View")}>{([["cards", t("Cards")], ["list", t("List")]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
        </div>
      </div>
      <p className="cand-hint">{t("Competitive: the model gives either party between 25% and 75%, or at least one handicapper rates the race Lean, Tilt or Toss-up.")}</p>

      {failed && <p className="table-empty">{t("The candidate directory could not be loaded. Try reloading the page.")}</p>}
      {!data && !failed && <div className={`cand-grid ${view}`} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <div key={index} className="cand-card skeleton" />)}</div>}
      {data && <div className={`cand-grid ${view}`}>
        {view === "list" && <div className="cand-list-head" aria-hidden="true"><span>{t("Candidate")}</span><span>{t("Race")}</span><span>{t("Status")}</span><span>{t("Party's chance")}</span><span>Cook</span></div>}
        {visible.map((row, index) => <CandidateCard key={row.candidate.slug} row={row} index={index % PAGE} />)}
      </div>}
      {data && filtered.length === 0 && <div className="table-empty cand-empty"><p>{t("No candidates match the selected filters.")}</p><button type="button" onClick={reset}>{t("Clear filters")}</button></div>}
      {filtered.length > limit && <button type="button" className="cand-more" onClick={() => setLimit((value) => value + PAGE * 2)}>{t("Show more ({count} left)", { count: (filtered.length - limit).toLocaleString(intl) })}</button>}
      {data && <p className="source-note cand-source">{t("Source: Wikipedia candidate tables (state election offices' certified lists), retrieved {date}. Portraits: official congressional photos for sitting members (public domain). Odds: {model}.", { date: retrieved || "", model: model ? `${model.version} · ${model.runDate}` : "MP-26" })}</p>}
    </section>
  </>;
}

const surname = (name: string) => name.replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/, "").split(/\s+/).pop() || name;

function CandidateCard({ row, index }: { row: Row; index: number }) {
  const t = useT();
  const { candidate, race, model, sharedParty } = row;
  const code = candidateState(candidate);
  const chance = partyProbability(candidate, model, sharedParty);
  const cook = expertRatings(model)?.cook;
  // The code already says "Senate"; the subtitle only needs the state there.
  const label = candidate.chamber === "senate" ? t(stateByCode.get(code)?.name || code) : raceName({ chamber: candidate.chamber, code: candidate.race, state: code }, t);
  const status = candidate.incumbent ? t("Incumbent") : race.open ? t("Open seat") : t("Challenger");
  return <article className={`cand-card ${partyTone(candidate.party)}`} style={{ "--i": Math.min(index, 24) } as React.CSSProperties}>
    <CandidateAvatar candidate={candidate} />
    <div className="cand-main">
      <Link className="cand-name" href={`/candidates/${candidate.slug}`}>{candidate.name}</Link>
      <span className="cand-party"><i />{t(candidate.partyLabel)}</span>
    </div>
    <Link className="cand-race" href={`/races/${raceSlug({ chamber: candidate.chamber, code: candidate.race })}`} title={t("Open race profile")}>
      <strong>{candidate.chamber === "senate" ? t("{code} Senate", { code: candidate.race }) : candidate.race}</strong>
      <small>{label}{race.special ? ` · ${t("special")}` : ""}</small>
    </Link>
    <span className={`cand-status${candidate.incumbent ? " incumbent" : ""}`}>{status}</span>
    <span className="cand-odds">{chance === null ? <em>{sharedParty && model ? t("Same-party rivals") : "—"}</em> : <><b className={chance >= 50 ? "fav" : ""}>{chance}%</b><span className="cand-bar"><i style={{ width: `${chance}%` }} /></span></>}</span>
    <span className="cand-cook" title="Cook Political Report">{cook ? <><small>Cook</small>{t(cook)}</> : <small>{model ? t("Not rated") : "…"}</small>}</span>
  </article>;
}
