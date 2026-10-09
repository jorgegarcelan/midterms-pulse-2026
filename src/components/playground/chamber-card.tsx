"use client";

import { useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";

type Outlook = { controlD: number; median: number; interval80: [number, number]; distribution: { seats: number; frequency: number }[] };
type Props = {
  title: string;
  total: number;
  majority: number;
  outlook: Outlook | null;
  published: { demMajority: number; demSeats: number };
  domain: [number, number];
  bucket: number;
  note?: string;
};

// Majority odds, seat median and the full seat distribution for one chamber, all animated between scenarios.
export function ChamberCard({ title, total, majority, outlook, published, domain, bucket, note }: Props) {
  const t = useT();
  const dem = outlook ? Math.round(outlook.controlD * 1000) / 10 : published.demMajority;
  const demRounded = Math.round(dem);
  const seats = outlook?.median ?? published.demSeats;
  const change = Math.round(dem - published.demMajority);
  const seatChange = seats - published.demSeats;

  const bins: number[] = [];
  for (let value = domain[0]; value <= domain[1]; value += bucket) bins.push(value);
  const frequency = new Map<number, number>();
  for (const item of outlook?.distribution || []) {
    const key = Math.min(domain[1], Math.max(domain[0], Math.round(item.seats / bucket) * bucket));
    frequency.set(key, (frequency.get(key) || 0) + item.frequency);
  }
  const peak = Math.max(1, ...frequency.values());
  const width = 100 / bins.length;
  const majorityX = (majority - domain[0]) / (domain[1] - domain[0] + bucket) * 100;
  const favoured = dem >= 50 ? "D" : "R";

  return <article className="pg-chamber" data-favoured={favoured} aria-live="polite">
    <header>
      <p className="eyebrow">{title}</p>
      <span className="pg-chip">{t("{n} for majority", { n: majority })}</span>
    </header>
    <div className="pg-odds">
      <div className="pg-odds-side dem">
        <strong><CountUp value={demRounded} duration={600} />%</strong>
        <span>{t("Democratic majority")}</span>
      </div>
      <div className="pg-odds-side rep">
        <strong><CountUp value={100 - demRounded} duration={600} />%</strong>
        <span>{t("Republican majority")}</span>
      </div>
    </div>
    <div className="pg-tug" role="img" aria-label={t("{pct}% chance of a Democratic majority", { pct: demRounded })}>
      <i className="dem" style={{ width: `${dem}%` }} />
      <i className="rep" style={{ width: `${100 - dem}%` }} />
      <b />
    </div>
    <div className="pg-seat-line">
      <span><b className="dem-text">D <CountUp value={seats} duration={600} /></b> · <b className="rep-text"><CountUp value={total - seats} duration={600} /> R</b></span>
      <small>{outlook ? t("median · 80% range {low}–{high}", { low: outlook.interval80[0], high: outlook.interval80[1] }) : t("Simulating…")}</small>
    </div>
    <div className="pg-delta">
      {change === 0 && seatChange === 0
        ? <span>{t("Same as the published forecast")}</span>
        : <span>{t("vs forecast")}: <b className={change > 0 ? "dem-text" : change < 0 ? "rep-text" : ""}>{change > 0 ? "+" : change < 0 ? "−" : "±"}{Math.abs(change)} {t("pts")}</b> · <b className={seatChange > 0 ? "dem-text" : seatChange < 0 ? "rep-text" : ""}>{t("{n} D seats", { n: `${seatChange > 0 ? "+" : seatChange < 0 ? "−" : "±"}${Math.abs(seatChange)}` })}</b></span>}
    </div>
    <svg className="pg-hist" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={t("Distribution of simulated Democratic seats")}>
      {bins.map((value, index) => {
        const share = (frequency.get(value) || 0) / peak;
        return <rect key={value} x={index * width + width * .12} width={width * .76} y={0} height={40} className={value >= majority ? "dem" : "rep"} style={{ transform: `scaleY(${share})` }} />;
      })}
      <line x1={majorityX} x2={majorityX} y1={0} y2={40} />
    </svg>
    <div className="pg-hist-axis"><span>{domain[0]}</span><span>{t("{n} seats", { n: majority })}</span><span>{domain[1]}</span></div>
    {note && <p className="pg-card-note">{note}</p>}
  </article>;
}
