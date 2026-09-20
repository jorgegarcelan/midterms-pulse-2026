import { InteractiveWorkspace } from "@/components/interactive-workspace";
import { SiteFooter } from "@/components/site-footer";

export default async function StatePage({ params }: PageProps<"/states/[code]">) {
  const { code } = await params;
  return <main className="page-main"><div className="content-shell workspace-shell"><InteractiveWorkspace initialStateCode={code} /><SiteFooter /></div></main>;
}
