"use client";

import { useEffect, useState } from "react";
import { DemographicCompare } from "@/components/demographics/demographic-compare";
import { stateByCode } from "@/data/geography";
import type { ForecastRace } from "@/lib/forecast";
import { useT } from "@/components/i18n/locale-provider";
import { loadDemographics, type Demographics } from "@/lib/race-data";

// Who lives here: the district (or state) against its state and the country.
export function RaceDemographics({ race }: { race: ForecastRace }) {
  const t = useT();
  const [demographics, setDemographics] = useState<Demographics | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { loadDemographics().then(setDemographics).catch(() => setFailed(true)); }, []);

  const stateName = t(stateByCode.get(race.state)?.name || race.state);
  const district = race.chamber === "house" ? demographics?.districts[race.code] : undefined;
  const state = demographics?.states[race.state];
  const geos = demographics && state ? [
    ...(district ? [{ key: race.code, label: race.code, profile: district }] : []),
    { key: race.state, label: stateName, profile: state },
    { key: "US", label: t("United States"), profile: demographics.us },
  ] : [];

  return (
    <article className="panel race-demographics">
      <div className="panel-head">
        <div><p className="eyebrow">{t("Census profile")}</p><h2>{t("Who lives in {place}", { place: district ? race.code : stateName })}</h2></div>
        <span className="panel-tag">{demographics?.release || "ACS"}</span>
      </div>
      {failed ? <p className="table-empty">{t("Census data could not be loaded.")}</p>
        : !demographics ? <div className="chart-loading">{t("Loading Census data…")}</div>
          : <DemographicCompare geos={geos} demographics={demographics} percentileFor={district} />}
    </article>
  );
}
