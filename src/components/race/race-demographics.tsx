"use client";

import { useEffect, useState } from "react";
import { DemographicCompare } from "@/components/demographics/demographic-compare";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { loadDemographics, type Demographics } from "@/lib/race-data";

// Who lives here: the district (or state) against its state and the country.
export function RaceDemographics({ race }: { race: ForecastRace }) {
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadDemographics().then(setDemographics).catch(() => setFailed(true)); }, []);

  const stateName = stateByCode.get(race.state)?.name || race.state;
  const district = race.chamber === "house" ? demographics?.districts[race.code] : undefined;
  const state = demographics?.states[race.state];
  const geos = demographics && state ? [
    ...(district ? [{ key: race.code, label: race.code, profile: district }] : []),
    { key: race.state, label: stateName, profile: state },
    { key: "US", label: "United States", profile: demographics.us },
  ] : [];

  return (
    <article className="panel race-demographics">
      <div className="panel-head">
        <div><p className="eyebrow">Census profile</p><h2>{district ? `Who lives in ${race.code}` : `Who lives in ${stateName}`}</h2></div>
        <span className="panel-tag">{demographics?.release || "ACS"}</span>
      </div>
      {failed ? <p className="table-empty">Census data could not be loaded.</p>
        : !demographics ? <div className="chart-loading">Loading Census data…</div>
          : <DemographicCompare geos={geos} demographics={demographics} percentileFor={district} />}
    </article>
  );
}
