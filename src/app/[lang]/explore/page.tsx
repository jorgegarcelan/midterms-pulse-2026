import { GeographyExplorer } from "@/components/geography-explorer";
import { SiteFooter } from "@/components/site-footer";

export default function ExplorePage() {
  return <main className="page-main"><div className="content-shell explorer-shell"><GeographyExplorer /><SiteFooter /></div></main>;
}
