import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

const pipeline = [
  ["01", "Collect", "Polling, official results, ratings, demographics and campaign-finance data."],
  ["02", "Normalize", "Preserve field dates, sample, population, mode, sponsor and source URL."],
  ["03", "Estimate", "Weight the national environment and run 50,000 seeded, correlated simulations."],
  ["04", "Validate", "Backtesting and calibration remain required before the experimental label can be removed."],
  ["05", "Explain", "Use AI for retrieval and synthesis while keeping every numeric claim grounded."],
];

export default function MethodologyPage() {
  return (
    <main className="page-main"><div className="content-shell">
      <section className="page-intro"><div><p className="eyebrow">METHODOLOGY</p><h1>Data and model methodology</h1><p>Sources, transformations, current coefficients and the validation gates for MP-26.</p></div></section>
      <section className="methodology-layout">
        <article className="panel pipeline-panel"><p className="eyebrow">MODEL PIPELINE</p><h2>From raw observation to published probability</h2><div className="pipeline-list">{pipeline.map(([index, title, text]) => <div key={index}><span>{index}</span><h3>{title}</h3><p>{text}</p></div>)}</div></article>
        <aside className="panel methodology-side"><p className="eyebrow">CURRENT STATUS</p><h2>Experimental v0.1</h2><p>Midterm Pulse now owns the weighting and 50,000-draw simulation layer. Vote-Scope remains the attributed seat-level anchor; historical calibration is still pending.</p><ul><li>Every run is seeded and reproducible.</li><li>Coefficients and intervals are public.</li><li>Candidate finance does not yet affect probabilities.</li><li>Jev only triages signals in the pilot.</li></ul><Link className="primary-action" href="/model">Inspect the model</Link></aside>
      </section>
      <section className="panel source-register"><div className="panel-head"><div><p className="eyebrow">SOURCE REGISTER</p><h2>Primary inputs</h2></div></div><div className="source-grid"><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><strong>Vote-Scope</strong><span>Forecast benchmark + public API</span></a><a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noreferrer"><strong>Cook Political Report</strong><span>House race ratings</span></a><a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"><strong>FEC</strong><span>Candidates + campaign finance</span></a><a href="https://www.census.gov/geographies/mapping-files/2024/geo/carto-boundary-file.html" target="_blank" rel="noreferrer"><strong>Census Bureau</strong><span>119th Congress boundaries</span></a></div></section>
      <SiteFooter />
    </div></main>
  );
}
