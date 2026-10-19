"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { ScrambleText } from "@/components/motion/scramble-text";
import { BacktestChart, DisagreementScatter, FeatureBars, RedrawBars, SeatHistogram, SwingBars, useNumber, type ScatterPoint } from "@/components/census/census-charts";
import type { CensusModel } from "@/lib/census-model";
import { raceSlug } from "@/lib/races";
import type { ModelResult } from "@/lib/model";

export const SECTIONS = [
  { id: "sees", label: "What it sees" },
  { id: "track", label: "Track record" },
  { id: "2026", label: "2026" },
  { id: "polls", label: "Census vs polls" },
  { id: "blind-spot", label: "The blind spot" },
  { id: "clues", label: "Extra clues" },
  { id: "method", label: "How it works" },
];

const BENCHMARK_LABELS: Record<string, string> = {
  census: "Census only (this page)",
  census_inc: "+ incumbent on the ballot",
  census_pres: "+ last presidential result",
  census_pres_inc: "+ both",
};

function SectionHead({ id, n, kicker, title, deck }: { id: string; n: string; kicker: string; title: string; deck: string }) {
  const t = useT();
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <header className="cz-head" id={id} ref={ref} data-in={inView ? "" : undefined}>
      <p className="eyebrow"><span>{n}</span> {t(kicker)}</p>
      <h2>{t(title)}</h2>
      <p>{t(deck)}</p>
    </header>
  );
}

function Hero({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const { house, headline } = data;
  return (
    <section className="cz-hero">
      <div className="cz-hero-copy">
        <p className="eyebrow cz-pill"><ScrambleText text={t("EXPERIMENT · CENSUS ONLY")} delay={150} /></p>
        <h1>{t("Only the census")}</h1>
        <p className="cz-deck">{t("What if all you knew about each district was who lives there? No polls, no markets, no past votes in the district: income, schooling, age, family and origin from the Census Bureau, and nothing else.")}</p>
        <div className="cz-hero-stats">
          <div><b>{n.percent(headline.accuracy, 1)}</b><span>{t("of House seats called right, {first}–{last}", { first: headline.years[0], last: headline.years.at(-1) ?? "" })}</span></div>
          <div><b>{headline.variables}</b><span>{t("census variables per district")}</span></div>
          <div><b>0</b><span>{t("polls")}</span></div>
        </div>
        <nav className="cz-toc" aria-label={t("On this page")}>
          {SECTIONS.map((section, i) => <a key={section.id} href={`#${section.id}`} style={{ "--i": i } as React.CSSProperties}>{t(section.label)}</a>)}
        </nav>
      </div>
      <div className="cz-hero-card">
        <p className="eyebrow">{t("What the census says about November 3")}</p>
        <div className="cz-hero-numbers">
          <div><b className="blue">{house.median}</b><span>{t("Democratic seats, median")}</span></div>
          <div><b>{n.percent(house.pMajority)}</b><span>{t("chance of a Democratic majority")}</span></div>
        </div>
        <SeatHistogram distribution={house.distribution} median={house.median} p10={house.p10} p90={house.p90} compact />
        <p className="cz-hero-foot">{t("80% of simulations between {p10} and {p90} seats.", { p10: house.p10, p90: house.p90 })}</p>
      </div>
    </section>
  );
}

function usePollModel() {
  const [model, setModel] = useState<ModelResult | null | "error">(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<ModelResult> : Promise.reject())
      .then(setModel).catch(() => { if (!controller.signal.aborted) setModel("error"); });
    return () => controller.abort();
  }, []);
  return model;
}

