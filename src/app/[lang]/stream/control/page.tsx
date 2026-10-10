import { StreamControl } from "@/components/stream/stream-control";

export const metadata = { title: "Stream · Control — Midterm Pulse 2026", robots: { index: false } };

export default async function StreamControlPage({ searchParams }: PageProps<"/[lang]/stream/control">) {
  return <StreamControl transparent={(await searchParams).bg === "transparent"} />;
}
