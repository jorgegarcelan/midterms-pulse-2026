"use client";

import { useMemo, useRef, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { useNumber } from "@/components/census/census-charts";
import { stateByCode } from "@/data/geography";
import { averageProfile, FEATURE_LABELS, PROFILE_FORMAT, profileOf, REGION_STATES, type CensusModel, type CensusToy } from "@/lib/census-model";
import { raceSlug } from "@/lib/races";

const STATE_REGION = new Map(Object.entries(REGION_STATES).flatMap(([region, states]) => states.split(", ").map((state) => [state, region] as const)));

export function useProfileFormat() {
  const t = useT();
  const intl = useIntlLocale();
  const n = useNumber();
  return (key: string, value: number | null | undefined) => {
    if (value === null || value === undefined) return "–";
    const unit = PROFILE_FORMAT[key]?.unit ?? "%";
    if (unit === "%") return n.percent(value / 100, 1);
    if (unit === "years") return t("{n} years", { n: n.fixed(value) });
    if (unit === "$") return value.toLocaleString(intl, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    return value.toLocaleString(intl, { maximumFractionDigits: 0 });
  };
}

// "Lean Democratic", "Safe Republican"…: whole labels, so each translates with its own agreement.
const rating = (margin: number) => {
  const level = Math.abs(margin) < 3 ? "" : Math.abs(margin) < 8 ? "Lean" : Math.abs(margin) < 15 ? "Likely" : "Safe";
  return level ? `${level} ${margin >= 0 ? "Democratic" : "Republican"}` : "Toss-up";
};

/* ---------- The linear surrogate: one formula the reader can play with ---------- */

function toyContributions(toy: CensusToy, values: Record<string, number>) {
  return toy.variables.map((variable) => ({ key: variable.key, points: variable.coef * ((values[variable.key] ?? variable.mean) - variable.mean) / variable.sd }));
}

function toyMargin(toy: CensusToy, values: Record<string, number>, region: string, national: number) {
  const parts = toyContributions(toy, values);
  return { parts, base: national + toy.intercept + (toy.regions[region] ?? 0), region: toy.regions[region] ?? 0, total: national + toy.intercept + (toy.regions[region] ?? 0) + parts.reduce((sum, part) => sum + part.points, 0) };
}

function Contributions({ parts, labelOf }: { parts: { key: string; label: string; points: number }[]; labelOf?: (key: string) => string }) {
  const n = useNumber();
  const max = Math.max(4, ...parts.map((part) => Math.abs(part.points)));
  return (
    <ul className="cz-push">
      {[...parts].sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).map((part) => (
        <li key={part.key}>
          <span>{labelOf ? labelOf(part.key) : part.label}</span>
          <span className="cz-push-track" aria-hidden="true">
            <i className={part.points >= 0 ? "d" : "r"} style={{ width: `${Math.abs(part.points) / max * 50}%`, [part.points >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} />
          </span>
          <b className={part.points >= 0 ? "blue" : "red"}>{n.margin(part.points)}</b>
        </li>
      ))}
    </ul>
  );
}

export function PlayModel({ toy, fullRmse, national2024 }: { toy: CensusToy; fullRmse: number; national2024: number }) {
  const t = useT();
  const n = useNumber();
  const format = useProfileFormat();
  const start = toy.presets.find((preset) => preset.code === "VA-09") ?? toy.presets[0];
  const [values, setValues] = useState<Record<string, number>>(start.values);
  const [region, setRegion] = useState(start.division);
  // A real district is compared with its 2024 result, so it starts in the 2024 national mood.
  const [national, setNational] = useState(national2024);
  const [preset, setPreset] = useState<string | null>(start.code);
  const result = toyMargin(toy, values, region, national);
  const RACE = ["white", "black", "hispanic"];

  function change(key: string, value: number) {
    setPreset(null);
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (RACE.includes(key)) {
        // White, Black and Hispanic shares cannot add up to more than 100%: shrink the other two.
        const others = RACE.filter((other) => other !== key);
        const excess = RACE.reduce((sum, item) => sum + next[item], 0) - 100;
        const pool = others.reduce((sum, item) => sum + next[item], 0);
        if (excess > 0 && pool > 0) for (const other of others) next[other] = Math.max(0, next[other] - excess * next[other] / pool);
      }
      return next;
    });
  }
  const shown = (key: string, value: number) => key === "log_density" ? format("density", 10 ** value) : format(key, value);

  return (
    <div className="cz-play">
      <div className="cz-play-controls">
        <div className="cz-play-presets" role="group" aria-label={t("Start from a real district")}>
          <span>{t("Start from a real district:")}</span>
          {toy.presets.map((item) => (
            <button key={item.code} type="button" className={preset === item.code ? "on" : ""} aria-pressed={preset === item.code}
              onClick={() => { setValues(item.values); setRegion(item.division); setPreset(item.code); setNational(national2024); }}>{item.code}</button>
          ))}
        </div>
        {toy.variables.map((variable) => {
          const step = variable.key === "log_density" ? .05 : variable.key === "median_age" ? .1 : .5;
          return (
            <label key={variable.key} className="cz-slider">
              <span>{t(PROFILE_FORMAT[variable.key]?.label ?? variable.key)}</span>
              <b>{shown(variable.key, values[variable.key])}</b>
              <input type="range" min={variable.min} max={variable.max} step={step} value={values[variable.key]}
                onChange={(event) => change(variable.key, Number(event.target.value))} />
            </label>
          );
        })}
        <label className="cz-slider">
          <span>{t("Region")}</span>
          <select value={region} onChange={(event) => { setRegion(event.target.value); setPreset(null); }}>
            {Object.entries(REGION_STATES).map(([key, states]) => <option key={key} value={key}>{states}</option>)}
          </select>
        </label>
        <label className="cz-slider national">
          <span>{t("National mood")}</span>
          <b>{n.margin(national)}</b>
          <input type="range" min={-10} max={15} step={.1} value={national} onChange={(event) => setNational(Number(event.target.value))} />
          <span className="cz-mood">
            <button type="button" className={national === national2024 ? "on" : ""} onClick={() => setNational(national2024)}>{t("2024 ({margin})", { margin: n.margin(national2024) })}</button>
            <button type="button" className={national === toy.national2026 ? "on" : ""} onClick={() => setNational(toy.national2026)}>{t("2026 forecast ({margin})", { margin: n.margin(toy.national2026) })}</button>
          </span>
        </label>
      </div>
      <div className="cz-play-result" aria-live="polite">
        <p className="eyebrow">{t("The census would say")}</p>
        <b className={result.total >= 0 ? "blue" : "red"}>{n.margin(result.total)}</b>
        <span>{t(rating(result.total))}</span>
        {preset && (() => {
          const real = toy.presets.find((item) => item.code === preset);
          return real?.margin2024 !== null && real ? <p className="cz-play-real">{t("{code} actually voted {margin} in 2024, a year when the country voted {national}.", { code: real.code, margin: n.margin(real.margin2024!), national: n.margin(national2024) })}{national !== national2024 ? ` ${t("Set the national mood to 2024 to compare like with like.")}` : ""}</p> : null;
        })()}
        <p className="cz-play-base">{t("Starting point: national mood {national}, region {region}.", { national: n.margin(national), region: n.margin(result.region) })}</p>
        <Contributions parts={result.parts.map((part) => ({ ...part, label: t(PROFILE_FORMAT[part.key]?.label ?? part.key) }))} />
        <p className="cz-aside">{t("A simplified, linear version of the model with eight variables. It misses the 2024 districts by {toy} points on average; the full model, by {full}.", { toy: n.fixed(toy.rmse), full: n.fixed(fullRmse) })}</p>
      </div>
    </div>
  );
}

/* ---------- One district: its profile against the average district ---------- */

export function DistrictCard({ model, code, polls }: { model: CensusModel; code: string; polls: Map<string, number> | null }) {
  const t = useT();
  const n = useNumber();
  const format = useProfileFormat();
  const profile = profileOf(model, "2026", code);
  const average = useMemo(() => averageProfile(model, "2026"), [model]);
  const ranges = useMemo(() => Object.fromEntries(model.profileKeys.map((key, i) => {
    const values = Object.values(model.profiles2026).map((row) => row[i]).filter((value): value is number => value !== null);
    return [key, { min: Math.min(...values), max: Math.max(...values), all: values.sort((a, b) => a - b) }];
  })), [model]);
  const race = model.races.find((item) => item.code === code);
  const result2024 = model.results2024.find(([item]) => item === code);
  if (!profile || !race) return null;
  const state = code.slice(0, 2);
  const region = STATE_REGION.get(state) ?? "";
  const toyValues: Record<string, number> = { ...Object.fromEntries(model.toy.variables.map((variable) => [variable.key, (profile[variable.key] ?? variable.mean) as number])), log_density: Math.log10(profile.density ?? 100) };
  const push = toyMargin(model.toy, toyValues, region, model.national.mean);
  const poll = polls?.get(code);
  const scale = (key: string, value: number) => {
    const { min, max } = ranges[key];
    const position = key === "density" || key === "income" ? (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (value - min) / (max - min);
    return `${Math.max(0, Math.min(1, position)) * 100}%`;
  };
  const percentile = (key: string, value: number) => Math.round(ranges[key].all.filter((item) => item < value).length / ranges[key].all.length * 100);

  return (
    <article className="cz-card" aria-live="polite">
      <header>
        <div>
          <p className="eyebrow">{t(stateByCode.get(state)?.name || state)}{race.redrawn ? ` · ${t("new 2026 lines")}` : ""}</p>
          <h3>{code}</h3>
        </div>
        <div className="cz-card-margins">
          <div><span>{t("Census")}</span><b className={race.margin >= 0 ? "blue" : "red"}>{n.margin(race.margin)}</b></div>
          {poll !== undefined && <div><span>{t("Polls")}</span><b className={poll >= 0 ? "blue" : "red"}>{n.margin(poll)}</b></div>}
          {!race.redrawn && result2024?.[2] !== null && result2024 && <div><span>{t("2024 result")}</span><b className={result2024[2]! >= 0 ? "blue" : "red"}>{n.margin(result2024[2]!)}</b></div>}
        </div>
      </header>
      <ul className="cz-card-profile">
        {model.profileKeys.map((key) => {
          const value = profile[key];
          if (value === null) return null;
          return (
            <li key={key} title={t("higher than {p}% of districts", { p: percentile(key, value) })}>
              <span>{t(PROFILE_FORMAT[key]?.label ?? FEATURE_LABELS[key] ?? key)}</span>
              <b>{format(key, value)}</b>
              <span className="cz-card-track" aria-hidden="true">
                <i className="avg" style={{ left: scale(key, average[key]) }} />
                <i className="dot" style={{ left: scale(key, value) }} />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="cz-card-legend"><i className="dot" /> {t("this district")} <i className="avg" /> {t("average district")} <span>{t("bar: lowest to highest district")}</span>
        <Link href={`/races/${raceSlug({ code, chamber: "house" })}`}>{t("Open the race →")}</Link></p>
      <div className="cz-card-push">
        <p className="eyebrow">{t("What pushes it, in the simplified model")}</p>
        <Contributions parts={push.parts.map((part) => ({ ...part, label: t(PROFILE_FORMAT[part.key]?.label ?? part.key) }))} />
      </div>
    </article>
  );
}

/* ---------- One variable against the 2024 vote, for every district ---------- */

// Round tick values (1, 2, 5 × 10ⁿ steps) between lo and hi.
function niceTicks(lo: number, hi: number, count = 5) {
  const raw = (hi - lo) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / power;
  const step = (ratio >= 7.5 ? 10 : ratio >= 3.5 ? 5 : ratio >= 1.5 ? 2 : 1) * power;
  const ticks: number[] = [];
  for (let value = Math.ceil(lo / step) * step; value <= hi + 1e-9; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

const SCATTER_KEYS = ["white_noncollege", "married", "public_transport", "bachelors", "hispanic", "black", "median_age", "density", "income"];

export function VariableScatter({ model }: { model: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const format = useProfileFormat();
  const [key, setKey] = useState("white_noncollege");
  const [active, setActive] = useState<{ code: string; x: number; y: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const logScale = key === "density" || key === "income";
  const points = useMemo(() => model.results2024.flatMap(([code, , margin]) => {
    const value = profileOf(model, "2024", code)?.[key];
    return margin === null || value === null || value === undefined || value <= 0 ? [] : [{ code, x: value, y: margin }];
  }), [key, model]);
  const width = 640, height = 400, pad = { l: 46, r: 16, t: 16, b: 40 };
  const tx = (value: number) => logScale ? Math.log10(value) : value;
  const xs = points.map((point) => tx(point.x));
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const sx = (value: number) => pad.l + (tx(value) - lo) / (hi - lo || 1) * (width - pad.l - pad.r);
  const sy = (margin: number) => pad.t + (60 - Math.max(-60, Math.min(60, margin))) / 120 * (height - pad.t - pad.b);
  // Least-squares line and correlation on the plotted scale.
  const fit = useMemo(() => {
    const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = points.reduce((s, p) => s + p.y, 0) / points.length;
    let sxy = 0, sxx = 0, syy = 0;
    points.forEach((point, i) => { sxy += (xs[i] - mx) * (point.y - my); sxx += (xs[i] - mx) ** 2; syy += (point.y - my) ** 2; });
    return { slope: sxy / sxx, intercept: my - sxy / sxx * mx, r: sxy / Math.sqrt(sxx * syy) };
  }, [points, xs]);
  const ticks = logScale ? [1, 2, 3, 4, 5].map((power) => 10 ** power).filter((value) => tx(value) >= lo && tx(value) <= hi)
    : niceTicks(lo, hi);

  function nearest(event: React.PointerEvent<SVGSVGElement>) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const px = (event.clientX - box.left) / box.width * width, py = (event.clientY - box.top) / box.height * height;
    let best: { code: string; x: number; y: number } | null = null, distance = 18 * 18;
    for (const point of points) {
      const dx = sx(point.x) - px, dy = sy(point.y) - py;
      if (dx * dx + dy * dy < distance) { best = point; distance = dx * dx + dy * dy; }
    }
    setActive(best);
  }

  return (
    <figure className="cz-chart cz-vscatter">
      <div className="cz-pills" role="group" aria-label={t("Choose a variable")}>
        {SCATTER_KEYS.map((item) => <button key={item} type="button" className={item === key ? "on" : ""} aria-pressed={item === key} onClick={() => setKey(item)}>{t(PROFILE_FORMAT[item]?.label ?? item)}</button>)}
      </div>
      <div className="cz-vscatter-frame">
        <svg ref={svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t("{variable} against the 2024 House margin, every contested district", { variable: t(PROFILE_FORMAT[key]?.label ?? key) })}
          onPointerMove={nearest} onPointerLeave={() => setActive(null)}>
          <line x1={pad.l} x2={width - pad.r} y1={sy(0)} y2={sy(0)} className="cz-baseline" />
          {[-50, -25, 25, 50].map((tick) => <text key={tick} x={pad.l - 8} y={sy(tick) + 4} textAnchor="end" className="cz-axis">{n.margin(tick, 0)}</text>)}
          {ticks.map((tick) => <text key={tick} x={sx(tick)} y={height - pad.b + 22} textAnchor="middle" className="cz-axis">{format(key, tick)}</text>)}
          {points.map((point) => <circle key={point.code} cx={sx(point.x)} cy={sy(point.y)} r={active?.code === point.code ? 6 : 3.6} className={`cz-dot ${point.y >= 0 ? "d" : "r"}${active && active.code !== point.code ? " dim" : ""}`} />)}
          <line x1={sx(logScale ? 10 ** lo : lo)} x2={sx(logScale ? 10 ** hi : hi)} y1={sy(fit.intercept + fit.slope * lo)} y2={sy(fit.intercept + fit.slope * hi)} className="cz-fit" />
        </svg>
        {active && (
          <div className="cz-tip" style={{ left: `${sx(active.x) / width * 100}%`, top: `${sy(active.y) / height * 100}%` }} role="status">
            <b>{active.code}</b>
            <span>{t(PROFILE_FORMAT[key]?.label ?? key)}: {format(key, active.x)}</span>
            <span>{t("2024 House: {margin}", { margin: n.margin(active.y) })}</span>
          </div>
        )}
      </div>
      <figcaption>{t("Each dot is a district with both parties on the 2024 ballot. Line: the straight-line trend; correlation {r}.", { r: n.fixed(fit.r, 2) })}</figcaption>
    </figure>
  );
}

/* ---------- Twins: same profile, different states ---------- */

const TWIN_KEYS = ["white_noncollege", "bachelors", "married", "hispanic", "black", "median_age", "density"];

export function Twins({ model }: { model: CensusModel }) {
  const t = useT();
  const n = useNumber();
  const format = useProfileFormat();
  const groups: { kind: "alike" | "apart"; title: string; note: string }[] = [
    { kind: "alike", title: "Same profile, same vote", note: "Hundreds of miles apart, different states, different candidates: the census profile alone tells you how they vote." },
    { kind: "apart", title: "Same profile, different vote", note: "The exceptions: the profile matches but the vote does not. Local history, a candidate or a state party the census cannot see." },
  ];
  return (
    <div className="cz-twins">
      {groups.map((group) => (
        <section key={group.kind}>
          <h3>{t(group.title)}</h3>
          <p className="cz-aside">{t(group.note)}</p>
          <div className="cz-twin-list">
            {model.twins.filter((twin) => twin.kind === group.kind).map((twin) => {
              const a = profileOf(model, "2024", twin.a), b = profileOf(model, "2024", twin.b);
              return (
                <article key={`${twin.a}-${twin.b}`} className="cz-twin">
                  <div className="cz-twin-head">
                    {[[twin.a, twin.marginA], [twin.b, twin.marginB]].map(([code, margin]) => (
                      <div key={code as string}>
                        <span>{t(stateByCode.get((code as string).slice(0, 2))?.name || (code as string).slice(0, 2))}</span>
                        <h4>{code}</h4>
                        <b className={(margin as number) >= 0 ? "blue" : "red"}>{n.margin(margin as number)}</b>
                      </div>
                    ))}
                  </div>
                  <table>
                    <tbody>
                      {TWIN_KEYS.map((key) => (
                        <tr key={key}><th>{t(PROFILE_FORMAT[key]?.label ?? key)}</th><td>{format(key, a?.[key])}</td><td>{format(key, b?.[key])}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
