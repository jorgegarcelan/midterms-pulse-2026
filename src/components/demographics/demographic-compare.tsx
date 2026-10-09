"use client";

import { districtPercentile, METRICS, RACE_GROUPS, type DemographicProfile, type Demographics } from "@/lib/race-data";
import { useInView } from "@/components/explainer/use-in-view";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";

type Geo = { key: string; label: string; profile: DemographicProfile };

// Census profile: each indicator groups one bar per geography on a shared scale; district rows add a percentile.
export function DemographicCompare({ geos, demographics, percentileFor }: { geos: Geo[]; demographics: Demographics; percentileFor?: DemographicProfile }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const t = useT();
  const intl = useIntlLocale();
  return (
    <div className="demographics" ref={ref} data-in={inView ? "true" : undefined}>
      <div className="demo-legend">{geos.map((geo, index) => <span key={geo.key}><i className={`geo-${index}`} />{geo.label}</span>)}</div>
      {METRICS.map((metric, row) => {
        const values = geos.map((geo) => geo.profile[metric.key]);
        const max = Math.max(...values.map((value) => value ?? 0), 1);
        const percentile = percentileFor && percentileFor[metric.key] !== null && metric.key !== "population" ? districtPercentile(demographics, metric.key, percentileFor[metric.key]!) : null;
        return (
          <div className="demo-row" key={metric.key} style={{ "--r": row } as React.CSSProperties}>
            <span className="demo-label">{t(metric.label)}{metric.hint && <small>{t(metric.hint)}</small>}{percentile !== null && <em title={t("Share of the 435 districts with a lower value")}>{t("{ordinal} pct. of districts", { ordinal: ordinal(percentile), value: percentile })}</em>}</span>
            {metric.key === "population"
              ? <div className="demo-values">{values.map((value, index) => <span key={geos[index].key} className={`geo-${index}`}><i />{value === null ? "—" : metric.format(value, intl)}</span>)}</div>
              : <div className="demo-bars">{values.map((value, index) => (
                <div key={geos[index].key} className={`demo-bar geo-${index}`} title={`${geos[index].label}: ${value === null ? "—" : metric.format(value, intl)}`}>
                  <span className="demo-track"><i style={{ "--w": `${(value ?? 0) / max * 100}%` } as React.CSSProperties} /></span>
                  <strong>{value === null ? "—" : metric.format(value, intl)}</strong>
                </div>
              ))}</div>}
          </div>
        );
      })}
      <div className="demo-race">
        <p>{t("Race and ethnicity")}</p>
        {geos.map((geo) => (
          <div className="race-bar-row" key={geo.key}>
            <span>{geo.label}</span>
            <div className="race-bar" role="img" aria-label={`${geo.label}: ${RACE_GROUPS.map((group) => `${t(group.label)} ${geo.profile.race[group.key] ?? 0}%`).join(", ")}`}>
              {RACE_GROUPS.map((group) => <i key={group.key} className={`race-${group.key}`} style={{ flexGrow: geo.profile.race[group.key] ?? 0 }} title={`${t(group.label)}: ${geo.profile.race[group.key] ?? "—"}%`}>{(geo.profile.race[group.key] ?? 0) >= 9 ? `${Math.round(geo.profile.race[group.key]!)}%` : ""}</i>)}
            </div>
          </div>
        ))}
        <div className="race-legend">{RACE_GROUPS.map((group) => <span key={group.key}><i className={`race-${group.key}`} />{t(group.label)}</span>)}</div>
      </div>
      <p className="chart-note">{t("{release} estimates · U.S. Census Bureau American Community Survey via Census Reporter. White, Black and Asian exclude Hispanic residents.", { release: demographics.release })}</p>
    </div>
  );
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] || "th";
  return `${value}${suffix}`;
}
