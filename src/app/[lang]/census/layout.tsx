import { CensusTabs } from "@/components/census/census-pages";
import { SiteFooter } from "@/components/site-footer";
import "./census.css";

// Census-26's section: the same tab bar on every page, like MP-26.
export default function CensusLayout({ children }: { children: React.ReactNode }) {
  return <main className="page-main"><div className="content-shell cz-shell"><CensusTabs />{children}<SiteFooter /></div></main>;
}
