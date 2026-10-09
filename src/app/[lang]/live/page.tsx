import { LiveDesk } from "@/components/live/live-desk";
import { SiteFooter } from "@/components/site-footer";

export default function LivePage() {
  // The Jev triage pilot only shows with a key; its rule-based fallback is not worth a panel on its own.
  return <main className="page-main"><div className="content-shell"><LiveDesk showTriage={Boolean(process.env.TYPESAFE_API_KEY)} /><SiteFooter /></div></main>;
}
