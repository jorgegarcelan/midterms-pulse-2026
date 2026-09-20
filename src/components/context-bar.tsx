"use client";

import Link from "next/link";
import { useState } from "react";
import { states, stateByCode, type ChamberFilter, type ElectionCycle } from "@/data/geography";
import { useElectionContext } from "@/components/election-context";

export function ContextBar() {
  const { stateCode, county, cycle, chamber, pinnedStates, setContext, togglePinnedState } = useElectionContext();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const stateName = stateByCode.get(stateCode)?.name;

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <>
    <section className="context-bar" aria-label="Global election context">
      <div className="context-primary">
        <label>Geography<select value={stateCode} onChange={(event) => setContext({ stateCode: event.target.value, county: "" })}><option value="US">United States</option>{states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}</select></label>
        <label>Cycle<select value={cycle} onChange={(event) => setContext({ cycle: event.target.value as ElectionCycle })}><option value="2026">2026</option><option value="2024">2024</option><option value="2020">2020</option><option value="2016">2016</option></select></label>
        <label>Chamber<select value={chamber} onChange={(event) => setContext({ chamber: event.target.value as ChamberFilter })}><option value="all">All chambers</option><option value="house">House</option><option value="senate">Senate</option></select></label>
        {stateName && <Link className="context-link" href={`/states/${stateCode.toLowerCase()}`}>Open {stateCode} profile →</Link>}
        {county && <button className="context-county" type="button" onClick={() => setContext({ county: "" })}>{county} ×</button>}
      </div>
      <div className="context-actions">
        {stateCode !== "US" && <button type="button" className={pinnedStates.includes(stateCode) ? "active" : ""} onClick={() => togglePinnedState(stateCode)}>{pinnedStates.includes(stateCode) ? "Pinned" : "Pin state"}</button>}
        <Link href="/workspace?view=compare">Compare {pinnedStates.length || "states"}</Link>
        <button type="button" onClick={copyLink}>{copied ? "Link copied" : "Share view"}</button>
        <button type="button" onClick={() => setSourcesOpen(true)}>Data status</button>
      </div>
    </section>
    {sourcesOpen && <div className="source-drawer-backdrop" onClick={() => setSourcesOpen(false)}><aside className="source-drawer" role="dialog" aria-modal="true" aria-label="Data status" onClick={(event) => event.stopPropagation()}>
      <div className="source-drawer-head"><div><p className="eyebrow">DATA STATUS</p><h2>Sources and freshness</h2></div><button onClick={() => setSourcesOpen(false)} aria-label="Close data status">×</button></div>
      <div className="source-status-list">
        <a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><i className="status-warn" /><span><strong>Forecast and polls</strong><small>Vote-Scope · live where available, dated cache on restricted hosts</small></span><b>15 min</b></a>
        <a href="https://github.com/Polymarket/agent-skills/blob/main/market-data.md" target="_blank" rel="noreferrer"><i className="status-live" /><span><strong>Prediction markets</strong><small>Polymarket Gamma and CLOB APIs</small></span><b>5 min</b></a>
        <a href="https://electionlab.mit.edu/data" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>Historical results</strong><small>MIT Election Data and Science Lab</small></span><b>2016–24</b></a>
        <a href="https://www.census.gov/programs-surveys/acs/data/data-via-api.html" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>Demographics</strong><small>Census American Community Survey</small></span><b>ACS</b></a>
        <a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"><i className="status-live" /><span><strong>Candidates and finance</strong><small>Federal Election Commission filings</small></span><b>6 hr</b></a>
        <a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><i className="status-static" /><span><strong>Congressional boundaries</strong><small>Census 2024 files · 119th Congress</small></span><b>2025–27</b></a>
      </div>
      <p className="source-drawer-note">Clicking a source opens its documentation. Every live feed has an explicit fallback and never silently substitutes invented current data.</p>
    </aside></div>}
  </>;
}
