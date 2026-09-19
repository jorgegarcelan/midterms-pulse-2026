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
  const [scriptReady, setScriptReady] = useState(false);
  const [sample, setSample] = useState("New Senate poll shows the race inside the margin of error. Full methodology and field dates attached.");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer = 0;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) timer = window.setTimeout(() => setAccounts(JSON.parse(saved) as string[]), 0);
    } catch { /* browser storage is optional */ }
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!scriptReady) return;
    const timer = window.setTimeout(() => window.twttr?.widgets?.load(document.querySelector(".timeline-grid") as HTMLElement), 80);
    return () => window.clearTimeout(timer);
  }, [accounts, scriptReady]);

  function save(next: string[]) {
    setAccounts(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const handle = cleanHandle(String(form.get("handle") || ""));
    if (handle && !accounts.some((item) => item.toLowerCase() === handle.toLowerCase())) save([...accounts, handle]);
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
      <Script src="https://platform.twitter.com/widgets.js" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
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
        <div className="timeline-grid">
          {accounts.map((account) => <article className="timeline-card" key={account}><div className="timeline-card-head"><div><span>@{account}</span><small>Public timeline</small></div><a href={`https://x.com/${account}`} target="_blank" rel="noreferrer">Open on X ↗</a></div><a className="twitter-timeline" data-theme="dark" data-chrome="noheader nofooter transparent" data-height="560" data-dnt="true" href={`https://twitter.com/${account}`}>Loading @{account} posts…</a><p className="embed-fallback">If X blocks the embedded feed, use “Open on X”.</p></article>)}
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
