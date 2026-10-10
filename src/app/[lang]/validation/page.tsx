import type { Metadata } from "next";
import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import backtest from "@/data/backtest.json";
import { intlLocale, isLocale, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/translate";
import "./validation.css";

type Chamber = { n: number; brier: number; brier538: number; accuracy: number; mp26: { pD: number; median: number; low: number; high: number }; fte: { pD: number; median: number; low: number; high: number } | null; actual: number; majority: number };
type Year = { house: Chamber; senate: Chamber; meanMiss: number; rmse: number };
const YEARS = backtest.years as unknown as Record<"2018" | "2022", Year>;
const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "es");
const pct = (value: number) => `${Math.round(value * 100)}%`;

export async function generateMetadata({ params }: PageProps<"/[lang]/validation">): Promise<Metadata> {
  const t = getT(localeOf((await params).lang));
  return { title: t("Model validation — Midterm Pulse 2026"), description: t("How MP-26's probability engine would have done in the 2018 and 2022 midterms: seat intervals, calibration and race-level scores.") };
}

// One chamber outcome: the 80% interval as a bar, the median and the actual result as markers.
function IntervalRow({ label, chamber, t }: { label: string; chamber: Chamber; t: (text: string, vars?: Record<string, string | number>) => string }) {
  const lo = Math.min(chamber.mp26.low, chamber.fte?.low ?? Infinity, chamber.actual) - 8;
  const hi = Math.max(chamber.mp26.high, chamber.fte?.high ?? -Infinity, chamber.actual) + 8;
  const x = (seats: number) => `${(seats - lo) / (hi - lo) * 100}%`;
  const inside = chamber.actual >= chamber.mp26.low && chamber.actual <= chamber.mp26.high;
  const favourite = chamber.mp26.pD >= .5 ? "D" : "R";
  const won = chamber.actual >= chamber.majority ? "D" : "R";
  return <div className="val-row">
    <div className="val-row-label"><b>{label}</b><span>{t("D majority {p} · actual {n} D seats", { p: pct(chamber.mp26.pD), n: chamber.actual })}</span></div>
    <div className="val-track" role="img" aria-label={t("80% interval {low}–{high}, median {median}, actual {actual}", { low: chamber.mp26.low, high: chamber.mp26.high, median: chamber.mp26.median, actual: chamber.actual })}>
      <i className="val-majority" style={{ left: x(chamber.majority) }}><small>{chamber.majority}</small></i>
      {chamber.fte && <span className="val-band fte" style={{ left: x(chamber.fte.low), width: `calc(${x(chamber.fte.high)} - ${x(chamber.fte.low)})` }} />}
      <span className="val-band" style={{ left: x(chamber.mp26.low), width: `calc(${x(chamber.mp26.high)} - ${x(chamber.mp26.low)})` }} />
      <i className="val-median" style={{ left: x(chamber.mp26.median) }} />
      <i className="val-actual" style={{ left: x(chamber.actual) }}><small>{chamber.actual}</small></i>
    </div>
    <div className="val-verdict"><span className={inside ? "ok" : "miss"}>{inside ? t("Inside the 80% interval") : t("Outside the interval")}</span><span className={favourite === won ? "ok" : "miss"}>{favourite === won ? t("Favourite won") : t("Upset")}</span></div>
  </div>;
}

