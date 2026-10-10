import Link from "@/components/i18n/link";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/i18n/config";
import { getT } from "@/i18n/translate";

const pipeline = [
  ["01", "Collect", "Polling, official results, ratings, demographics and campaign-finance data."],
  ["02", "Normalize", "Preserve field dates, sample, population, mode, sponsor and source URL."],
  ["03", "Estimate", "Weight the national environment and run 50,000 seeded, correlated simulations."],
  ["04", "Validate", "The probability engine is backtested on 2018 and 2022; the benchmark itself cannot be replayed, so the model stays experimental."],
  ["05", "Explain", "Use AI for retrieval and synthesis while keeping every numeric claim grounded."],
];

export default async function MethodologyPage({ params }: PageProps<"/[lang]/methodology">) {
  const { lang } = await params;
  const t = getT(isLocale(lang) ? lang : "es");
  return (
    <main className="page-main"><div className="content-shell">
      <section className="page-intro"><div><p className="eyebrow">{t("METHODOLOGY")}</p><h1>{t("Data and model methodology")}</h1><p>{t("Sources, transformations, current coefficients and the validation gates for MP-26.")}</p></div></section>
      <section className="methodology-layout">
        <article className="panel pipeline-panel"><p className="eyebrow">{t("MODEL PIPELINE")}</p><h2>{t("From raw observation to published probability")}</h2><div className="pipeline-list">{pipeline.map(([index, title, text]) => <div key={index}><span>{index}</span><h3>{t(title)}</h3><p>{t(text)}</p></div>)}</div></article>
        <aside className="panel methodology-side"><p className="eyebrow">{t("CURRENT STATUS")}</p><h2>{t("Experimental v0.4")}</h2><p>{t("Midterm Pulse owns the weighting and 50,000-draw simulation layer. Vote-Scope remains the attributed benchmark for every race margin. Both chambers are simulated race by race; historical calibration is still pending.")}</p><ul><li>{t("Every run is seeded and reproducible.")}</li><li>{t("Chamber odds equal the aggregate of the race odds.")}</li><li>{t("Coefficients and intervals are public.")}</li><li>{t("Candidate finance does not yet affect probabilities.")}</li><li>{t("Jev only triages signals in the pilot.")}</li></ul><Link className="primary-action" href="/how-it-works">{t("See the pipeline, animated")}</Link></aside>
      </section>
      <section className="panel source-register"><div className="panel-head"><div><p className="eyebrow">{t("SOURCE REGISTER")}</p><h2>{t("Primary inputs")}</h2></div></div><div className="source-grid"><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><strong>Vote-Scope</strong><span>{t("Forecast benchmark + public API")}</span></a><a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noreferrer"><strong>Cook Political Report</strong><span>{t("House race ratings")}</span></a><a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"><strong>FEC</strong><span>{t("Candidates + campaign finance")}</span></a><a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><strong>Census Bureau</strong><span>{t("119th Congress boundaries")}</span></a></div></section>
      <SiteFooter />
    </div></main>
  );
}
