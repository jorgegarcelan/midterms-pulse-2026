"use client";

import { useEffect, useState } from "react";
import { MarginHistoryChart, type HistoryPoint } from "@/components/charts/margin-history-chart";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { loadHouseHistory, loadPresidentHistory, loadSenateHistory, type HistoryResult } from "@/lib/race-data";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const PARTY = { D: "Democrat", R: "Republican", O: "Other" } as const;

function toPoint(result: HistoryResult, office: string): HistoryPoint {
  const unopposed = result.u === 1;
  return {
    year: result.y,
    margin: unopposed ? (result.w === "D" ? 100 : result.w === "R" ? -100 : result.m) : result.m,
    winner: result.w,
    hollow: unopposed,
    title: `${result.y}${result.s ? " special" : ""} · ${office}`,
    detail: `${result.n || PARTY[result.w]} (${PARTY[result.w]}) won${unopposed ? " unopposed" : ` · D ${result.dp}% · R ${result.rp}%`}`,
  };
}

// Past results for this seat (House district or Senate state), with the 2026 model as the last point.
export function RaceHistory({ race }: { race: ForecastRace }) {
  const [data, setData] = useState<{ points: HistoryPoint[]; context?: { label: string; points: { year: number; margin: number }[] } } | null>(null);
  const [failed, setFailed] = useState(false);
  const stateName = stateByCode.get(race.state)?.name || race.state;

  useEffect(() => {
    let cancelled = false;
    const task = race.chamber === "house"
      ? loadHouseHistory(race.state).then((file) => ({ points: (file.districts[race.code] || []).map((result) => toPoint(result, "House")) }))
      : Promise.all([loadSenateHistory(), loadPresidentHistory()]).then(([senate, president]) => ({
        points: (senate.states[race.state] || []).filter((result) => result.y >= 1990).map((result) => toPoint(result, "Senate")),
        context: { label: `Presidential margin in ${stateName}`, points: (president.states[race.state] || []).filter((result) => result.y >= 1990).map((result) => ({ year: result.y, margin: result.m })) },
      }));
    task.then((next) => { if (!cancelled) setData(next); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [race.chamber, race.code, race.state, stateName]);

  const house = race.chamber === "house";
  return (
    <article className="panel race-history">
      <div className="panel-head">
        <div><p className="eyebrow">Results over time</p><h2>{house ? `${race.code} since 2000` : `${stateName} Senate since 1990`}</h2></div>
        <span className="panel-tag">{house ? "FiveThirtyEight" : "538 · MIT Election Lab"}</span>
      </div>
      {failed ? <p className="table-empty">Historical results could not be loaded.</p>
        : !data ? <div className="chart-loading">Loading results…</div>
          : data.points.length === 0 ? <p className="table-empty">No historical results found for this seat.</p>
            : <MarginHistoryChart
              points={data.points}
              label={house ? "House" : "Senate"}
              context={data.context}
              forecast={{ year: 2026, margin: race.signedMargin, label: `2026 model ${signed(race.signedMargin)}` }}
              markers={house ? [{ year: 2002, label: "new maps" }, { year: 2012, label: "new maps" }, { year: 2022, label: "new maps" }] : []}
              ariaLabel={`${house ? race.code : `${stateName} Senate`} results over time with the 2026 forecast`}
            />}
      <p className="chart-note">{house
        ? "District lines are redrawn after each census (2002, 2012, 2022) and some states redrew mid-decade, so earlier results may cover different territory. Hollow dots are uncontested seats."
        : "Both Senate seats in the state are shown, including special elections; the dashed line is the presidential margin in the state."}</p>
    </article>
  );
}