function Disagreements({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const model = usePollModel();
  const points = useMemo<ScatterPoint[]>(() => {
    if (!model || model === "error") return [];
    const polls = new Map(model.races.filter((race) => race.chamber === "house").map((race) => [race.code, race.signedMargin]));
    return data.races.flatMap((race) => polls.has(race.code) ? [{ code: race.code, census: race.margin, polls: polls.get(race.code)! }] : []);
  }, [data.races, model]);
  const split = (censusD: boolean) => points.filter((point) => (point.census >= 0) === censusD && (point.polls >= 0) !== censusD)
    .sort((a, b) => Math.abs(b.census - b.polls) - Math.abs(a.census - a.polls)).slice(0, 6);

  if (model === null) return <p className="cz-wait">{t("Loading the poll-based forecast…")}</p>;
  if (model === "error" || !points.length) return <p className="cz-wait">{t("The poll-based forecast is not available right now, so the comparison cannot be drawn.")}</p>;
  const agree = points.filter((point) => (point.census >= 0) === (point.polls >= 0)).length;

  return (
    <div className="cz-polls">
      <div className="cz-polls-stats">
        <div><b>{n.percent(agree / points.length)}</b><span>{t("of districts: both models pick the same party")}</span></div>
        <div><b>{model.house.demSeats}</b><span>{t("Democratic seats in the poll-based forecast (MP-26), against {census} from the census", { census: data.house.median })}</span></div>
        <div><b>{n.percent(model.house.demMajority / 100)}</b><span>{t("chance of a Democratic majority with polls, against {census} with the census", { census: n.percent(data.house.pMajority) })}</span></div>
      </div>
      <div className="cz-polls-grid">
        <DisagreementScatter points={points} />
        <div className="cz-split-lists">
          {[true, false].map((censusD) => (
            <section key={String(censusD)}>
              <h3>{censusD ? t("Demographics say Democratic, polls say Republican") : t("Demographics say Republican, polls say Democratic")}</h3>
              <table>
                <thead><tr><th>{t("District")}</th><th>{t("Census")}</th><th>{t("Polls")}</th></tr></thead>
                <tbody>
                  {split(censusD).map((point) => (
                    <tr key={point.code}>
                      <td><Link href={`/races/${raceSlug({ code: point.code, chamber: "house" })}`}>{point.code}</Link></td>
                      <td className={point.census >= 0 ? "blue" : "red"}>{n.margin(point.census)}</td>
                      <td className={point.polls >= 0 ? "blue" : "red"}>{n.margin(point.polls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          <p className="cz-aside">{t("Where they part ways is where the district votes differently from what its demographics predict: a well-known incumbent, a candidate's local roots, or a community that has moved away from how similar places vote.")}</p>
        </div>
      </div>
    </div>
  );
}

export function CensusExplainer({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const census = data.benchmarks.find((row) => row.set === "census");
  const best = [...data.benchmarks].sort((a, b) => a.brier - b.brier)[0];
  const references = data.backtest.filter((year) => year.brier538 !== null);
  const redrawCensus = data.redraw.reduce((sum, row) => sum + row.census, 0);
  const redrawPres = data.redraw.reduce((sum, row) => sum + row.withPres, 0);

  return (
    <div className="cz" data-motion>
      <Hero data={data} />

      <SectionHead id="sees" n="01" kicker="What it sees" title="Twenty-two numbers per district" deck="For every district the model reads the American Community Survey: education, race and origin, age, marriage, income, home values, how people get to work, how dense the place is. It learns from 2012–2024 House results how those numbers map to votes, and then predicts each district from its profile alone." />
      <FeatureBars features={data.features} />
      <p className="cz-lede">{t("The single strongest signal is the share of white adults without a college degree: the more of them, the more Republican the district. Marriage comes next, then how many people ride public transit, a stand-in for how urban a place is. Income on its own barely matters once those are known.")}</p>

      <SectionHead id="track" n="02" kicker="Track record" title="Tested on five elections it had never seen" deck="Each election from 2016 to 2024 was predicted using only the cycles before it. Given the real national vote, the census alone calls about 94% of seats. Fully blind, guessing the national mood from history too, it still lands near the result in most years." />
      <BacktestChart years={data.backtest} />
      <div className="cz-table-wrap">
        <table className="cz-table">
          <thead>
            <tr><th>{t("Year")}</th><th>{t("Won by Democrats")}</th><th>{t("Census, real vote")}</th><th>{t("Census, blind")}</th><th>{t("Seats called")}</th><th>{t("Brier score")}</th></tr>
          </thead>
          <tbody>
            {data.backtest.map((year) => (
              <tr key={year.year}>
                <td>{year.year}</td><td>{year.actual}</td><td>{year.oracle}</td>
                <td>{year.sim} <small>({year.p10}–{year.p90})</small></td>
                <td>{n.percent(year.accuracy, 1)}</td><td>{n.fixed(year.brier, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cz-callout">
        <p className="eyebrow">{t("What 2018 taught it")}</p>
        <p>{t("The first version measured the national mood as the average margin across contested districts. In 2018 Democrats ran candidates almost everywhere, including deep-red seats, and that average said D+{contested} while the country voted D+{popular}. Switching to the national popular vote fixed most of the miss; the rest is suburbs that swung further than their earlier profile suggested.", { contested: n.fixed(data.lesson2018.meanContested), popular: n.fixed(data.lesson2018.popularVote) })}</p>
      </div>

      <SectionHead id="2026" n="03" kicker="2026" title="The census forecast for November 3" deck="Without polls, the national mood comes from history alone: start from the 2024 House popular vote and apply the average midterm swing against the president's party. That swing has ranged from a small gain to a 17-point loss, so the uncertainty is wide on purpose." />
      <div className="cz-2026">
        <SeatHistogram distribution={data.house.distribution} median={data.house.median} p10={data.house.p10} p90={data.house.p90} />
        <div className="cz-2026-side">
          <div className="cz-big-stats">
            <div><b className="blue">{data.house.median}</b><span>{t("Democratic seats, median")}</span></div>
            <div><b>{n.percent(data.house.pMajority)}</b><span>{t("chance of a Democratic majority")}</span></div>
            <div><b>{n.margin(data.national.mean)}</b><span>{t("assumed national vote (±{sd})", { sd: n.fixed(data.national.sd) })}</span></div>
          </div>
          <SwingBars swings={data.national.swings} />
        </div>
      </div>

      <SectionHead id="polls" n="04" kicker="Census vs polls" title="Where demographics and polls part ways" deck="The same districts scored by the census model and by MP-26, this site's poll-based forecast. Most land in the same corner. The ones that don't are the interesting ones." />
      <Disagreements data={data} />

      <SectionHead id="blind-spot" n="05" kicker="The blind spot" title="A census model cannot see a gerrymander" deck="Nine states vote on new maps this year. Map-drawers work from past election returns, precisely to exploit what demographics miss, such as Hispanic South Texas voting Republican. To the census the new lines barely matter; add 2024 presidential results by district and the redraws appear." />
      <RedrawBars rows={data.redraw} />
      <p className="cz-lede">{t("Net effect of the new maps: {census} expected Democratic seats with the census alone, {pres} once presidential results are added.", { census: `${redrawCensus >= 0 ? "+" : "−"}${n.fixed(Math.abs(redrawCensus))}`, pres: `${redrawPres >= 0 ? "+" : "−"}${n.fixed(Math.abs(redrawPres))}` })} <Link href="/gerrymandering">{t("How gerrymandering works →")}</Link></p>

      <SectionHead id="clues" n="06" kicker="Extra clues" title="What past votes and incumbents would add" deck="The same model, given extra information it deliberately does without. Each clue helps, but less than you might expect: most of what decides a House seat is already written in who lives there." />
      <div className="cz-table-wrap">
        <table className="cz-table cz-bench">
          <thead><tr><th>{t("Information used")}</th><th>{t("Brier score (lower is better)")}</th><th>{t("Seats called")}</th><th>{t("2026 Democratic seats")}</th><th>{t("Democratic majority")}</th></tr></thead>
          <tbody>
            {data.benchmarks.map((row) => (
              <tr key={row.set} className={row.set === "census" ? "on" : ""}>
                <td>{t(BENCHMARK_LABELS[row.set] ?? row.set)}</td><td>{n.fixed(row.brier, 3)}</td><td>{n.percent(row.accuracy, 1)}</td>
                <td>{row.median2026}</td><td>{n.percent(row.pMajority2026)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cz-lede">{t("With every clue the Brier score improves from {census} to {best}. For reference, in {years} the census alone scored {ours}, while MP-26 and FiveThirtyEight, built on polls, scored {mp26} and {fte}.", {
        census: n.fixed(census?.brier ?? 0, 3), best: n.fixed(best.brier, 3), years: references.map((year) => year.year).join(t(" and ")),
        ours: references.map((year) => n.fixed(year.brier, 3)).join(" / "), mp26: references.map((year) => year.brierMp26 === null ? "–" : n.fixed(year.brierMp26, 3)).join(" / "),
        fte: references.map((year) => n.fixed(year.brier538 ?? 0, 3)).join(" / "),
      })}</p>

      <SectionHead id="method" n="07" kicker="How it works" title="The fine print" deck="What the model does, where the data comes from, and where it is weaker than it looks." />
      <div className="cz-method">
        <article>
          <h3>{t("The model")}</h3>
          <p>{t("Each district's margin is the national House vote plus a structural term learned from its census profile and region. The structural term averages two learners: gradient-boosted trees, and a ridge regression whose leftovers are passed to a second set of trees. 20,000 simulations draw one national error shared by every seat and an independent error per district.")}</p>
        </article>
        <article>
          <h3>{t("The data")}</h3>
          <p>{t("American Community Survey 5-year estimates (2012–2024), each paired with the House election fought on the same district lines; House results and popular vote from FiveThirtyEight's election-results (CC BY 4.0); the 2026 maps from the Census Bureau's 120th Congress block file. Presidential results by district, used only in the comparison, come from The Downballot.")}</p>
        </article>
        <article>
          <h3>{t("Where it is weaker")}</h3>
          <p>{t("The trees learn to recognise districts they have seen before. On places the model has never seen, its district error rises from about {known} to about {unseen} points. Candidates, money and incumbency are invisible to it, and the national mood is a historical average, not a measurement.", { known: n.fixed(data.headline.rmse, 0), unseen: n.fixed(data.headline.stateHoldoutRmse, 0) })}</p>
        </article>
        <article>
          <h3>{t("Why build it")}</h3>
          <p>{t("Not to replace the poll-based forecast. It shows how much of American politics is already sorted by geography and demography, and the districts where that stops being true are where campaigns actually matter.")}</p>
        </article>
      </div>

      <div className="cz-cta">
        <p>{t("Demographics set the board. Campaigns play on the edges.")}</p>
        <div>
          <Link className="primary-action" href="/model">{t("See the poll-based forecast")}</Link>
          <Link className="secondary-action" href="/races?view=map">{t("Open the district map")} <span>→</span></Link>
        </div>
      </div>
    </div>
  );
}
