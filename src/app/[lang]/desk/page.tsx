import { CallDesk } from "@/components/night/call-desk";

export const metadata = { title: "Call desk — Midterm Pulse 2026", robots: { index: false, follow: false } };

// Private tool for election night: writes need the DESK_TOKEN, so the page itself can be public.
export default function DeskPage() {
  return <main className="page-main"><div className="content-shell"><CallDesk /></div></main>;
}
