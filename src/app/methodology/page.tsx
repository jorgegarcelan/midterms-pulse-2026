import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

const pipeline = [
  ["01", "Collect", "Polling, official results, ratings, demographics and campaign-finance data."],
  ["02", "Normalize", "Preserve field dates, sample, population, mode, sponsor and source URL."],
  ["03", "Estimate", "Build reproducible chamber and race-level models with explicit uncertainty."],
  ["04", "Backtest", "Run the pipeline against prior cycles and publish calibration and error."],
  ["05", "Explain", "Use AI for retrieval and synthesis while keeping every numeric claim grounded."],
];

export default function MethodologyPage() {
  return (
    <main className="page-main"><div className="content-shell">
      <section className="page-intro"><div><p className="eyebrow">METHODOLOGY</p><h1>Show the work.</h1><p>Midterm Pulse separates sourced benchmarks, user-entered research and future proprietary forecasts so certainty is never implied by design alone.</p></div></section>
      <section className="methodology-layout">
        <article className="panel pipeline-panel"><p className="eyebrow">MODEL PIPELINE</p><h2>From raw observation to published probability</h2><div className="pipeline-list">{pipeline.map(([index, title, text]) => <div key={index}><span>{index}</span><h3>{title}</h3><p>{text}</p></div>)}</div></article>
        <aside className="panel methodology-side"><p className="eyebrow">CURRENT STATUS</p><h2>Prototype benchmark</h2><p>The current control probabilities are attributed public benchmarks. They are not yet the output of a proprietary Midterm Pulse model.</p><ul><li>Every snapshot is dated.</li><li>User-added polls remain local.</li><li>AI answers use the checked-in snapshot.</li><li>Jev only triages signals in the pilot.</li></ul><Link className="primary-action" href="/polls">Inspect polls</Link></aside>
      </section>
      <section className="panel source-register"><div className="panel-head"><div><p className="eyebrow">SOURCE REGISTER</p><h2>Primary inputs</h2></div></div><div className="source-grid"><a href="https://vote-scope.com/api/" target="_blank" rel="noreferrer"><strong>Vote-Scope</strong><span>Forecast benchmark + public API</span></a><a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noreferrer"><strong>Cook Political Report</strong><span>House race ratings</span></a><a href="https://api.open.fec.gov/developers/" target="_blank" rel="noreferrer"><strong>FEC</strong><span>Campaign finance</span></a><a href="https://www.census.gov/programs-surveys/acs/data/data-via-api.html" target="_blank" rel="noreferrer"><strong>Census ACS</strong><span>Demographic context</span></a></div></section>
      <SiteFooter />
    </div></main>
  );
}
