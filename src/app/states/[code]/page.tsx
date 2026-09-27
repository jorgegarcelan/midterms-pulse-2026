import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";
import { StateProfile } from "@/components/state/state-profile";

export default async function StatePage({ params }: PageProps<"/states/[code]">) {
  const { code } = await params;
  return <main className="page-main"><div className="content-shell workspace-shell"><InteractiveWorkspace initialStateCode={code} /><StateProfile code={code} /><SiteFooter /></div></main>;
}