export default async function ValidationPage({ params }: PageProps<"/[lang]/validation">) {
  const lang = localeOf((await params).lang);
  const t = getT(lang);
  const number = (value: number, digits = 3) => value.toLocaleString(intlLocale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const overall = backtest.overall;
  const intervals = Object.values(YEARS).flatMap((year) => [year.house, year.senate]);
  const insideCount = intervals.filter((chamber) => chamber.actual >= chamber.mp26.low && chamber.actual <= chamber.mp26.high).length;

  // Reliability diagram and margin scatter geometry.
  const size = 300, pad = 34;
  const cx = (p: number) => pad + p * (size - pad * 1.4);
  const cy = (p: number) => size - pad - p * (size - pad * 1.4);
  const range = 40;
  const sx = (m: number) => pad + (Math.max(-range, Math.min(range, m)) + range) / (2 * range) * (size - pad * 1.4);
  const sy = (m: number) => size - pad - (Math.max(-range, Math.min(range, m)) + range) / (2 * range) * (size - pad * 1.4);
  const best = [...backtest.sweep].sort((a, b) => a.logLoss - b.logLoss)[0];
  const current = backtest.sweep.find((item) => item.sd === backtest.engine.raceSd)!;

  return <main className="page-main"><div className="content-shell val-shell">
    <section className="page-intro"><div>
      <p className="eyebrow">{t("MODEL VALIDATION · 2018 AND 2022")}</p>
      <h1>{t("Would MP-26 have got it right?")}</h1>
      <p>{t("We replayed MP-26's probability engine on the last two midterms: the same per-race error, the same shared national error and the same 50,000-run simulation the live forecast uses, fed with each race's final expected margin from FiveThirtyEight's published forecasts. Then we compared it with what actually happened.")}</p>
    </div><div className="stat-stamp"><strong>{insideCount}/{intervals.length}</strong><span>{t("chamber results inside the 80% interval")}</span><small>{t("{n} races scored", { n: overall.all.n })}</small></div></section>

    <section className="val-kpis">
      <article className="panel"><span>{t("Races called right")}</span><strong>{pct(overall.all.accuracy)}</strong><small>{t("{n} in the closest races", { n: pct(overall.competitive.accuracy) })}</small></article>
      <article className="panel"><span>{t("Brier score (lower is better)")}</span><strong>{number(overall.all.brier)}</strong><small>{t("FiveThirtyEight's own odds: {v}", { v: number(overall.all.brier538) })}</small></article>
      <article className="panel"><span>{t("Typical race miss")}</span><strong>±{number((YEARS["2018"].rmse + YEARS["2022"].rmse) / 2, 1)}</strong><small>{t("points of margin, root mean square")}</small></article>
      <article className="panel"><span>{t("National miss")}</span><strong>{t("{a} / {b}", { a: `${YEARS["2018"].meanMiss > 0 ? "D" : "R"}+${Math.abs(YEARS["2018"].meanMiss)}`, b: `${YEARS["2022"].meanMiss > 0 ? "D" : "R"}+${Math.abs(YEARS["2022"].meanMiss)}` })}</strong><small>{t("average miss in 2018 / 2022: the error every race shares")}</small></article>
    </section>

    <section className="panel val-chambers">
      <div className="panel-head"><div><p className="eyebrow">{t("CHAMBERS")}</p><h2>{t("Seat intervals against the result")}</h2></div><p className="val-legend"><i className="band" />{t("MP-26 80% interval")} <i className="band fte" />{t("FiveThirtyEight 80%")} <i className="median" />{t("median")} <i className="actual" />{t("actual")}</p></div>
      {(["2018", "2022"] as const).map((year) => <div key={year} className="val-year"><h3>{year}</h3><IntervalRow label={t("House")} chamber={YEARS[year].house} t={t} /><IntervalRow label={t("Senate")} chamber={YEARS[year].senate} t={t} /></div>)}
    </section>

    <section className="val-grid">
      <article className="panel">
        <p className="eyebrow">{t("CALIBRATION")}</p>
        <h2>{t("Do 30% races happen 30% of the time?")}</h2>
        <svg className="val-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("Calibration chart")}>
          <line x1={cx(0)} y1={cy(0)} x2={cx(1)} y2={cy(1)} className="val-diagonal" />
          {[0, .25, .5, .75, 1].map((p) => <g key={p}><text x={cx(p)} y={size - 12} textAnchor="middle">{pct(p)}</text><text x={14} y={cy(p) + 4}>{pct(p)}</text></g>)}
          {backtest.calibration.filter((bin) => bin.observed !== null).map((bin) => <circle key={bin.low} cx={cx(bin.forecast)} cy={cy(bin.observed!)} r={3 + Math.sqrt(bin.n) * 1.6} className="val-bin"><title>{t("Forecast {f} · observed {o} · {n} races", { f: pct(bin.forecast), o: pct(bin.observed!), n: bin.n })}</title></circle>)}
        </svg>
        <p className="val-caption">{t("Each dot groups the competitive races (5–95%) by forecast. Dots below the diagonal on the left and above it on the right mean the engine was too cautious: favourites won more often than it said.")}</p>
      </article>
      <article className="panel">
        <p className="eyebrow">{t("RACE BY RACE")}</p>
        <h2>{t("Expected margin vs. result")}</h2>
        <svg className="val-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t("Expected against actual margins")}>
          <line x1={sx(-range)} y1={sy(-range)} x2={sx(range)} y2={sy(range)} className="val-diagonal" />
          <line x1={sx(0)} y1={sy(-range)} x2={sx(0)} y2={sy(range)} className="val-axis" />
          <line x1={sx(-range)} y1={sy(0)} x2={sx(range)} y2={sy(0)} className="val-axis" />
          {[-40, -20, 0, 20, 40].map((m) => <g key={m}><text x={sx(m)} y={size - 12} textAnchor="middle">{m === 0 ? "0" : `${m > 0 ? "D" : "R"}+${Math.abs(m)}`}</text></g>)}
          {(backtest.points as [number, string, string, number, number, number][]).map(([year, chamber, code, expected, actual, demWon]) => <circle key={`${year}${chamber}${code}`} cx={sx(expected)} cy={sy(actual)} r={chamber === "S" ? 3.4 : 2} className={`val-point y${year}${(expected >= 0) !== (demWon === 1) ? " upset" : ""}`}><title>{`${year} ${chamber === "S" ? `${code} Senate` : code}: ${expected >= 0 ? "D" : "R"}+${Math.abs(expected)} → ${actual >= 0 ? "D" : "R"}+${Math.abs(actual)}`}</title></circle>)}
        </svg>
        <p className="val-caption">{t("Each dot is a contested race: the final expected margin (across) against the actual one (up). Gold rings mark races the favourite lost.")} <span className="val-key"><i className="y2018" />2018 <i className="y2022" />2022</span></p>
      </article>
    </section>

    <section className="panel val-findings">
      <p className="eyebrow">{t("WHAT WE LEARNED")}</p>
      <h2>{t("Findings and limits")}</h2>
      <ul>
        <li><b>{t("Chambers: well calibrated.")}</b> {t("All four results fell inside MP-26's 80% interval, and the favourite won all four chambers, the 2022 Senate by a hair: Democrats were at 51%.")}</li>
        <li><b>{t("Races: on par, slightly cautious.")}</b> {t("Race-level scores are within a whisker of FiveThirtyEight's own odds on the same inputs. The engine's ±{sd} points of error is more than the day-before forecasts needed: the best-scoring error was ±{best}. We keep ±{sd} because the live forecast runs weeks before the election, when uncertainty is larger.", { sd: backtest.engine.raceSd, best: best.sd })}</li>
        <li><b>{t("What this does not test.")}</b> {t("Vote-Scope, MP-26's benchmark, did not publish 2018 or 2022 forecasts, so the inputs here are FiveThirtyEight's. This validates the probability engine, not the benchmark the live model starts from. The model stays labelled experimental.")}</li>
      </ul>
      <p className="val-caption">{t("Log loss at ±{sd}: {a}; at ±{best}: {b}.", { sd: backtest.engine.raceSd, a: number(current.logLoss), best: best.sd, b: number(best.logLoss) })} {t(backtest.source)}</p>
      <div className="val-actions"><Link href="/how-it-works">{t("How the model works →")}</Link><Link href="/methodology">{t("Sources and methodology →")}</Link></div>
    </section>
    <SiteFooter />
  </div></main>;
}
