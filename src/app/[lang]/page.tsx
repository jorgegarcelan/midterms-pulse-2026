"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { ChamberReadingsView } from "@/components/readings/readings";
import { SiteFooter } from "@/components/site-footer";
import { electionSnapshot, type Race } from "@/data/election";
import type { ForecastRace } from "@/lib/forecast";
import type { ChamberReadings } from "@/lib/readings-shared";
import { RaceTicker } from "@/components/motion/race-ticker";
import { PulseStory } from "@/components/pulse/pulse-story";
import { SenateBuilder } from "@/components/senate/senate-builder";

type LiveForecast = {
  runDate: string;
  version: string;
  simulations: number;
  house: { demMajority: number; demSeats: number; repSeats: number };
  senate: { demMajority: number; demSeats: number; repSeats: number };
  genericBallot: { dem: number; rep: number; margin: number; effectivePolls: number; latestPoll: string; source: string };
  races: ForecastRace[];
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

export default function Home() {
  const t = useT();
  const [swing, setSwing] = useState(0);
  const [liveForecast, setLiveForecast] = useState<LiveForecast | null>(null);
  const [readings, setReadings] = useState<{ house: ChamberReadings; senate: ChamberReadings } | null>(null);
  const baselineRaces: (Race | ForecastRace)[] = liveForecast?.races || electionSnapshot.races;
  const senateRaces = useMemo(() => (liveForecast?.races || []).filter((race) => race.chamber === "senate"), [liveForecast]);
  const house = liveForecast?.house || electionSnapshot.house;
  const senate = liveForecast?.senate || electionSnapshot.senate;
  const ballot = liveForecast?.genericBallot || electionSnapshot.genericBallot;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/model").then((response) => {
      if (!response.ok) throw new Error("Forecast feed unavailable");
      return response.json() as Promise<LiveForecast>;
    }).then((payload) => { if (!cancelled) setLiveForecast(payload); }).catch(() => undefined);
    fetch("/api/readings").then((response) => response.ok ? response.json() : null).then((payload) => { if (!cancelled && payload) setReadings(payload); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    };

    register({
      name: "set_national_swing",
      title: "Set national swing",
      description: "Set the national swing (R+5 to D+5) that recolours the district map, the House chamber and the tipping-point ladder.",
      inputSchema: { type: "object", properties: { swing: { type: "integer", minimum: -5, maximum: 5 } }, required: ["swing"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = (input as { swing?: unknown })?.swing;
        if (!Number.isInteger(value) || Number(value) < -5 || Number(value) > 5) throw new Error("swing must be an integer from -5 to 5");
        const next = Number(value);
        setSwing(next);
        return { swing: next, districtShift: next * 0.7 };
      },
    });

    return () => lifecycle.abort();
  }, []);

  return (
    <main className="page-main home-main">
      <PulseStory races={baselineRaces} live={Boolean(liveForecast)} house={house} senate={senate} ballotMargin={ballot.margin} swing={swing} onSwing={setSwing} />
      <section className="dashboard-shell" id="top">
        <RaceTicker races={baselineRaces} live={Boolean(liveForecast)} />

        <section className="home-readings" id="signals" aria-label={t("Four readings: polls, markets, MP-26 and Census-26")}>
          <div className="home-readings-head"><p className="eyebrow">{t("FOUR READINGS")}</p><h2>{t("What the polls, the markets and the two models say")}</h2></div>
          <div className="home-readings-grid">
            {(["house", "senate"] as const).map((chamber) => <article key={chamber} className="panel home-reading">
              <div className="panel-head"><div><p className="eyebrow">{chamber === "house" ? t("U.S. HOUSE") : t("U.S. SENATE")}</p><h3>{chamber === "house" ? t("218 seats for a majority") : t("51 seats for a majority")}</h3></div></div>
              {readings ? <ChamberReadingsView readings={readings[chamber]} variant="card" /> : <div className="race-readings-wait" aria-busy="true" />}
            </article>)}
          </div>
        </section>

        <SenateBuilder races={senateRaces} />

        <nav className="home-explore" aria-label={t("Explore")}>
          {[
            { href: "/key-races", title: "Key races", note: "Calle 14's guide, with the four readings" },
            { href: "/races", title: "Every race", note: "Map and list of the 470 House and Senate races" },
            { href: "/model", title: "MP-26", note: "The forecast from polls and fundamentals" },
            { href: "/census", title: "Census-26", note: "The House from demographics alone, no polls" },
            { href: "/election-night", title: "Election night", note: "Poll closings hour by hour, and the results live" },
          ].map((item) => <Link key={item.href} href={item.href} className="panel home-explore-card"><b>{t(item.title)}</b><span>{t(item.note)}</span><i aria-hidden="true">→</i></Link>)}
        </nav>

        <SiteFooter />
      </section>
    </main>
  );
}
