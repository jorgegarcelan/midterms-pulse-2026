import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { stateByCode } from "@/data/geography";
import { intlLocale, isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import { expertBook, RATERS, type ExpertBook } from "@/lib/expert-ratings";
import type { ForecastRace } from "@/lib/forecast";
import { baselineRun, fetchBenchmarkHouseHistory, fetchRun, fetchRunIndex, type RunSummary } from "@/lib/forecast-history";
import { modelRatingLabel } from "@/lib/expert-ratings";
import { getModel } from "@/lib/model-server";
import { raceSlug } from "@/lib/races";

export const revalidate = 900;

const WINDOWS = [1, 7, 30] as const;
const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");
const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const delta = (value: number, unit = "") => `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value)}${unit}`;
const demP = (race: ForecastRace) => (race.leader === "D" ? race.winProbability : 100 - race.winProbability);

export async function generateMetadata({ params }: PageProps<"/[lang]/changes">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return { title: t("What changed — Midterm Pulse 2026"), description: t("How the forecast has moved: chamber odds over time, the races that moved most and the handicappers' rating changes.") };
}

// A small server-rendered line chart: one or two series over dates, with an optional reference line.
function LineChart({ series, dates, min, max, reference, unit, label }: { series: { key: string; values: (number | null)[]; className: string }[]; dates: string[]; min: number; max: number; reference?: number; unit: string; label: string }) {
  const width = 640, height = 200, pad = { top: 12, right: 44, bottom: 24, left: 8 };
  const x = (index: number) => pad.left + (dates.length < 2 ? (width - pad.left - pad.right) / 2 : index / (dates.length - 1) * (width - pad.left - pad.right));
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
  return <svg className="changes-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    {reference !== undefined && <><line x1={pad.left} x2={width - pad.right} y1={y(reference)} y2={y(reference)} className="changes-ref" /><text x={width - pad.right + 6} y={y(reference) + 4}>{reference}{unit}</text></>}
    {series.map((item) => {
      const points = item.values.map((value, index) => value === null ? null : [x(index), y(value)] as const).filter((point): point is readonly [number, number] => point !== null);
      const last = points.at(-1);
      const lastValue = item.values.filter((value) => value !== null).at(-1);
      return <g key={item.key} className={item.className}>
        {points.length > 1 && <path d={points.map(([px, py], index) => `${index ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ")} />}
        {points.map(([px, py], index) => <circle key={index} cx={px} cy={py} r={points.length > 40 ? 0 : 3} />)}
        {last && <text x={last[0] + 6} y={last[1] + 4}>{lastValue}{unit}</text>}
      </g>;
    })}
    {dates.length > 0 && <><text x={pad.left} y={height - 6} className="changes-axis">{dates[0]}</text>{dates.length > 1 && <text x={width - pad.right} y={height - 6} textAnchor="end" className="changes-axis">{dates.at(-1)}</text>}</>}
  </svg>;
}

export default async function ChangesPage({ params, searchParams }: PageProps<"/[lang]/changes">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  const query = await searchParams;
  const span = WINDOWS.find((days) => String(days) === query.vs) ?? 7;
  const [model, index, benchmark] = await Promise.all([getModel(), fetchRunIndex(), fetchBenchmarkHouseHistory()]);

  // Today's published run joins the archive so the charts and comparisons always end at the live numbers.
  const today: RunSummary = { date: model.runDate, version: model.version, ballot: model.genericBallot.margin, house: { p: model.house.demMajority, seats: model.house.demSeats, low: model.house.interval80[0], high: model.house.interval80[1] }, senate: { p: model.senate.demMajority, seats: model.senate.demSeats, low: model.senate.interval80[0], high: model.senate.interval80[1] } };
  const runs = [...index.filter((run) => run.date !== today.date), today].sort((a, b) => a.date.localeCompare(b.date));
  const baseSummary = baselineRun(runs, today.date, span);
  const base = baseSummary ? await fetchRun(baseSummary.date) : null;
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(intlLocale(lang), { day: "numeric", month: "long", timeZone: "UTC" });
  const stateName = (code: string) => t(stateByCode.get(code)?.name || code);
  const raceLabel = (race: ForecastRace) => race.chamber === "senate" ? t("{state} Senate", { state: stateName(race.state) }) : race.code;

  const before = new Map((base?.races || []).map(([chamber, code, margin, p]) => [`${chamber === "S" ? "senate" : "house"}-${code}`, { margin, p }]));
  const moves = model.races.flatMap((race) => {
    const old = before.get(`${race.chamber}-${race.code}`);
    return old ? [{ race, old, p: demP(race), change: demP(race) - old.p }] : [];
  });
  const movers = moves.filter((move) => Math.abs(move.change) >= 1).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 15);
  const crossed = moves.filter((move) => (move.old.p >= 50) !== (move.p >= 50));
  const bandChanges = moves.filter((move) => modelRatingLabel(move.old.p) !== modelRatingLabel(move.p));

  const raterChanges = base?.ratings ? model.races.flatMap((race) => {
    const old = (race.chamber === "senate" ? base.ratings!.senate : base.ratings!.house)[race.code] as ExpertBook | undefined;
    const now = expertBook(race);
    if (!old || !now?.listed) return [];
    return RATERS.flatMap((rater) => old[rater.key] && now.book[rater.key] && old[rater.key] !== now.book[rater.key] ? [{ race, rater: rater.short, from: old[rater.key]!, to: now.book[rater.key]! }] : []);
  }) : [];

  const dates = runs.map((run) => run.date);
  const houseChange = base ? today.house.p - base.house.p : 0;
  const senateChange = base ? today.senate.p - base.senate.p : 0;

  return <main className="page-main"><div className="content-shell changes-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("FORECAST HISTORY")}</p>
      <h1>{t("What changed")}</h1>
      <p>{base
        ? t("The forecast today against {date}: chamber odds, the races that moved most, races that changed favourite and the handicappers' rating changes.", { date: dateLabel(base.date) })
        : t("The archive started on {date}. From tomorrow this page compares each day's forecast with earlier runs; until then it shows today's numbers and the benchmark's own House history.", { date: dateLabel(runs[0].date) })}</p>
    </div>
    <nav className="changes-windows" aria-label={t("Compare with")}>{WINDOWS.map((days) => <Link key={days} href={`/changes?vs=${days}`} className={days === span ? "active" : ""}>{days === 1 ? t("1 day") : t("{n} days", { n: days })}</Link>)}</nav>
    </section>

    <section className="changes-kpis">
      {[{ label: t("House · D majority"), now: today.house.p, change: houseChange }, { label: t("Senate · D majority"), now: today.senate.p, change: senateChange }].map((item) => <article key={item.label} className="panel"><span>{item.label}</span><strong>{item.now}%</strong>{base && <small className={item.change > 0 ? "dem-text" : item.change < 0 ? "rep-text" : ""}>{delta(item.change, " pts")} {t("since {date}", { date: dateLabel(base.date) })}</small>}</article>)}
      <article className="panel"><span>{t("Generic ballot")}</span><strong>{signed(today.ballot)}</strong>{base && <small>{t("was {value}", { value: signed(base.ballot) })}</small>}</article>
      <article className="panel"><span>{t("Races that changed favourite")}</span><strong>{base ? crossed.length : "—"}</strong>{base && <small>{t("{n} changed rating band", { n: bandChanges.length })}</small>}</article>
    </section>

    <section className="changes-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("MP-26 · CHAMBER ODDS")}</p><h2>{t("Chance of a Democratic majority")}</h2></div></div>
        <LineChart dates={dates} min={0} max={100} reference={50} unit="%" label={t("Chance of a Democratic majority")} series={[{ key: "house", values: runs.map((run) => run.house.p), className: "series-house" }, { key: "senate", values: runs.map((run) => run.senate.p), className: "series-senate" }]} />
        <p className="changes-legend"><i className="series-house" />{t("House")} <i className="series-senate" />{t("Senate")} · {t("{n} archived runs", { n: runs.length })}</p>
      </article>
      {benchmark.length > 1 && <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("VOTE-SCOPE BENCHMARK")}</p><h2>{t("Mean Democratic House seats")}</h2></div></div>
        <LineChart dates={benchmark.map((run) => run.date)} min={Math.min(210, ...benchmark.map((run) => run.seats)) - 4} max={Math.max(226, ...benchmark.map((run) => run.seats)) + 4} reference={218} unit="" label={t("Mean Democratic House seats")} series={[{ key: "bench", values: benchmark.map((run) => run.seats), className: "series-house" }]} />
        <p className="changes-legend">{t("The benchmark the model starts from, last {n} runs. 218 is a majority.", { n: benchmark.length })}</p>
      </article>}
    </section>

    {base && <section className="changes-grid">
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("BIGGEST MOVES")}</p><h2>{t("Races that moved most")}</h2></div></div>
        {movers.length ? <div className="changes-table">{movers.map(({ race, old, p, change }) => <Link key={`${race.chamber}-${race.code}`} href={`/races/${raceSlug(race)}`}>
          <b>{raceLabel(race)}</b><span>{signed(old.margin)} → {signed(race.signedMargin)}</span><span>{old.p}% → {p}% D</span><em className={change > 0 ? "dem-text" : "rep-text"}>{delta(change, " pts")}</em>
        </Link>)}</div> : <p className="changes-empty">{t("No race moved by a point or more.")}</p>}
      </article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">{t("HANDICAPPERS")}</p><h2>{t("Rating changes")}</h2></div></div>
        {raterChanges.length ? <div className="changes-table">{raterChanges.map(({ race, rater, from, to }) => <Link key={`${race.chamber}-${race.code}-${rater}`} href={`/races/${raceSlug(race)}`}>
          <b>{raceLabel(race)}</b><span>{rater}</span><span>{t(from)} → {t(to)}</span><em />
        </Link>)}</div> : <p className="changes-empty">{t("Cook, Inside Elections and Sabato have not changed any rating in this window.")}</p>}
        {crossed.length > 0 && <><h3 className="changes-sub">{t("New favourite")}</h3><div className="changes-table">{crossed.map(({ race, old, p }) => <Link key={`x-${race.chamber}-${race.code}`} href={`/races/${raceSlug(race)}`}><b>{raceLabel(race)}</b><span>{old.p}% → {p}% D</span><span>{p >= 50 ? t("now leans D") : t("now leans R")}</span><em /></Link>)}</div></>}
      </article>
    </section>}
    <SiteFooter />
  </div></main>;
}
