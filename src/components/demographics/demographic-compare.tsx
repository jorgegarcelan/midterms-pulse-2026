"use client";

import "@/app/motion-b.css";
import { useState } from "react";
import { districtPercentile, METRICS, RACE_GROUPS, type DemographicProfile, type Demographics } from "@/lib/race-data";
import { useInView } from "@/components/explainer/use-in-view";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

type Geo = { key: string; label: string; profile: DemographicProfile };
type Group = (typeof RACE_GROUPS)[number]["key"];

// Census profile: each indicator groups one bar per geography on a shared scale; district rows add a percentile.
// Legend entries highlight (hover) or hide (click) a geography; hovering a row shows the gap to the last geography;
// hovering a race segment compares that group across every geography.
export function DemographicCompare({ geos, demographics, percentileFor }: { geos: Geo[]; demographics: Demographics; percentileFor?: DemographicProfile }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const t = useT();
  const intl = useIntlLocale();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<number | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const reference = geos.length > 1 ? geos.at(-1)! : null;

  function toggle(key: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else if (geos.length - next.size > 1) next.add(key);
      return next;
    });
  }

  const delta = (metric: (typeof METRICS)[number], value: number | null, base: number | null) => {
    if (value === null || base === null || !reference) return null;
    const percentLike = metric.key !== "medianIncome" && metric.key !== "medianAge";
    const diff = percentLike ? value - base : base ? (value / base - 1) * 100 : 0;
    if (Math.abs(diff) < .05) return { text: t("same as {place}", { place: reference.label }), tone: "even" };
    const amount = `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString(intl, { maximumFractionDigits: 1 })}${percentLike ? ` ${t("pts")}` : "%"}`;
    return { text: t("{delta} vs. {place}", { delta: amount, place: reference.label }), tone: diff > 0 ? "up" : "down" };
  };

  return (
    <div className={`demographics mpb-demographics${focus !== null ? ` focus-geo focus-geo-${focus}` : ""}${group ? " focus-group" : ""}`} ref={ref} data-in={inView ? "true" : undefined}>
      <div className="demo-legend">{geos.map((geo, index) => (
        <button
          type="button"
          key={geo.key}
          className={hidden.has(geo.key) ? "off" : undefined}
          aria-pressed={!hidden.has(geo.key)}
          onClick={() => toggle(geo.key)}
          onPointerEnter={() => setFocus(index)}
          onPointerLeave={() => setFocus(null)}
          onFocus={() => setFocus(index)}
          onBlur={() => setFocus(null)}
        ><i className={`geo-${index}`} />{geo.label}</button>
      ))}</div>
      {METRICS.map((metric, row) => {
        const values = geos.map((geo) => geo.profile[metric.key]);
        const max = Math.max(...values.map((value, index) => hidden.has(geos[index].key) ? 0 : value ?? 0), 1);
        const percentile = percentileFor && percentileFor[metric.key] !== null && metric.key !== "population" ? districtPercentile(demographics, metric.key, percentileFor[metric.key]!) : null;
        const gap = geos.length > 1 && metric.key !== "population" ? delta(metric, values[0], values.at(-1) ?? null) : null;
        return (
          <div className="demo-row" key={metric.key} style={{ "--r": row } as React.CSSProperties}>
            <span className="demo-label">{t(metric.label)}{metric.hint && <small>{t(metric.hint)}</small>}{percentile !== null && <em title={t("Share of the 435 districts with a lower value")}>{t("{ordinal} pct. of districts", { ordinal: ordinal(percentile), value: percentile })}</em>}{gap && <b className={`demo-delta ${gap.tone}`}>{geos[0].label} · {gap.text}</b>}</span>
            {metric.key === "population"
              ? <div className="demo-values">{values.map((value, index) => <span key={geos[index].key} className={`geo-${index}${hidden.has(geos[index].key) ? " off" : ""}`}><i />{value === null ? "—" : metric.format(value, intl)}</span>)}</div>
              : <div className="demo-bars">{values.map((value, index) => (
                <div key={geos[index].key} className={`demo-bar geo-${index}${hidden.has(geos[index].key) ? " off" : ""}`} title={`${geos[index].label}: ${value === null ? "—" : metric.format(value, intl)}`}>
                  <span className="demo-track"><i style={{ "--w": `${hidden.has(geos[index].key) ? 0 : (value ?? 0) / max * 100}%` } as React.CSSProperties} /></span>
                  <strong>{value === null ? "—" : metric.format(value, intl)}</strong>
                </div>
              ))}</div>}
          </div>
        );
      })}
      <div className="demo-race" onPointerLeave={() => setGroup(null)}>
        <p>{t("Race and ethnicity")}</p>
        {geos.map((geo, index) => (
          <div className={`race-bar-row${hidden.has(geo.key) ? " off" : ""}`} key={geo.key} style={{ "--r": index } as React.CSSProperties}>
            <span>{geo.label}</span>
            <div className="race-bar" role="img" aria-label={`${geo.label}: ${RACE_GROUPS.map((item) => `${t(item.label)} ${geo.profile.race[item.key] ?? 0}%`).join(", ")}`}>
              {RACE_GROUPS.map((item) => <i key={item.key} className={`race-${item.key}${group === item.key ? " lit" : ""}`} style={{ flexGrow: geo.profile.race[item.key] ?? 0 }} onPointerEnter={() => setGroup(item.key)} title={`${t(item.label)}: ${geo.profile.race[item.key] ?? "—"}%`}>{(geo.profile.race[item.key] ?? 0) >= 9 ? `${Math.round(geo.profile.race[item.key]!)}%` : ""}</i>)}
            </div>
          </div>
        ))}
        <div className="race-legend">{RACE_GROUPS.map((item) => (
          <button type="button" key={item.key} className={group === item.key ? "lit" : undefined} onPointerEnter={() => setGroup(item.key)} onFocus={() => setGroup(item.key)} onBlur={() => setGroup(null)} onClick={() => setGroup((current) => current === item.key ? null : item.key)}><i className={`race-${item.key}`} />{t(item.label)}</button>
        ))}</div>
        <p className={`race-compare${group ? " show" : ""}`} aria-live="polite">
          {group && <><b>{t(RACE_GROUPS.find((item) => item.key === group)!.label)}</b>{geos.map((geo, index) => <span key={geo.key} className={`geo-${index}`}>{geo.label} <strong>{geo.profile.race[group] ?? "—"}%</strong></span>)}</>}
        </p>
      </div>
      <p className="chart-note">{t("{release} estimates · U.S. Census Bureau American Community Survey via Census Reporter. White, Black and Asian exclude Hispanic residents.", { release: demographics.release })}</p>
    </div>
  );
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] || "th";
  return `${value}${suffix}`;
}
