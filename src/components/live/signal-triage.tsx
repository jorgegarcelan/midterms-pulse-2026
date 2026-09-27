"use client";

import { useState } from "react";

type Triage = { topic: string; relevance: number; urgency: number; confidence: number; mode: string };

// Jev pilot: classify any headline or post into topic, 2026 relevance and urgency.
export function SignalTriage() {
  const [sample, setSample] = useState("New Senate poll shows the race inside the margin of error. Full methodology and field dates attached.");
  const [triage, setTriage] = useState<Triage | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (!sample.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: sample }) });
      if (response.ok) setTriage(await response.json() as Triage);
    } catch { /* keep the last result */ } finally { setLoading(false); }
  }

  return (
    <details className="panel live-tool triage-tool">
      <summary><span><b>Signal triage</b><small>Jev pilot · classify any headline</small></span><i aria-hidden="true">+</i></summary>
      <label className="sr-only" htmlFor="triage-input">Item to classify</label>
      <textarea id="triage-input" value={sample} onChange={(event) => setSample(event.target.value)} rows={4} />
      <button type="button" onClick={run} disabled={loading}>{loading ? "Classifying…" : "Classify"}</button>
      {triage && <div className="triage-mini">
        <span><small>Topic</small><b>{triage.topic}</b></span>
        <span><small>Relevance</small><b>{Math.round(triage.relevance * 100)}%</b></span>
        <span><small>Urgency</small><b>{Math.round(triage.urgency * 100)}%</b></span>
        <em>{triage.mode === "jev" ? "Powered by Jev" : "Local rules · add TYPESAFE_API_KEY for Jev"}</em>
      </div>}
    </details>
  );
}
