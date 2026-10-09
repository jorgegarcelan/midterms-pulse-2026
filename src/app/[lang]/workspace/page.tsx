import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";

export default function WorkspacePage() {
  return <main className="page-main"><div className="content-shell workspace-shell"><InteractiveWorkspace /><SiteFooter /></div></main>;
}
