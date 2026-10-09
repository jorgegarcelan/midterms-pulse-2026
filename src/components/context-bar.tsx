"use client";

import Link from "@/components/i18n/link";
import { useState } from "react";
import { states, stateByCode, type ChamberFilter, type ElectionCycle } from "@/data/geography";
import { useElectionContext } from "@/components/election-context";
import { useT } from "@/components/i18n/locale-provider";

export function ContextBar() {
  const { stateCode, county, cycle, chamber, pinnedStates, setContext, togglePinnedState } = useElectionContext();
  const t = useT();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const stateName = stateByCode.get(stateCode)?.name;
  const summary = [t(stateName || "United States"), cycle, t(chamber === "all" ? "All chambers" : chamber === "house" ? "House" : "Senate")].join(" · ");

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <>
    <section className={`context-bar${expanded ? " expanded" : ""}`} aria-label={t("Global election context")}>
      <button type="button" className="context-toggle" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}><span>{summary}</span><b>{t(expanded ? "Close" : "Filters")}</b></button>
      <div className="context-primary">
        <label>{t("Area")}<select value={stateCode} onChange={(event) => setContext({ stateCode: event.target.value, county: "" })}><option value="US">{t("United States")}</option>{states.map((state) => <option key={state.code} value={state.code}>{t(state.name)}</option>)}</select></label>
        <label>{t("Cycle")}<select value={cycle} onChange={(event) => setContext({ cycle: event.target.value as ElectionCycle })}><option value="2026">2026</option><option value="2024">2024</option><option value="2020">2020</option><option value="2016">2016</option></select></label>
        <label>{t("Chamber")}<select value={chamber} onChange={(event) => setContext({ chamber: event.target.value as ChamberFilter })}><option value="all">{t("All chambers")}</option><option value="house">{t("House")}</option><option value="senate">{t("Senate")}</option></select></label>
        {stateName && <Link className="context-link" href={`/states/${stateCode.toLowerCase()}`}>{t("Open {code} profile →", { code: stateCode })}</Link>}
        {county && <button className="context-county" type="button" onClick={() => setContext({ county: "" })}>{county} ×</button>}
      </div>
      <div className="context-actions">
        {stateCode !== "US" && <button type="button" className={pinnedStates.includes(stateCode) ? "active" : ""} onClick={() => togglePinnedState(stateCode)}>{t(pinnedStates.includes(stateCode) ? "Pinned" : "Pin state")}</button>}
        <Link href="/workspace?view=compare">{pinnedStates.length ? t("Compare {count}", { count: pinnedStates.length }) : t("Compare states")}</Link>
        <button type="button" onClick={copyLink}>{t(copied ? "Link copied" : "Share view")}</button>
        <button type="button" onClick={() => setSourcesOpen(true)}>{t("Data status")}</button>
      </div>
    </section>
    {sourcesOpen && <div className="source-drawer-backdrop" onClick={() => setSourcesOpen(false)}><aside className="source-drawer" role="dialog" aria-modal="true" aria-label={t("Data status")} onClick={(event) => event.stopPropagation()}>
      <div className="source-drawer-head"><div><p className="eyebrow">{t("DATA STATUS")}</p><h2>{t("Sources and freshness")}</h2></div><button onClick={() => setSourcesOpen(false)} aria-label={t("Close data status")}>×</button></div>
      <div className="source-status-list">
        <a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><i className="status-warn" /><span><strong>{t("Forecast and polls")}</strong><small>{t("Vote-Scope · live where available, dated cache on restricted hosts")}</small></span><b>15 min</b></a>
        <a href="https://github.com/Polymarket/agent-skills/blob/main/market-data.md" target="_blank" rel="noreferrer"><i className="status-live" /><span><strong>{t("Prediction markets")}</strong><small>{t("Polymarket Gamma and CLOB APIs")}</small></span><b>5 min</b></a>
        <a href="https://electionlab.mit.edu/data" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>{t("Historical results")}</strong><small>MIT Election Data and Science Lab</small></span><b>2016–24</b></a>
        <a href="https://www.census.gov/programs-surveys/acs/data/data-via-api.html" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>{t("Demographics")}</strong><small>{t("Census American Community Survey")}</small></span><b>ACS</b></a>
        <a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"><i className="status-live" /><span><strong>{t("Candidates and finance")}</strong><small>{t("Federal Election Commission filings")}</small></span><b>{t("6 hr")}</b></a>
        <a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>{t("Congressional boundaries")}</strong><small>{t("Census 2024 files · 119th Congress")}</small></span><b>2025–27</b></a>
      </div>
      <p className="source-drawer-note">{t("Clicking a source opens its documentation. Every live feed has an explicit fallback and never silently substitutes invented current data.")}</p>
    </aside></div>}
  </>;
}
