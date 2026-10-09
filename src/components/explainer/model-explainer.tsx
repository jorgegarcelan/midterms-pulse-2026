"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { ScrambleText } from "@/components/motion/scramble-text";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { ModelInBrief } from "@/components/explainer/model-in-brief";
import { PipelineHero } from "@/components/explainer/pipeline-hero";
import { StageErrorBells } from "@/components/explainer/stage-error-bells";
import { StageLiveSim } from "@/components/explainer/stage-live-sim";
import { StageMovement } from "@/components/explainer/stage-movement";
import { StageOutput } from "@/components/explainer/stage-output";
import { StagePollWeights, type ExplainerPoll } from "@/components/explainer/stage-poll-weights";
import { StageRaceCurve, type ExplainerRace } from "@/components/explainer/stage-race-curve";
import { signedLabel, useInView } from "@/components/explainer/use-in-view";
import { NATIONAL_SD, NATIONALIZATION, POLL_HALF_LIFE_DAYS, POPULATION_WEIGHT, RACE_COMMON_SD, RACE_SD, SIMULATIONS } from "@/lib/mp26";

type ModelFeed = {
  version: string; runDate: string; simulations: number;
  genericBallot: { dem: number; rep: number; margin: number; effectivePolls: number; latestPoll: string; source: string; benchmarkMargin: number; movement: number };
  house: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number] };
  senate: { demMajority: number; demSeats: number; repSeats: number; interval80: [number, number] };
  races: (ExplainerRace & { margin: number })[];
};
type PollFeed = { meta: { run_date: string; n_polls: number; latest_field_end: string }; polls: (ExplainerPoll & { population: string })[] };
type ForecastFeed = { updated: string; stale?: boolean };

const STAGES = [
  { id: "inputs", n: "01", label: "Inputs" },
  { id: "weights", n: "02", label: "Poll weighting" },
  { id: "movement", n: "03", label: "Movement" },
  { id: "races", n: "04", label: "Race odds" },
  { id: "error", n: "05", label: "Error budget" },
  { id: "simulate", n: "06", label: "Simulation" },
  { id: "outputs", n: "07", label: "Outputs" },
  { id: "versions", n: "08", label: "Versions & limits" },
];

