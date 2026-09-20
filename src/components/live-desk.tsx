"use client";

import Script from "next/script";
import { FormEvent, useEffect, useState } from "react";

const STORAGE_KEY = "midterm-pulse-x-accounts";
const defaultAccounts = ["CookPolitical", "DecisionDeskHQ", "Redistrict"];

declare global {
  interface Window { twttr?: { widgets?: { load: (element?: HTMLElement) => void } } }
}

type Triage = { topic: string; relevance: number; urgency: number; confidence: number; mode: string };

function cleanHandle(value: string) {
  return value.trim().replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15);
}

export function LiveDesk() {
  const [accounts, setAccounts] = useState(defaultAccounts);
  const [activeAccount, setActiveAccount] = useState(defaultAccounts[0]);
  const [embedRequested, setEmbedRequested] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [sample, setSample] = useState("New Senate poll shows the race inside the margin of error. Full methodology and field dates attached.");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer = 0;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
        timer = window.setTimeout(() => {
          setAccounts(parsed);
          setActiveAccount(parsed[0] || "");
        }, 0);
      }
    } catch { /* browser storage is optional */ }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!embedRequested || !scriptReady || !activeAccount) return;
    const timer = window.setTimeout(() => window.twttr?.widgets?.load(document.querySelector(".active-timeline") as HTMLElement), 100);
    return () => window.clearTimeout(timer);
  }, [activeAccount, embedRequested, scriptReady]);

  function save(next: string[], preferredAccount = activeAccount) {
    setAccounts(next);
    const nextActive = next.includes(preferredAccount) ? preferredAccount : (next[0] || "");
    setActiveAccount(nextActive);
    setEmbedRequested(false);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function selectAccount(account: string) {
    setActiveAccount(account);
    setEmbedRequested(false);
    setScriptError(false);
  }

  function loadFeed() {
    setScriptError(false);
    setScriptReady(Boolean(window.twttr?.widgets));
    setEmbedRequested(true);
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const handle = cleanHandle(String(form.get("handle") || ""));
    if (handle && !accounts.some((item) => item.toLowerCase() === handle.toLowerCase())) save([...accounts, handle], handle);
    event.currentTarget.reset();
  }

  async function runTriage() {
    if (!sample.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: sample }) });
      if (!response.ok) throw new Error("Unavailable");
      setTriage(await response.json() as Triage);
    } finally { setLoading(false); }
  }

  return (
    <>
      {embedRequested && <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onReady={() => setScriptReady(true)} onError={() => setScriptError(true)} />}
      <section className="page-intro live-intro">
        <div><p className="eyebrow">LIVE SIGNALS</p><h1>Your election watchlist.</h1><p>Build a configurable wall of public X timelines for reporters, analysts, election desks and official sources.</p></div>
        <div className="live-indicator"><i /><span>Monitoring</span><strong>{accounts.length} accounts</strong></div>
      </section>

      <section className="panel account-config">
        <div><p className="eyebrow">WATCHLIST</p><h2>Accounts on this device</h2></div>
        <form onSubmit={addAccount}><label className="sr-only" htmlFor="x-handle">X account</label><input id="x-handle" name="handle" placeholder="@handle or profile URL" /><button className="primary-action" type="submit">Add account</button></form>
        <div className="account-chips">{accounts.map((account) => <span key={account}>@{account}<button aria-label={`Remove ${account}`} onClick={() => save(accounts.filter((item) => item !== account))}>×</button></span>)}</div>
      </section>

      <section className="live-layout">
        <div className="feed-console">
          <div className="feed-tabs" role="group" aria-label="Choose an X account">
            {accounts.map((account) => <button type="button" aria-pressed={activeAccount === account} className={activeAccount === account ? "active" : ""} key={account} onClick={() => selectAccount(account)}>@{account}</button>)}
          </div>
          {activeAccount ? <article className="timeline-card active-timeline" key={`${activeAccount}-${embedRequested}`}>
            <div className="timeline-card-head"><div><span>@{activeAccount}</span><small>Public timeline · loaded one account at a time</small></div><a href={`https://x.com/${activeAccount}`} target="_blank" rel="noreferrer">Open on X ↗</a></div>
            {!embedRequested ? <div className="embed-gate"><div className="embed-gate-mark">𝕏</div><h2>Load @{activeAccount}</h2><p>The public X widget is loaded only when requested. This prevents parallel syndication requests and reduces rate-limit errors.</p><button className="primary-action" type="button" onClick={loadFeed}>Load latest posts</button></div> : scriptError ? <div className="embed-gate"><h2>Feed unavailable</h2><p>X&apos;s embed script could not load. Open the profile directly and try again later.</p><a className="secondary-action" href={`https://x.com/${activeAccount}`} target="_blank" rel="noreferrer">Open on X ↗</a></div> : <><a className="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter transparent" data-height="620" data-dnt="true" href={`https://twitter.com/${activeAccount}`}>Loading @{activeAccount} posts…</a><p className="embed-fallback">If X returns a rate limit, open the profile directly or wait before retrying. The browser warning about <code>unload</code> comes from X&apos;s widget and does not affect Midterm Pulse.</p></>}
          </article> : <article className="timeline-card"><div className="embed-gate"><h2>No accounts configured</h2><p>Add an X account above to create your live watchlist.</p></div></article>}
        </div>

        <aside className="panel jev-panel">
          <div className="jev-heading"><div className="jev-mark">∵</div><div><p className="eyebrow">JEV PILOT</p><h2>Signal triage</h2></div><span>Experimental</span></div>
          <p>Jev is a strong fit for fast, typed decisions—not narrative analysis. This pilot classifies an incoming item and returns calibrated probabilities.</p>
          <label>Item to classify<textarea value={sample} onChange={(event) => setSample(event.target.value)} rows={6} /></label>
          <button className="primary-action" onClick={runTriage} disabled={loading}>{loading ? "Classifying…" : "Classify signal"}</button>
          {triage && <div className="triage-result"><div><span>Topic</span><strong>{triage.topic}</strong></div><div><span>2026 relevance</span><strong>{Math.round(triage.relevance * 100)}%</strong></div><div><span>Urgency</span><strong>{Math.round(triage.urgency * 100)}%</strong></div><div><span>Confidence</span><strong>{Math.round(triage.confidence * 100)}%</strong></div><small>{triage.mode === "jev" ? "Powered by Jev" : "Local fallback · add TYPESAFE_API_KEY for Jev"}</small></div>}
        </aside>
      </section>
    </>
  );
}
