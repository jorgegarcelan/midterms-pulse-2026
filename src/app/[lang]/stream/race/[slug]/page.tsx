import { StreamRace } from "@/components/stream/stream-race";

export const metadata = { title: "Stream · Race — Midterm Pulse 2026", robots: { index: false } };

export default async function StreamRacePage({ params, searchParams }: PageProps<"/[lang]/stream/race/[slug]">) {
  return <StreamRace slug={(await params).slug} transparent={(await searchParams).bg === "transparent"} />;
}