function Stage({ id, n, title, children, copy }: { id: string; n: string; title: string; copy: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLElement>({ rootMargin: "0px 0px -25% 0px" });
  return (
    <section className="stage" id={id} ref={ref} data-in={inView ? "true" : undefined} aria-labelledby={`${id}-title`}>
      <div className="stage-copy">
        <p className="eyebrow"><span className="stage-n">{n}</span> {t(STAGES.find((stage) => stage.id === id)?.label || "")}</p>
        <h2 id={`${id}-title`}>{title}</h2>
        {copy}
      </div>
      {children}
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <code className="formula-chip">{children}</code>;
}

// The MP-26 pipeline, stage by stage, animated with the live model's own data and engine.
export function ModelExplainer() {
  const t = useT();
  const intl = useIntlLocale();
  const [model, setModel] = useState<ModelFeed | null>(null);
  const [polls, setPolls] = useState<PollFeed | null>(null);
  const [forecast, setForecast] = useState<ForecastFeed | null>(null);
  const [active, setActive] = useState("inputs");
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const get = <T,>(url: string) => fetch(url, { signal: controller.signal }).then((response) => response.json() as Promise<T>);
    get<ModelFeed>("/api/model").then(setModel).catch(() => undefined);
    get<PollFeed>("/api/polls/live?limit=240").then(setPolls).catch(() => undefined);
    get<ForecastFeed>("/api/forecast").then(setForecast).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // Rail: the spine fills with scroll and the stage in the middle of the screen lights up.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = body.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (window.innerHeight * .5 - rect.top) / rect.height));
        body.style.setProperty("--spine", progress.toFixed(4));
      });
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: "-45% 0px -50% 0px" });
    body.querySelectorAll(".stage").forEach((stage) => observer.observe(stage));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); observer.disconnect(); cancelAnimationFrame(frame); };
  }, [model]);

  const houseRaces = useMemo(() => (model?.races || []).filter((race) => race.chamber === "house"), [model]);
  const tipping = useMemo(() => [...houseRaces].sort((a, b) => b.signedMargin - a.signedMargin)[217], [houseRaces]);
  const bellRaces = useMemo(() => {
    if (!model || !tipping) return [];
    const senate = model.races.filter((race) => race.chamber === "senate").sort((a, b) => Math.abs(a.signedMargin) - Math.abs(b.signedMargin));
    const leanR = houseRaces.filter((race) => race.signedMargin < -3).sort((a, b) => b.signedMargin - a.signedMargin)[0];
    return [tipping, senate[0], leanR].filter(Boolean);
  }, [houseRaces, model, tipping]);
  const explainerPolls = useMemo(() => (polls?.polls || []).map((poll) => ({ ...poll, population: (poll.population === "LV" || poll.population === "RV" ? poll.population : "A") as ExplainerPoll["population"] })), [polls]);

  function jump(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const ready = model && polls;
  const senateCount = model?.races.filter((race) => race.chamber === "senate").length || 35;

  return (
    <div className="explainer" data-motion>
      <section className="explainer-hero">
        <p className="eyebrow"><ScrambleText text={`${t("HOW IT WORKS")} · ${model?.version || "MP-26"}`} delay={150} /></p>
        <h1>{polls ? t("From {count} polls to one probability.", { count: polls.meta.n_polls.toLocaleString(intl) }) : t("From every poll to one probability.")}</h1>
        <p className="explainer-deck">{t("Midterm Pulse turns a public poll index and a race-level benchmark into House and Senate odds in seven auditable steps. Every chart below runs on the live model, its data and its engine.")}</p>
        {model && polls ? <PipelineHero
          polls={t("{count} polls", { count: polls.meta.n_polls.toLocaleString(intl) })}
          races={t("{count} races", { count: model.races.length })}
          ballot={signedLabel(model.genericBallot.margin)}
          movement={signedLabel(model.genericBallot.movement)}
          house={`${model.house.demMajority}% D · ${model.house.demSeats}`}
          senate={`${model.senate.demMajority}% D · ${model.senate.demSeats}`}
          onJump={jump}
        /> : <div className="pipeline-hero pipeline-loading">{t("Loading the live model…")}</div>}
      </section>

      <ModelInBrief model={model} />

      <div className="explainer-body" ref={bodyRef}>
        <nav className="explainer-rail" aria-label={t("Pipeline stages")}>
          <span className="rail-spine" aria-hidden="true"><i /></span>
          {STAGES.map((stage) => <button key={stage.id} type="button" className={active === stage.id ? "active" : ""} onClick={() => jump(stage.id)}><i /><b>{stage.n}</b>{t(stage.label)}</button>)}
        </nav>

        <div className="explainer-stages">
          <Stage id="inputs" n="01" title={t("Two public sources feed the model. Everything else is context.")} copy={<>
            <p>{t("MP-26 does not collect polls or rate races itself. It reads Vote-Scope's generic-ballot poll index and its race-level forecast, adds the current Senate composition, and keeps other data strictly out of the probabilities.")}</p>
            <ul className="stage-facts"><li><b>{t("Refresh")}</b> {t("every 15 minutes, with a dated fallback snapshot")}</li><li><b>{t("Benchmark run")}</b> {forecast?.updated || model?.runDate || "—"}{forecast?.stale ? ` (${t("dated fallback")})` : ""}</li></ul>
          </>}>
            <div className="stage-viz sources-viz">
              <div className="source-column feeds">
                <p>{t("Feeds the model")}</p>
                <article><b>{t("Vote-Scope poll index")}</b><span>{polls ? t("{count} generic-ballot polls · through {date}", { count: polls.meta.n_polls.toLocaleString(intl), date: polls.meta.latest_field_end }) : t("Generic-ballot polls")}</span><em>{t("→ weighting")}</em></article>
                <article><b>{t("Vote-Scope race forecast")}</b><span>{model ? t("{districts} districts + {senate} Senate races", { districts: houseRaces.length, senate: senateCount }) : t("Every race's expected margin")}</span><em>{t("→ race margins")}</em></article>
                <article><b>{t("119th Congress")}</b><span>{t("47 D caucus · 53 R · 34 D and 31 R seats not up")}</span><em>{t("→ fixed Senate seats")}</em></article>
              </div>
              <div className="source-column context">
                <p>{t("Context only")}</p>
                <article><b>{t("Census boundaries")}</b><span>{t("Maps and district shapes")}</span><em>{t("not an input")}</em></article>
                <article><b>{t("FEC filings")}</b><span>{t("Candidates and finance on race pages")}</span><em>{t("not an input")}</em></article>
                <article><b>Polymarket</b><span>{t("Compared against the model, never blended")}</span><em>{t("not an input")}</em></article>
              </div>
            </div>
          </Stage>

          <Stage id="weights" n="02" title={t("Recent, large, likely-voter polls count most.")} copy={<>
            <p>{t("Every poll gets a weight from three factors. Recency halves every {days} days, sample size counts by its square root, and likely-voter samples beat registered voters and adults. The weighted average of all polls is the national environment.", { days: POLL_HALF_LIFE_DAYS })}</p>
            <Formula>w = 0.5<sup>age/{POLL_HALF_LIFE_DAYS}</sup> × √(n / 1,000) × pop</Formula>
            <ul className="stage-facts"><li><b>pop</b> LV {POPULATION_WEIGHT.LV} · RV {POPULATION_WEIGHT.RV} · A {POPULATION_WEIGHT.A}</li><li><b>{t("Result")}</b> {model ? `${signedLabel(model.genericBallot.margin)} (D ${model.genericBallot.dem} · R ${model.genericBallot.rep})` : "—"}</li></ul>
          </>}>
            {ready ? <StagePollWeights polls={explainerPolls} runDate={model.runDate} modelMargin={model.genericBallot.margin} totalPolls={polls.meta.n_polls} /> : <div className="stage-viz viz-empty">{t("Loading polls…")}</div>}
          </Stage>

          <Stage id="movement" n="03" title={t("Only real movement since the benchmark is applied.")} copy={<>
            <p>{t("The benchmark was built with the polls available on its run date. So the model compares the same index, with the same weights, today and on that date. The difference is the only national movement it adds, and each race absorbs {pct}% of it.", { pct: Math.round(NATIONALIZATION * 100) })}</p>
            <Formula>movement = ballot<sub>today</sub> − ballot<sub>benchmark date</sub></Formula>
          </>}>
            {model ? <StageMovement today={model.genericBallot.margin} benchmark={model.genericBallot.benchmarkMargin} movement={model.genericBallot.movement} benchmarkDate={forecast?.updated || model.runDate} runDate={model.runDate} /> : <div className="stage-viz viz-empty">{t("Loading…")}</div>}
          </Stage>

          <Stage id="races" n="04" title={t("Every race becomes a probability.")} copy={<>
            <p>{t("Each of the {count} races starts from the benchmark's expected margin, plus its share of the movement. A normal error of ±{sd} points, calibrated to the benchmark's own race odds, turns that margin into a win probability.", { count: model?.races.length || 470, sd: RACE_SD })}</p>
            <ul className="stage-facts"><li><b>{t("Tipping point")}</b> {tipping ? t("{code}, the 218th most Democratic seat, at {margin}", { code: tipping.code, margin: signedLabel(tipping.signedMargin) }) : "—"}</li></ul>
          </>}>
            {model ? <StageRaceCurve races={model.races} tippingCode={tipping?.code} /> : <div className="stage-viz viz-empty">{t("Loading races…")}</div>}
          </Stage>

          <Stage id="error" n="05" title={t("Races miss together, not one by one.")} copy={<>
            <p>{t("Polls tend to miss in the same direction everywhere. So each race's error is split in two: a national error shared by all races, and local noise of its own. The shared part is sized to match the correlated error the benchmark publishes.")}</p>
            <Formula>outcome = margin + national + local</Formula>
            <ul className="stage-facts"><li><b>{t("National")}</b> {t("±{sd} ballot pts × {factor} = ±{race}", { sd: NATIONAL_SD, factor: NATIONALIZATION, race: RACE_COMMON_SD.toFixed(2) })}</li><li><b>{t("Total per race")}</b> {t("±{sd} pts", { sd: RACE_SD })}</li></ul>
          </>}>
            {bellRaces.length ? <StageErrorBells races={bellRaces} /> : <div className="stage-viz viz-empty">{t("Loading…")}</div>}
          </Stage>

          <Stage id="simulate" n="06" title={t("Run the election 50,000 times.")} copy={<>
            <p>{t("One simulation draws a national error, then a local error for every race, and counts the seats each party wins. Repeat {count} times per chamber and the share of runs with a majority is the control probability.", { count: SIMULATIONS.toLocaleString(intl) })}</p>
            <ul className="stage-facts"><li><b>{t("House")}</b> {t("435 districts, 218 to win")}</li><li><b>{t("Senate")}</b> {t("{count} races + 65 seats not up; a 50–50 tie goes to the GOP via the Vice President", { count: senateCount })}</li></ul>
          </>}>
            {model ? <StageLiveSim races={model.races} houseMajority={model.house.demMajority} senateMajority={model.senate.demMajority} /> : <div className="stage-viz viz-empty">{t("Loading…")}</div>}
          </Stage>

          <Stage id="outputs" n="07" title={t("One response feeds the whole site.")} copy={<>
            <p>{t("The API returns control odds, seat medians and 80% intervals, and a probability for every race. The home story, the Senate builder, the district map, race pages and the model page all read the same numbers.")}</p>
            <ul className="stage-facts"><li><b>{t("Deterministic")}</b> {t("fixed seeds: same inputs, same output")}</li><li><b>{t("Cached")}</b> {t("until the benchmark, polls or date change")}</li></ul>
          </>}>
            {model ? <StageOutput model={model} tippingCode={tipping?.code} /> : <div className="stage-viz viz-empty">{t("Loading…")}</div>}
          </Stage>

          <Stage id="versions" n="08" title={t("Versioned, documented, and not yet backtested.")} copy={<>
            <p>{t("Every change to the method gets a new version and a changelog. MP-26 is labelled experimental until it has been replayed on past elections and scored.")}</p>
            <Link className="secondary-action" href="/methodology">{t("Sources and methodology")} <span>→</span></Link>
          </>}>
            <div className="stage-viz versions-viz">
              <ol className="version-line">
                <li><b>v0.1</b><span>{t("Top-down chambers against a fixed D+7.4 baseline. The Senate read 69% while its own races implied 43%.")}</span></li>
                <li><b>v0.2</b><span>{t("Like-for-like movement, Senate simulated race by race, race error calibrated to the benchmark.")}</span></li>
                <li><b>v0.3</b><span>{t("House simulated race by race too; national error sized to the benchmark's correlated error.")}</span></li>
                <li className="current"><b>v0.4 · {t("current")}</b><span>{t("Race margins read as the benchmark's expected D−R vote, not its expected winning margin; race error refitted to ±{sd}.", { sd: RACE_SD })}</span></li>
              </ol>
              <div className="limits">
                <p>{t("Known limits")}</p>
                <ul>
                  <li>{t("Normal errors; the benchmark uses fatter tails.")}</li>
                  <li>{t("One national factor; no regional correlation.")}</li>
                  <li>{t("No pollster house effects or candidate fundamentals.")}</li>
                  <li>{t("No historical backtest yet (Brier score, calibration).")}</li>
                </ul>
              </div>
            </div>
          </Stage>
        </div>
      </div>
    </div>
  );
}
