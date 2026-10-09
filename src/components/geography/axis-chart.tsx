"use client";

import { useT } from "@/components/i18n/locale-provider";
import { aggregate, signed, YEARS, type Axis, type County } from "@/lib/geography";

const SPAN = 60; // the scale runs from R+60 to D+60
const x = (value: number) => 50 + Math.max(-SPAN, Math.min(SPAN, value)) / SPAN * 50;

/*
  One row per bucket of an axis: where its vote sat in 2016, 2020 and 2024 on one D ← → R scale, with
  the swing drawn as a path, and the bucket's share of the national vote. Hovering a row highlights its
  counties on the map.
*/
export function AxisChart({ axis, counties, active, onActive }: { axis: Axis; counties: County[]; active: string | null; onActive: (key: string | null) => void }) {
  const t = useT();
  const total = aggregate(counties, "v24").total;
  const rows = axis.buckets.map((bucket) => {
    const members = counties.filter(bucket.test);
    const years = YEARS.map((year) => aggregate(members, year.key).margin);
    return { bucket, count: members.length, share: aggregate(members, "v24").total / total * 100, years };
  });

  return <div className="axis-chart" onPointerLeave={() => onActive(null)}>
    <div className="axis-scale" aria-hidden="true"><span className="dem-text">D+60</span><span>{t("EVEN")}</span><span className="rep-text">R+60</span></div>
    {rows.map(({ bucket, count, share, years }) => {
      const [y16, y20, y24] = years;
      const swing = y24 - y16;
      return <button type="button" key={bucket.key} className={`axis-row${active === bucket.key ? " active" : ""}${active && active !== bucket.key ? " dim" : ""}`} onPointerEnter={() => onActive(bucket.key)} onFocus={() => onActive(bucket.key)} onClick={() => onActive(active === bucket.key ? null : bucket.key)}>
        <span className="axis-label"><b>{t(bucket.label)}</b><small>{t(bucket.note)} · {t("{n} counties", { n: count })} · {t("{share}% of the vote", { share: share.toFixed(0) })}</small></span>
        <span className="axis-track">
          <i className="axis-mid" />
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true"><path d={`M${100 - x(y16)},10 L${100 - x(y20)},10 L${100 - x(y24)},10`} className={swing >= 0 ? "swing-d" : "swing-r"} /></svg>
          {years.map((value, index) => <i key={YEARS[index].key} className={`axis-dot y${index}`} style={{ left: `${100 - x(value)}%` }} title={`${YEARS[index].label}: ${signed(value)}`} />)}
          <em style={{ left: `${100 - x(y24)}%` }} className={y24 >= 0 ? "dem-text" : "rep-text"}>{signed(y24, 0)}</em>
        </span>
        <span className={`axis-swing ${swing >= 0 ? "dem-text" : "rep-text"}`}>{swing >= 0 ? "←" : "→"} {Math.abs(swing).toFixed(1)}<small>{t("since 2016")}</small></span>
      </button>;
    })}
    <p className="axis-key"><i className="y0" />2016 <i className="y1" />2020 <i className="y2" />2024 · {t(axis.source)}</p>
  </div>;
}
