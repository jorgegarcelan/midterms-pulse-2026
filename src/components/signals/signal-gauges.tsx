"use client";

import { useEffect, useId, useState } from "react";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";

type Chamber = { demMajority: number; demSeats: number; repSeats: number };
type Market = { question: string; prices: number[] };
type MarketFeed = { events: { house: { url: string; markets: Market[] }; senate: { url: string; markets: Market[] } } };

function democraticPrice(markets?: Market[]) {
  const market = markets?.find((item) => /Democratic Party control/i.test(item.question));
  return market ? (market.prices[0] || 0) * 100 : null;
}

// Semicircle gauge: the model fills the arc, the market is a needle that springs into place.
function Gauge({ model, market }: { model: number; market: number | null }) {
  const angle = (value: number) => -90 + value * 1.8;
  const gradient = `gauge-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg className="gauge" viewBox="0 0 220 124" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" x2="1"><stop offset="0" stopColor="#3f6dff" /><stop offset="1" stopColor="#9fb8ff" /></linearGradient>
      </defs>
      <path className="gauge-track" d="M 20 110 A 90 90 0 0 1 200 110" pathLength={100} />
      <path className="gauge-value" d="M 20 110 A 90 90 0 0 1 200 110" pathLength={100} stroke={`url(#${gradient})`} style={{ strokeDasharray: `${model} 100` }} />
      {[0, 25, 50, 75, 100].map((tick) => <line key={tick} className="gauge-tick" x1="110" y1="14" x2="110" y2="22" transform={`rotate(${angle(tick)} 110 110)`} />)}
      {market !== null && <g className="gauge-needle" style={{ transform: `rotate(${angle(market)}deg)` }}>
        <line x1="110" y1="110" x2="110" y2="30" />
        <circle cx="110" cy="30" r="3.5" />
      </g>}
      <circle className="gauge-hub" cx="110" cy="110" r="5" />
    </svg>
  );
}

function SignalCard({ label, seats, chamber, total, majority, market, marketUrl }: { label: string; seats: string; chamber: Chamber; total: number; majority: number; market: number | null; marketUrl?: string }) {
  const t = useT();
  const gap = market === null ? null : market - chamber.demMajority;
  return (
    <article className="signal-card">
      <div className="card-kicker"><span>{label}</span><small>{seats}</small></div>
      <Gauge model={chamber.demMajority} market={market} />
      <div className="signal-readout">
        <div><span><i className="model-dot" />{t("Model")}</span><strong><CountUp value={chamber.demMajority} delay={200} />%</strong></div>
        <div><span><i className="market-dot" />{t("Market")}</span><strong>{market === null ? "—" : <><CountUp value={market} decimals={1} delay={300} />%</>}</strong></div>
      </div>
      <p className="signal-gap">{gap === null ? t("Prediction market unavailable right now.") : Math.abs(gap) < 2 ? t("Model and traders broadly agree.") : t(gap > 0 ? "Traders are {gap} pts more bullish on a Democratic majority than the model." : "Traders are {gap} pts less bullish on a Democratic majority than the model.", { gap: Math.abs(gap).toFixed(1) })}</p>
      <div className="seat-line"><b className="dem-text">D <CountUp value={chamber.demSeats} delay={400} /></b><i>{t("{majority} TO WIN", { majority })}</i><b className="rep-text"><CountUp value={chamber.repSeats} delay={400} /> R</b></div>
      <div className="party-bar" aria-label={t("{dem} Democratic and {rep} Republican seats", { dem: chamber.demSeats, rep: chamber.repSeats })}><span className="party-bar-dem" style={{ width: `${chamber.demSeats / total * 100}%` }} /><span className="party-bar-rep" style={{ width: `${chamber.repSeats / total * 100}%` }} /></div>
      {marketUrl && <Link className="signal-link" href="/markets">{t("Markets dashboard →")}</Link>}
    </article>
  );
}

// Model vs market: where the statistical forecast and traders disagree.
export function SignalGauges({ house, senate }: { house: Chamber; senate: Chamber }) {
  const t = useT();
  const [markets, setMarkets] = useState<MarketFeed | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/markets", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<MarketFeed> : null)
      .then((payload) => { if (payload?.events) setMarkets(payload); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return <>
    <SignalCard label={t("HOUSE CONTROL")} seats={t("{count} seats", { count: 435 })} chamber={house} total={435} majority={218} market={democraticPrice(markets?.events.house.markets)} marketUrl={markets?.events.house.url} />
    <SignalCard label={t("SENATE CONTROL")} seats={t("{count} seats", { count: 100 })} chamber={senate} total={100} majority={51} market={democraticPrice(markets?.events.senate.markets)} marketUrl={markets?.events.senate.url} />
  </>;
}
