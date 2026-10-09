"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/locale-provider";

type Triage = { topic: string; relevance: number; urgency: number; confidence: number; mode: string };

// Jev pilot: classify any headline or post into topic, 2026 relevance and urgency.
export function SignalTriage() {
  const t = useT();
  const [sample, setSample] = useState(() => t("New Senate poll shows the race inside the margin of error. Full methodology and field dates attached."));
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
      <summary><span><b>{t("Signal triage")}</b><small>{t("Jev pilot · classify any headline")}</small></span><i aria-hidden="true">+</i></summary>
      <label className="sr-only" htmlFor="triage-input">{t("Item to classify")}</label>
      <textarea id="triage-input" value={sample} onChange={(event) => setSample(event.target.value)} rows={4} />
      <button type="button" onClick={run} disabled={loading}>{loading ? t("Classifying…") : t("Classify")}</button>
      {triage && <div className="triage-mini">
        <span><small>{t("Topic")}</small><b>{t(triage.topic)}</b></span>
        <span><small>{t("Relevance")}</small><b>{Math.round(triage.relevance * 100)}%</b></span>
        <span><small>{t("Urgency")}</small><b>{Math.round(triage.urgency * 100)}%</b></span>
        <em>{triage.mode === "jev" ? t("Powered by Jev") : t("Local rules · add TYPESAFE_API_KEY for Jev")}</em>
      </div>}
    </details>
  );
}
