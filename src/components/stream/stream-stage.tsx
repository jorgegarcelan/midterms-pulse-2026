"use client";

import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import type { ModelResult } from "@/lib/model";

export const STAGE = { width: 1920, height: 1080 };
const REFRESH_MS = 5 * 60_000;

// The published model, refreshed every five minutes so a scene left open in OBS stays current.
export function useStreamModel() {
  const [model, setModel] = useState<ModelResult | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/model", { cache: "no-store" }).then((response) => response.json() as Promise<ModelResult>).then((next) => { if (alive) setModel(next); }).catch(() => undefined);
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);
  return model;
}

/*
  A fixed 1920×1080 canvas scaled to fit the window, so every scene is laid out in broadcast pixels and
  looks identical in an OBS browser source, a projector or a laptop. `transparent` drops the backdrop
  for use as an overlay.
*/
export function StreamStage({ transparent = false, model, children }: { transparent?: boolean; model?: ModelResult | null; children: React.ReactNode }) {
  const t = useT();
  const intl = useIntlLocale();
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const updated = model ? new Date(`${model.runDate}T12:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) : "";

  return <div className={`stream-root${transparent ? " transparent" : ""}`}>
    <div ref={frame} className="stream-stage" style={{ width: STAGE.width, height: STAGE.height, transform: `translate(-50%, -50%) scale(${scale})` }}>
      <header className="stream-top">
        <span className="stream-brand"><BrandMark /> Midterm <em>Pulse</em> <small>2026</small></span>
        {model && <span className="stream-stamp">{model.version} · {t("updated {date}", { date: updated })}</span>}
      </header>
      <div className="stream-content">{children}</div>
      <footer className="stream-foot"><span>midterm-pulse-2026.vercel.app</span><span>{t("Experimental model · not a prediction of certainty")}</span></footer>
    </div>
  </div>;
}
