"use client";

import { useT } from "@/components/i18n/locale-provider";
import { useInView } from "@/components/explainer/use-in-view";

type Redraw = { state: string; seats: number; how: string; when: string };

// Ceilings ("up to"), as estimated by NBC News in June 2026, minus Missouri's +1: courts blocked its
// 2025 map in September 2026. Dates from state and court records.
const REPUBLICAN: Redraw[] = [
  { state: "Texas", seats: 5, how: "Legislature, at the White House's urging", when: "Aug 2025" },
  { state: "Florida", seats: 4, how: "Legislature, special session", when: "Apr 2026" },
  { state: "Ohio", seats: 2, how: "Redistricting commission", when: "Oct 2025" },
  { state: "North Carolina", seats: 1, how: "Legislature", when: "Oct 2025" },
  { state: "Tennessee", seats: 1, how: "Legislature splits Memphis three ways", when: "May 2026" },
  { state: "Louisiana", seats: 1, how: "Legislature, after Louisiana v. Callais", when: "May 2026" },
  { state: "Alabama", seats: 1, how: "2023 map restored by the Supreme Court", when: "Jun 2026" },
];
const DEMOCRATIC: Redraw[] = [
  { state: "California", seats: 5, how: "Voters approve Proposition 50", when: "Nov 2025" },
  { state: "Utah", seats: 1, how: "State court throws out the legislature's map", when: "Nov 2025" },
];
const STOPPED = ["Missouri", "Indiana", "Virginia", "South Carolina"];

const sum = (rows: Redraw[]) => rows.reduce((total, row) => total + row.seats, 0);

function Side({ rows, party }: { rows: Redraw[]; party: "red" | "blue" }) {
  const t = useT();
  let seat = 0;
  return (
    <ul className={`gm-war-list ${party}`}>
      {rows.map((row, i) => (
        <li key={row.state} style={{ "--i": i } as React.CSSProperties}>
          <div><strong>{t(row.state)}</strong><span>{t(row.how)} · {t(row.when)}</span></div>
          <p aria-label={t("up to {n} seats", { n: row.seats })}>
            {Array.from({ length: row.seats }, (_, j) => <i key={j} style={{ "--s": seat++ } as React.CSSProperties} />)}
            <b>+{row.seats}</b>
          </p>
        </li>
      ))}
    </ul>
  );
}

export function MapWar() {
  const t = useT();
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin: "0px 0px -20% 0px" });
  const rep = sum(REPUBLICAN);
  const dem = sum(DEMOCRATIC);
  const net = rep - dem;

  return (
    <div className="gm-war" ref={ref} data-in={inView ? "" : undefined}>
      <div className="gm-tug" style={{ "--rep": rep, "--dem": dem, "--net": net } as React.CSSProperties}>
        <div className="gm-tug-labels">
          <span className="red"><b>{t("up to +{n}", { n: rep })}</b> {t("Republican seats")}</span>
          <span className="blue">{t("Democratic seats")} <b>{t("up to +{n}", { n: dem })}</b></span>
        </div>
        <div className="gm-tug-track">
          <i className="red" />
          <i className="blue" />
          <em className="gm-tug-mid" />
          <span className="gm-tug-net">{t("Net: up to R+{n}", { n: net })}</span>
        </div>
      </div>

      <div className="gm-war-cols">
        <div>
          <h3 className="red">{t("Drawn for Republicans")}</h3>
          <Side rows={REPUBLICAN} party="red" />
        </div>
        <div>
          <h3 className="blue">{t("Drawn for Democrats")}</h3>
          <Side rows={DEMOCRATIC} party="blue" />
          <div className="gm-war-stopped">
            <h4>{t("Tried, then stopped")}</h4>
            <p>{STOPPED.map((state) => t(state)).join(" · ")}</p>
            <span>{t("Missouri passed a map in 2025, but a referendum petition froze it until voters decide on November 3, so the state votes on its 2022 lines; Indiana's state Senate voted a new map down; a court blocked Virginia's redistricting referendum; South Carolina's plan died in the legislature.")}</span>
          </div>
        </div>
      </div>

      <p className="viz-note">
        {t("These are ceilings, not forecasts. Spreading your own voters thin creates more winnable seats but fewer safe ones, so a strong year for the other side can flip an aggressive map against its authors. Strategists call that a dummymander.")}
        {" "}{t("NBC's June estimate also counted one Republican seat from Missouri. That map is out for 2026: in September the Missouri Supreme Court upheld the referendum petition and the U.S. Supreme Court halted an appeals court order reviving the map, and in October the Census Bureau reissued its 2026 district files with Missouri's 2022 lines.")}
        {" "}{t("Sources:")} <a href="https://www.nbcnews.com/politics/2026-election/house-redistricting-gop-democrats-2026-midterm-elections-rcna348110" target="_blank" rel="noreferrer">NBC News</a>, <a href="https://ballotpedia.org/Redistricting_ahead_of_the_2026_elections" target="_blank" rel="noreferrer">Ballotpedia</a>, <a href="https://www.congress.gov/crs-product/LSB11431" target="_blank" rel="noreferrer">CRS</a>, <a href="https://www.pbs.org/newshour/politics/supreme-court-rejects-trump-backed-missouri-congressional-map-for-third-time" target="_blank" rel="noreferrer">PBS NewsHour</a>, <a href="https://www.census.gov/geographies/mapping-files/2027/dec/rdo/120-congressional-district-bef.html" target="_blank" rel="noreferrer">{t("Census Bureau")}</a>.
      </p>
    </div>
  );
}
