"use client";

import { useMemo, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { forecastRegions, presidentialRegions, shareBand, type RegionPoint } from "@/lib/geography";
import type { RegionKey } from "@/data/regions";

export type Lens = "2016" | "2020" | "2024" | "house" | "senate";
type Race = { chamber: string; state: string; demProbability: number };

const tone = (band: string) => band.endsWith("D") ? "dem" : band.endsWith("R") ? "rep" : "toss";

/*
  Six routes through the map: each region's position on one shared D ← 50/50 → R scale. For a past
  presidential year it is the share of the region's electoral votes won by Republicans; for 2026 it is
  the expected Republican share of its House seats or Senate races (sum of the model's race odds).
*/
export function RegionalAxes({ presidential, races, lens, onLens, focus, onFocus }: {
  presidential: Record<string, Map<string, number>>; races: Race[]; lens: Lens; onLens: (lens: Lens) => void; focus: RegionKey | null; onFocus: (key: RegionKey | null) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<RegionKey | null>(null);
  const points: RegionPoint[] = useMemo(() => lens === "house" || lens === "senate" ? forecastRegions(races, lens) : presidentialRegions(presidential[lens] ?? new Map()), [lens, presidential, races]);
  const unit = lens === "house" ? t("seats") : lens === "senate" ? t("Senate races") : t("EV");
  const lenses: { key: Lens; label: string }[] = [{ key: "2016", label: "2016" }, { key: "2020", label: "2020" }, { key: "2024", label: "2024" }, { key: "house", label: t("House 2026") }, { key: "senate", label: t("Senate 2026") }];

  return <div className="regional-axes">
    <div className="regional-lens" role="tablist" aria-label={t("What to measure")}>{lenses.map((item) => <button key={item.key} role="tab" aria-selected={lens === item.key} className={lens === item.key ? "active" : ""} onClick={() => onLens(item.key)}>{item.label}</button>)}</div>
    <p className="regional-note">{lens === "house" || lens === "senate"
      ? t("Each dot is the expected Republican share of the region's {unit} in the 2026 forecast: the sum of the model's race odds, not the chance of winning the region as a bloc.", { unit })
      : t("Each dot is the share of the region's electoral votes won by Republicans in {year}. It compares regional direction on one shared scale.", { year: lens })}</p>
    <div className="regional-scale">
      <div className="regional-scale-labels"><span className="dem-text">{t("Democratic advantage")}</span><span>50 / 50</span><span className="rep-text">{t("Republican advantage")}</span></div>
      <div className="regional-track">
        <i className="regional-mid" />
        {points.map((point) => <button key={point.key} type="button" className={`regional-dot ${tone(shareBand(point.share))}${focus && focus !== point.key ? " dim" : ""}`} style={{ left: `${point.share}%` }} onPointerEnter={() => onFocus(point.key)} onPointerLeave={() => onFocus(null)} onClick={() => setOpen(open === point.key ? null : point.key)} aria-label={`${t(point.name)}: ${Math.round(point.share)}% R`}><span>{t(point.name)}</span></button>)}
      </div>
    </div>
    <div className="regional-cards">
      {points.map((point) => {
        const band = shareBand(point.share);
        return <article key={point.key} className={`regional-card${focus === point.key ? " focus" : ""}${open === point.key ? " open" : ""}`} onPointerEnter={() => onFocus(point.key)} onPointerLeave={() => onFocus(null)}>
          <header><h3>{t(point.name)}</h3><span className={`regional-band ${tone(band)}`}>{t(band)}</span></header>
          <p>{t(point.blurb)}</p>
          <div className="regional-meter"><i style={{ width: `${100 - point.share}%` }} className="dem" /><i style={{ width: `${point.share}%` }} className="rep" /></div>
          <dl>
            <div><dt>{t("Weighted R")}</dt><dd>{Math.round(point.share)}%</dd></div>
            <div><dt>{lens === "house" || lens === "senate" ? t("Expected R {unit}", { unit }) : t("R electoral votes")}</dt><dd>{point.expectedR.toFixed(lens === "house" || lens === "senate" ? 1 : 0)} / {point.size}</dd></div>
            <div><dt>{t("Leaning")}</dt><dd><span className="rep-text">{point.rLeaning} R</span> · <span className="dem-text">{point.dLeaning} D</span></dd></div>
          </dl>
          <p className="regional-states">{point.states.join(" · ")}</p>
        </article>;
      })}
    </div>
  </div>;
}
