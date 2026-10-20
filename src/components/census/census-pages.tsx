"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";
import { ScrambleText } from "@/components/motion/scramble-text";
import { BacktestChart, DisagreementScatter, FeatureBars, RedrawBars, SeatHistogram, SenateStates, SwingBars, useNumber, type ScatterPoint } from "@/components/census/census-charts";
import { DistrictCard, PlayModel, Twins, VariableScatter } from "@/components/census/census-explore";
import { CensusMap, DivergingLegend, divergingFill } from "@/components/census/census-map";
import { stripLocale } from "@/i18n/config";
import type { CensusModel } from "@/lib/census-model";
import type { ModelResult } from "@/lib/model";

/* ============================================================
   Census-26's own section, built like MP-26's: one tab bar, one page per question.
   Forecast · How it works · Validation · Census vs polls · Limits · Sources
   ============================================================ */

export const CENSUS_TABS = [
  { href: "/census", label: "Forecast" },
  { href: "/census/how-it-works", label: "How it works" },
  { href: "/census/validation", label: "Validation" },
  { href: "/census/vs-polls", label: "Census vs polls" },
  { href: "/census/limits", label: "Limits" },
  { href: "/census/sources", label: "Sources" },
];

export function CensusTabs() {
  const t = useT();
  const path = stripLocale(usePathname());
  return (
    <nav className="model-tabs" aria-label="Census-26">
      <span className="model-tabs-title">Census-26</span>
      <div>{CENSUS_TABS.map((tab) => <Link key={tab.href} href={tab.href} className={path === tab.href ? "active" : ""} aria-current={path === tab.href ? "page" : undefined}>{t(tab.label)}</Link>)}</div>
    </nav>
  );
}

// The page after this one, so the section also reads front to back.
function NextPage({ current }: { current: string }) {
  const t = useT();
  const index = CENSUS_TABS.findIndex((tab) => tab.href === current);
  const next = CENSUS_TABS[index + 1];
  if (!next) return null;
  return (
    <Link className="cz-next" href={next.href}>
      <span>{t("Next")}</span>
      <b>{t(next.label)} <i aria-hidden="true">→</i></b>
    </Link>
  );
}

function PageHead({ kicker, title, deck }: { kicker: string; title: string; deck: string }) {
  const t = useT();
  return (
    <header className="cz-page-head">
      <p className="eyebrow cz-pill"><ScrambleText text={t(kicker)} delay={120} /></p>
      <h1>{t(title)}</h1>
      <p className="cz-deck">{t(deck)}</p>
    </header>
  );
}

function SectionHead({ id, n, kicker, title, deck }: { id?: string; n: string; kicker: string; title: string; deck: string }) {
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

type PollState = ModelResult | null | "error";

function usePolls() {
  const [model, setModel] = useState<PollState>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/model", { signal: controller.signal }).then((response) => response.ok ? response.json() as Promise<ModelResult> : Promise.reject())
      .then(setModel).catch(() => { if (!controller.signal.aborted) setModel("error"); });
    return () => controller.abort();
  }, []);
  const polls = useMemo(() => model && model !== "error" ? new Map(model.races.filter((race) => race.chamber === "house").map((race) => [race.code, race.signedMargin])) : null, [model]);
  return { model, polls };
}

/* ---------- Forecast ---------- */

