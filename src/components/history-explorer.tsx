"use client";

import { useMemo, useState } from "react";
import { electionCycles, historicalMargins } from "@/data/history";
import { StateTileMap } from "@/components/state-tile-map";
import { useT } from "@/components/i18n/locale-provider";

export function HistoryExplorer() {
  const t = useT();
  const [year, setYear] = useState(2018);
  const cycle = useMemo(() => electionCycles.find((item) => item.year === year) || electionCycles[0], [year]);
  const maxChange = Math.max(...electionCycles.map((item) => Math.abs(item.demChange)));

  return (
    <>
      <section className="page-intro">
        <div><p className="eyebrow">{t("ELECTION ARCHIVE · 2010–2024")}</p><h1>{t("Historical comparison")}</h1><p>{t("House swings, turnout and state-level movement across eight federal election cycles.")}</p></div>
        <div className="stat-stamp"><strong>08</strong><span>{t("federal cycles")}</span><small>{t("House control + key states")}</small></div>
      </section>

      <section className="panel history-timeline-panel">
        <div className="panel-head"><div><p className="eyebrow">{t("HOUSE SEAT CHANGE")}</p><h2>{t("Change by election cycle")}</h2></div><span className="panel-tag">{t("Democratic change")}</span></div>
        <div className="swing-chart">
          {electionCycles.map((item) => {
            const width = Math.max(5, Math.abs(item.demChange) / maxChange * 48);
            return <button key={item.year} className={year === item.year ? "active" : ""} onClick={() => setYear(item.year)}><span>{item.year}</span><div className="swing-track"><i className={item.demChange >= 0 ? "dem" : "rep"} style={item.demChange >= 0 ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }} /></div><strong className={item.demChange >= 0 ? "dem-text" : "rep-text"}>{item.demChange > 0 ? "+" : ""}{item.demChange}</strong></button>;
          })}
        </div>
      </section>

      <section className="split-grid history-detail-grid">
        <article className="panel history-map-panel">
          <div className="panel-head"><div><p className="eyebrow">{t("KEY-STATE MARGIN INDEX")}</p><h2>{t("{year} electoral geography", { year })}</h2></div><div className="cycle-selector">{electionCycles.map((item) => <button className={year === item.year ? "active" : ""} key={item.year} onClick={() => setYear(item.year)}>{String(item.year).slice(2)}</button>)}</div></div>
          <StateTileMap values={historicalMargins[year]} label={t("{year} two-party margin in selected states", { year })} />
          <p className="chart-note">{t("Presidential margins in presidential years; statewide House-vote directional index in midterm years. Neutral tiles are outside this prototype subset.")}</p>
        </article>
        <aside className="panel cycle-card">
          <p className="eyebrow">{t("SELECTED CYCLE")}</p><div className="cycle-year">{cycle.year}</div><h2>{t(cycle.note)}</h2>
          <div className="control-composition"><div><span>{t("Democrats")}</span><strong className="dem-text">{cycle.demSeats}</strong></div><div><span>{t("Republicans")}</span><strong className="rep-text">{cycle.repSeats}</strong></div></div>
          <div className="composition-bar"><i className="dem" style={{ width: `${cycle.demSeats / 4.35}%` }} /><i className="rep" style={{ width: `${cycle.repSeats / 4.35}%` }} /></div>
          <dl><div><dt>{t("Democratic seat change")}</dt><dd className={cycle.demChange >= 0 ? "dem-text" : "rep-text"}>{cycle.demChange > 0 ? "+" : ""}{cycle.demChange}</dd></div><div><dt>{t("Voting-eligible turnout")}</dt><dd>{cycle.turnout}%</dd></div><div><dt>{t("House control")}</dt><dd>{cycle.demSeats > cycle.repSeats ? t("Democratic") : t("Republican")}</dd></div></dl>
        </aside>
      </section>

      <section className="panel context-table-panel"><div className="panel-head"><div><p className="eyebrow">{t("CYCLE CONTEXT")}</p><h2>{t("Composition at a glance")}</h2></div><a href="https://history.house.gov/Institution/Election-Statistics/Election-Statistics/" target="_blank" rel="noreferrer">{t("House election statistics ↗")}</a></div><div className="history-table"><div className="history-table-head"><span>{t("Year")}</span><span>{t("D seats")}</span><span>{t("R seats")}</span><span>{t("D change")}</span><span>{t("Turnout")}</span><span>{t("Signal")}</span></div>{electionCycles.map((item) => <button key={item.year} onClick={() => setYear(item.year)}><strong>{item.year}</strong><span className="dem-text">{item.demSeats}</span><span className="rep-text">{item.repSeats}</span><span>{item.demChange > 0 ? "+" : ""}{item.demChange}</span><span>{item.turnout}%</span><span>{t(item.note)}</span></button>)}</div></section>
    </>
  );
}
