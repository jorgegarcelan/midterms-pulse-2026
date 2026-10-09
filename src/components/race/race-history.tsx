"use client";

import { useEffect, useState } from "react";
import { MarginHistoryChart, type HistoryPoint } from "@/components/charts/margin-history-chart";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { useT } from "@/components/i18n/locale-provider";
import type { Vars } from "@/i18n/translate";
import { loadHouseHistory, loadPresidentHistory, loadSenateHistory, type HistoryResult } from "@/lib/race-data";

const signed = (value: number) => `${value >= 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const PARTY = { D: "Democrat", R: "Republican", O: "Other" } as const;

function toPoint(result: HistoryResult, office: string, t: (text: string, vars?: Vars) => string): HistoryPoint {
  const unopposed = result.u === 1;
  const party = t(PARTY[result.w]);
  const name = result.n || party;
  return {
    year: result.y,
    margin: unopposed ? (result.w === "D" ? 100 : result.w === "R" ? -100 : result.m) : result.m,
    winner: result.w,
    hollow: unopposed,
    title: result.s ? t("{year} special · {office}", { year: result.y, office }) : `${result.y} · ${office}`,
    detail: unopposed ? t("{name} ({party}) won unopposed", { name, party }) : t("{name} ({party}) won · D {dem}% · R {rep}%", { name, party, dem: result.dp, rep: result.rp }),
  };
}

// Past results for this seat (House district or Senate state), with the 2026 model as the last point.
export function RaceHistory({ race }: { race: ForecastRace }) {
  const t = useT();
  const [data, setData] = useState<{ points: HistoryPoint[]; context?: { label: string; points: { year: number; margin: number }[] } } | null>(null);
  const [failed, setFailed] = useState(false);
  const stateName = t(stateByCode.get(race.state)?.name || race.state);

  useEffect(() => {
    let cancelled = false;
    const task = race.chamber === "house"
      ? loadHouseHistory(race.state).then((file) => ({ points: (file.districts[race.code] || []).map((result) => toPoint(result, t("House"), t)) }))
      : Promise.all([loadSenateHistory(), loadPresidentHistory()]).then(([senate, president]) => ({
        points: (senate.states[race.state] || []).filter((result) => result.y >= 1990).map((result) => toPoint(result, t("Senate"), t)),
        context: { label: t("Presidential margin in {state}", { state: stateName }), points: (president.states[race.state] || []).filter((result) => result.y >= 1990).map((result) => ({ year: result.y, margin: result.m })) },
      }));
    task.then((next) => { if (!cancelled) setData(next); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [race.chamber, race.code, race.state, stateName, t]);

  const house = race.chamber === "house";
  return (
    <article className="panel race-history">
      <div className="panel-head">
        <div><p className="eyebrow">{t("Results over time")}</p><h2>{house ? t("{code} since 2000", { code: race.code }) : t("{state} Senate since 1990", { state: stateName })}</h2></div>
        <span className="panel-tag">{house ? "FiveThirtyEight" : "538 · MIT Election Lab"}</span>
      </div>
      {failed ? <p className="table-empty">{t("Historical results could not be loaded.")}</p>
        : !data ? <div className="chart-loading">{t("Loading results…")}</div>
          : data.points.length === 0 ? <p className="table-empty">{t("No historical results found for this seat.")}</p>
            : <MarginHistoryChart
              points={data.points}
              label={house ? t("House") : t("Senate")}
              context={data.context}
              forecast={{ year: 2026, margin: race.signedMargin, label: t("2026 model {margin}", { margin: signed(race.signedMargin) }) }}
              markers={house ? [{ year: 2002, label: t("new maps") }, { year: 2012, label: t("new maps") }, { year: 2022, label: t("new maps") }] : []}
              ariaLabel={t("{race} results over time with the 2026 forecast", { race: house ? race.code : t("{state} Senate", { state: stateName }) })}
            />}
      <p className="chart-note">{house
        ? t("District lines are redrawn after each census (2002, 2012, 2022) and some states redrew mid-decade, so earlier results may cover different territory. Hollow dots are uncontested seats.")
        : t("Both Senate seats in the state are shown, including special elections; the dashed line is the presidential margin in the state.")}</p>
    </article>
  );
}