export function CensusForecastPage({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const { polls } = usePolls();
  const [selected, setSelected] = useState("TX-09");
  const forecast = useMemo(() => new Map(data.races.map((race) => [race.code, race])), [data.races]);
  const { house, headline } = data;
  const senate = data.senateChamber;

  return (
    <div className="cz" data-motion>
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
          <div className="cz-hero-links">
            <Link className="primary-action" href="/census/how-it-works">{t("How it works")}</Link>
            <Link className="secondary-action" href="/census/validation">{t("How it did in 2016–2024")} <span>→</span></Link>
          </div>
        </div>
        <div className="cz-hero-card">
          <p className="eyebrow">{t("What the census says about November 3")}</p>
          <div className="cz-hero-numbers">
            <div><b className="blue">{house.median}</b><span>{t("Democratic House seats, median")}</span></div>
            <div><b>{n.percent(house.pMajority)}</b><span>{t("chance of a Democratic House majority")}</span></div>
          </div>
          <SeatHistogram distribution={house.distribution} median={house.median} p10={house.p10} p90={house.p90} compact />
          <p className="cz-hero-foot">{t("80% of simulations between {p10} and {p90} seats.", { p10: house.p10, p90: house.p90 })}
            {senate ? ` ${t("Senate: {median} Democratic seats ({p10}–{p90}), {p} chance of a majority.", { median: senate.median, p10: senate.p10, p90: senate.p90, p: n.percent(senate.pMajority) })}` : ""}</p>
        </div>
      </section>

      <SectionHead id="house" n="01" kicker="House" title="The House, district by district" deck="Every district on the November maps, scored from its census profile alone, plus a national mood taken from history: the 2024 House popular vote moved by the average midterm swing against the president's party." />
      <div className="cz-2026">
        <SeatHistogram distribution={house.distribution} median={house.median} p10={house.p10} p90={house.p90} />
        <div className="cz-2026-side">
          <div className="cz-big-stats">
            <div><b className="blue">{house.median}</b><span>{t("Democratic seats, median")}</span></div>
            <div><b>{n.percent(house.pMajority)}</b><span>{t("chance of a Democratic majority")}</span></div>
            <div><b>{n.margin(data.national.mean)}</b><span>{t("assumed national vote (±{sd})", { sd: n.fixed(data.national.sd) })}</span></div>
          </div>
          <p className="cz-aside">{t("Why the national mood is so uncertain, and where it comes from: ")}<Link href="/census/how-it-works#national">{t("the national mood →")}</Link></p>
        </div>
      </div>
      <div className="cz-map-grid">
        <div className="cz-map-panel">
          <DivergingLegend left={t("Republican")} right={t("Democratic")} cap={30} unit={t(" pts")} />
          <CensusMap lines="2026" selected={selected} onSelect={setSelected} label={t("Census forecast margin by district, November 2026 maps")}
            fill={(code) => divergingFill(forecast.get(code)?.margin, 30)}
            tip={(code) => { const race = forecast.get(code); return race ? <>
              <span>{t("Census: {margin}", { margin: n.margin(race.margin) })}</span>
              <span>{t("{p} chance of a Democratic win", { p: n.percent(race.pD) })}</span>
            </> : null; }} />
        </div>
        <DistrictCard model={data} code={selected} polls={polls} />
      </div>

      {data.senate && senate && <>
        <SectionHead id="senate" n="02" kicker="The Senate" title="The same census, state by state" deck="A state is the sum of its districts, so the Senate needs no new model: each state's margin is the average of the census margins of its districts on the November maps. The error per state is not assumed, it is measured on every Senate race since 2014, and it comes out larger than for a House district." />
        <div className="cz-2026">
          <SeatHistogram chamber="Senate" distribution={senate.distribution} median={senate.median} p10={senate.p10} p90={senate.p90}
            range={[38, 64]} majority={51} ticks={[40, 45, 50, 55, 60]} />
          <div className="cz-2026-side">
            <div className="cz-big-stats">
              <div><b className="blue">{senate.median}</b><span>{t("Democratic Senate seats, median ({p10}–{p90})", { p10: senate.p10, p90: senate.p90 })}</span></div>
              <div><b>{n.percent(senate.pMajority)}</b><span>{t("chance of a Democratic majority (51 seats)")}</span></div>
              <div><b>±{n.fixed(senate.localSd)}</b><span>{t("points of error per state, against ±{house} for a House district", { house: n.fixed(senate.houseLocalSd) })}</span></div>
            </div>
            <p className="cz-aside">{t("Not on the ballot: {d} Democratic and {r} Republican seats. Same national mood as the House ({national}), drawn once per simulation for every state.", { d: senate.notUp.D, r: senate.notUp.R, national: n.margin(senate.national) })}</p>
          </div>
        </div>
        <SenateStates races={data.senate} />
      </>}

      <div className="cz-cta">
        <p>{t("Demographics set the board. Campaigns play on the edges.")}</p>
        <div>
          <Link className="primary-action" href="/census/vs-polls">{t("Compare with the polls")}</Link>
          <Link className="secondary-action" href="/model">{t("See MP-26, the poll-based forecast")} <span>→</span></Link>
        </div>
      </div>
      <NextPage current="/census" />
    </div>
  );
}

/* ---------- How it works ---------- */

export function CensusHowPage({ data }: { data: CensusModel }) {
  const t = useT();
  return (
    <div className="cz" data-motion>
      <PageHead kicker="CENSUS-26 · HOW IT WORKS" title="How a census becomes a forecast" deck="The model reads 22 numbers about who lives in each district, learns from past House elections how those numbers map to votes, and adds a national mood taken from history. Here is each piece, and a version you can play with." />

      <SectionHead id="sees" n="01" kicker="What it sees" title="Twenty-two numbers per district" deck="For every district the model reads the American Community Survey: education, race and origin, age, marriage, income, home values, how people get to work, how dense the place is. It learns from 2012–2024 House results how those numbers map to votes, and then predicts each district from its profile alone." />
      <FeatureBars features={data.features} />
      <p className="cz-lede">{t("The single strongest signal is the share of white adults without a college degree: the more of them, the more Republican the district. Marriage comes next, then how many people ride public transit, a stand-in for how urban a place is. Income on its own barely matters once those are known.")}</p>
      <h3 className="cz-subhead">{t("See it for yourself")}</h3>
      <p className="cz-lede tight">{t("Pick a variable: every dot is a district, placed by that census number and by how it voted for the House in 2024.")}</p>
      <VariableScatter model={data} />

      <SectionHead id="twins" n="02" kicker="Twin districts" title="Same people, same vote?" deck="The model's bet is that places with the same census profile vote alike, wherever they are. These pairs of districts, in different states and regions, have almost identical profiles." />
      <Twins model={data} />

      <SectionHead id="play" n="03" kicker="Play the model" title="Build a district" deck="Move the sliders and the census tells you how your imaginary district would vote. Start from a real one, then change it: more graduates, fewer married couples, a denser city, another region." />
      <PlayModel toy={data.toy} fullRmse={data.headline.rmse} national2024={data.national.popularVote2024} />

      <SectionHead id="national" n="04" kicker="The national mood" title="The one number the census cannot give" deck="Demographics say which districts lean which way, not how big the wave is. Without polls, the national mood comes from history alone: start from the 2024 House popular vote and apply the average midterm swing against the president's party. That swing has ranged from a small gain to a 17-point loss, so the uncertainty is wide on purpose." />
      <div className="cz-national">
        <SwingBars swings={data.national.swings} />
        <NationalNote data={data} />
      </div>

      <SectionHead id="engine" n="05" kicker="The engine" title="From margins to seats" deck="Two learners, one formula, 20,000 simulated elections." />
      <div className="cz-method">
        <article>
          <h3>{t("The model")}</h3>
          <p>{t("Each district's margin is the national House vote plus a structural term learned from its census profile and region. The structural term averages two learners: gradient-boosted trees, and a ridge regression whose leftovers are passed to a second set of trees. 20,000 simulations draw one national error shared by every seat and an independent error per district.")}</p>
        </article>
        <article>
          <h3>{t("The Senate")}</h3>
          <p>{t("A state's margin is the average of its districts' census margins; single-district states are their district. Weighting districts by votes cast was tested and tied with equal weights. The state error is measured on every two-party Senate race since 2014 and the same national error is shared with the House.")}</p>
        </article>
      </div>
      <NextPage current="/census/how-it-works" />
    </div>
  );
}

function NationalNote({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  return (
    <div className="cz-big-stats single">
      <div><b>{n.margin(data.national.popularVote2024)}</b><span>{t("House popular vote in 2024")}</span></div>
      <div><b>{n.margin(data.national.mean)}</b><span>{t("assumed for 2026 (±{sd})", { sd: n.fixed(data.national.sd) })}</span></div>
    </div>
  );
}

/* ---------- Validation ---------- */

export function CensusValidationPage({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const results = useMemo(() => new Map(data.results2024.map(([code, predicted, actual]) => [code, { predicted, actual }])), [data.results2024]);
  const years = data.senateBacktest ?? [];
  const meanBrier = years.reduce((sum, year) => sum + year.brier, 0) / (years.length || 1);
  return (
    <div className="cz" data-motion>
      <PageHead kicker="CENSUS-26 · VALIDATION" title="Tested on elections it had never seen" deck="Each election from 2016 to 2024 was predicted using only the cycles before it, for the House and for the Senate, and scored against what happened." />

      <SectionHead id="house" n="01" kicker="House" title="Five House elections, predicted blind" deck="Given the real national vote, the census alone calls about 94% of seats. Fully blind, guessing the national mood from history too, it still lands near the result in most years." />
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

      <SectionHead id="misses" n="02" kicker="Where it missed" title="The 2024 misses, on the map" deck="The 2024 House result minus what the census predicted, trained only on 2012–2022. Blue districts voted more Democratic than their profile said; red ones, more Republican." />
      <div className="cz-map-panel wide">
        <DivergingLegend left={t("more Republican than predicted")} right={t("more Democratic than predicted")} cap={20} unit={t(" pts")} missing={t("No two-party race")} />
        <CensusMap lines="2024" label={t("2024 House result minus the census prediction, by district")}
          fill={(code) => { const r = results.get(code); return r && r.actual !== null ? divergingFill(r.actual - r.predicted, 20) : "#15171e"; }}
          tip={(code) => { const r = results.get(code); return r ? <>
            <span>{t("Census predicted {margin}", { margin: n.margin(r.predicted) })}</span>
            <span>{r.actual === null ? t("No two-party race") : t("Result {margin}", { margin: n.margin(r.actual) })}</span>
          </> : null; }} />
      </div>
      <p className="cz-lede">{t("The misses were not random. Diverse districts around New York, New Jersey, Florida and Texas voted clearly more Republican than their profile suggested, the 2024 shift among Hispanic, Asian and immigrant voters that earlier cycles could not teach the model. Much of the Pacific Northwest and the upper Midwest stayed more Democratic than expected.")}</p>

      {years.length > 0 && <>
        <SectionHead id="senate" n="03" kicker="The Senate" title="Five Senate cycles, predicted blind" deck="Every Senate race with a Democrat and a Republican on the ballot, scored the same way. Races where an independent or a third party was the real alternative are left out: there D − R does not measure the race." />
        <div className="cz-table-wrap">
          <table className="cz-table">
            <thead><tr><th>{t("Year")}</th><th>{t("Races")}</th><th>{t("Seats called")}</th><th>{t("Average miss (pts)")}</th><th>{t("Brier score")}</th><th>{t("MP-26 (polls)")}</th></tr></thead>
            <tbody>
              {years.map((year) => (
                <tr key={year.year}>
                  <td>{year.year}</td><td>{year.races}</td><td>{n.percent(year.accuracy, 1)}</td><td>{n.fixed(year.meanAbsError)}</td>
                  <td>{n.fixed(year.brier, 3)}</td><td>{year.brierMp26 === null ? "–" : n.fixed(year.brierMp26, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cz-lede">{t("Each year was predicted blind, using only earlier cycles. The Senate is harder than the House: one candidate on a statewide ballot weighs more than a district's profile. In 2018, its worst year, Democratic incumbents held on in states like Montana and West Virginia that their demographics gave to Republicans. Average Brier score: {brier}.", { brier: n.fixed(meanBrier, 3) })}</p>
      </>}
      <NextPage current="/census/validation" />
    </div>
  );
}

/* ---------- Census vs polls ---------- */

const AGREE_D = "color-mix(in srgb, #5b86ff 46%, #2b2f3a)";
const AGREE_R = "color-mix(in srgb, #ff5a6e 46%, #2b2f3a)";
const SPLIT = "#fbbf24";

export function CensusVsPollsPage({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const { model, polls } = usePolls();
  const [selected, setSelected] = useState("TX-09");
  const census = useMemo(() => new Map(data.races.map((race) => [race.code, race.margin])), [data.races]);
  const points = useMemo<ScatterPoint[]>(() => polls ? data.races.flatMap((race) => polls.has(race.code) ? [{ code: race.code, census: race.margin, polls: polls.get(race.code)! }] : []) : [], [data.races, polls]);
  const split = (censusD: boolean) => points.filter((point) => (point.census >= 0) === censusD && (point.polls >= 0) !== censusD)
    .sort((a, b) => Math.abs(b.census - b.polls) - Math.abs(a.census - a.polls)).slice(0, 6);
  const fill = (code: string) => {
    const a = census.get(code), b = polls?.get(code);
    if (a === undefined || b === undefined) return "#15171e";
    return (a >= 0) !== (b >= 0) ? SPLIT : a >= 0 ? AGREE_D : AGREE_R;
  };

  return (
    <div className="cz" data-motion>
      <PageHead kicker="CENSUS-26 · CENSUS VS POLLS" title="Where demographics and polls part ways" deck="The same districts scored by Census-26 and by MP-26, this site's poll-based forecast. Most land in the same corner. The ones that don't are where a candidate, a campaign or a changing community is beating the census." />
      {model === null && <p className="cz-wait">{t("Loading the poll-based forecast…")}</p>}
      {(model === "error" || (model && !points.length)) && <p className="cz-wait">{t("The poll-based forecast is not available right now, so the comparison cannot be drawn.")}</p>}
      {model && model !== "error" && polls && points.length > 0 && (
        <div className="cz-polls">
          <div className="cz-polls-stats">
            <div><b>{n.percent(points.filter((point) => (point.census >= 0) === (point.polls >= 0)).length / points.length)}</b><span>{t("of districts: both models pick the same party")}</span></div>
            <div><b>{model.house.demSeats}</b><span>{t("Democratic seats in the poll-based forecast (MP-26), against {census} from the census", { census: data.house.median })}</span></div>
            <div><b>{n.percent(model.house.demMajority / 100)}</b><span>{t("chance of a Democratic majority with polls, against {census} with the census", { census: n.percent(data.house.pMajority) })}</span></div>
          </div>
          <div className="cz-map-grid">
            <div className="cz-map-panel">
              <div className="cz-legend" aria-hidden="true">
                <span><i style={{ background: AGREE_D }} />{t("Both say Democratic")}</span>
                <span><i style={{ background: AGREE_R }} />{t("Both say Republican")}</span>
                <span><i style={{ background: SPLIT }} />{t("They disagree")}</span>
              </div>
              <CensusMap lines="2026" fill={fill} selected={selected} onSelect={setSelected} label={t("Where census and polls agree, by district")}
                tip={(code) => <><span>{t("Census: {margin}", { margin: n.margin(census.get(code) ?? 0) })}</span>{polls.has(code) && <span>{t("Polls (MP-26): {margin}", { margin: n.margin(polls.get(code)!) })}</span>}</>} />
            </div>
            <DistrictCard model={data} code={selected} polls={polls} />
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
                        <tr key={point.code} className={point.code === selected ? "on" : ""}>
                          <td><button type="button" onClick={() => setSelected(point.code)}>{point.code}</button></td>
                          <td className={point.census >= 0 ? "blue" : "red"}>{n.margin(point.census)}</td>
                          <td className={point.polls >= 0 ? "blue" : "red"}>{n.margin(point.polls)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
              <p className="cz-aside">{t("Where they part ways is where the district votes differently from what its demographics predict: a well-known incumbent, a candidate's local roots, or a community that has moved away from how similar places vote. Pick one to see its profile.")}</p>
            </div>
          </div>
        </div>
      )}
      <NextPage current="/census/vs-polls" />
    </div>
  );
}

/* ---------- Limits ---------- */

const BENCHMARK_LABELS: Record<string, string> = {
  census: "Census only (Census-26)",
  census_inc: "+ incumbent on the ballot",
  census_pres: "+ last presidential result",
  census_pres_inc: "+ both",
};

export function CensusLimitsPage({ data }: { data: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const census = data.benchmarks.find((row) => row.set === "census");
  const best = [...data.benchmarks].sort((a, b) => a.brier - b.brier)[0];
  const references = data.backtest.filter((year) => year.brier538 !== null);
  const redrawCensus = data.redraw.reduce((sum, row) => sum + row.census, 0);
  const redrawPres = data.redraw.reduce((sum, row) => sum + row.withPres, 0);
  const signed = (value: number) => `${value >= 0 ? "+" : "−"}${n.fixed(Math.abs(value))}`;
  return (
    <div className="cz" data-motion>
      <PageHead kicker="CENSUS-26 · LIMITS" title="What the census cannot see" deck="A model that knows only who lives in a place is blind to some things by design. Here is where that blindness shows, and how much the missing clues would add." />

      <SectionHead id="blind-spot" n="01" kicker="The blind spot" title="A census model cannot see a gerrymander" deck="Nine states vote on new maps this year. Map-drawers work from past election returns, precisely to exploit what demographics miss, such as Hispanic South Texas voting Republican. To the census the new lines barely matter; add 2024 presidential results by district and the redraws appear." />
      <RedrawBars rows={data.redraw} />
      <p className="cz-lede">{t("Net effect of the new maps: {census} expected Democratic seats with the census alone, {pres} once presidential results are added.", { census: signed(redrawCensus), pres: signed(redrawPres) })} <Link href="/gerrymandering">{t("How gerrymandering works →")}</Link></p>

      <SectionHead id="clues" n="02" kicker="Extra clues" title="What past votes and incumbents would add" deck="The same model, given extra information it deliberately does without. Each clue helps, but less than you might expect: most of what decides a House seat is already written in who lives there." />
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

      <SectionHead id="weaker" n="03" kicker="Fine print" title="Where it is weaker than it looks" deck="Three caveats to keep in mind when you read any Census-26 number." />
      <div className="cz-method three">
        <article>
          <h3>{t("It remembers districts")}</h3>
          <p>{t("The trees learn to recognise districts they have seen before. On places the model has never seen, its district error rises from about {known} to about {unseen} points.", { known: n.fixed(data.headline.rmse, 0), unseen: n.fixed(data.headline.stateHoldoutRmse, 0) })}</p>
        </article>
        <article>
          <h3>{t("It does not see candidates")}</h3>
          <p>{t("Candidates, money and incumbency are invisible to it. That is why the Senate, where one name on a statewide ballot weighs more, carries a larger error than a House district.")}</p>
        </article>
        <article>
          <h3>{t("The wave is a guess")}</h3>
          <p>{t("The national mood is a historical average, not a measurement. Since 2002 the swing against the president's party has ranged from a small gain to a 17-point loss, and every seat moves with it.")}</p>
        </article>
      </div>
      <p className="cz-lede">{t("Not to replace the poll-based forecast. It shows how much of American politics is already sorted by geography and demography, and the districts where that stops being true are where campaigns actually matter.")}</p>
      <NextPage current="/census/limits" />
    </div>
  );
}

/* ---------- Sources ---------- */

const PIPELINE = [
  ["01", "Census profiles", "ACS 5-year estimates by congressional district for 2012–2024 from the Census Bureau API, each release paired with the House election fought on the same lines (fetch_acs.py, build_dataset.py)."],
  ["02", "Results", "House and Senate results and the national House popular vote from FiveThirtyEight's election-results (national.py)."],
  ["03", "Model", "XGBoost and a two-stage Ridge-plus-trees learner, blended; chosen by blind backtest Brier score (train_backtest.py, structural.py)."],
  ["04", "2026 maps", "Nine redrawn states rebuilt from census tracts and 2020 blocks with the Census 120th Congress block file; boundaries from TIGER 2026 (redistrict.py, build_geometry_2026.py)."],
  ["05", "Senate", "District margins averaged by state, state error measured on 2014–2024 Senate races (senate.py)."],
  ["06", "Publish", "One JSON file for the site; every number on these pages comes from it (export_web.py)."],
];

const SOURCES = [
  { name: "Census Bureau · ACS", note: "American Community Survey 5-year, by district", href: "https://www.census.gov/data/developers/data-sets/acs-5year.html" },
  { name: "Census Bureau · 120th Congress", note: "Block equivalency file for the 2026 maps", href: "https://www.census.gov/geographies/mapping-files/2027/dec/rdo/120-congressional-district-bef.html" },
  { name: "Census Bureau · TIGER/Line", note: "2026 district boundaries and Gazetteer areas", href: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html" },
  { name: "FiveThirtyEight", note: "election-results: House and Senate, CC BY 4.0", href: "https://github.com/fivethirtyeight/election-results" },
  { name: "The Downballot", note: "Presidential results by district (benchmarks only)", href: "https://www.the-downballot.com/p/the-downballots-calculations-of-presidential" },
];

export function CensusSourcesPage({ data }: { data: CensusModel }) {
  const t = useT();
  return (
    <div className="cz cz-sources">
      <section className="page-intro"><div><p className="eyebrow">{t("CENSUS-26 · SOURCES")}</p><h1>{t("Data and method")}</h1><p>{t("Where every Census-26 number comes from, and the steps between the raw census and the published probability.")}</p></div></section>
      <section className="methodology-layout">
        <article className="panel pipeline-panel"><p className="eyebrow">{t("MODEL PIPELINE")}</p><h2>{t("From raw census to published probability")}</h2>
          <div className="pipeline-list">{PIPELINE.map(([index, title, text]) => <div key={index}><span>{index}</span><h3>{t(title)}</h3><p>{t(text)}</p></div>)}</div>
        </article>
        <aside className="panel methodology-side"><p className="eyebrow">{t("CURRENT STATUS")}</p><h2>{t("Experimental · {date}", { date: data.generated })}</h2>
          <p>{t("Census-26 is a research model, not a second forecast to bet on. It runs offline in Python and is published as a static file; it does not read polls or markets at any step.")}</p>
          <ul>
            <li>{t("Every run is seeded and reproducible.")}</li>
            <li>{t("Each backtest year is trained only on earlier cycles.")}</li>
            <li>{t("Presidential results and incumbency appear only as benchmarks, never in the forecast.")}</li>
            <li>{t("The code and data pipeline live in census-model/ in the repository.")}</li>
          </ul>
          <Link className="primary-action" href="/census/how-it-works">{t("See how it works")}</Link>
        </aside>
      </section>
      <section className="panel source-register"><div className="panel-head"><div><p className="eyebrow">{t("SOURCE REGISTER")}</p><h2>{t("Primary inputs")}</h2></div></div>
        <div className="source-grid">{SOURCES.map((source) => <a key={source.name} href={source.href} target="_blank" rel="noreferrer"><strong>{source.name}</strong><span>{t(source.note)}</span></a>)}</div>
      </section>
    </div>
  );
}
