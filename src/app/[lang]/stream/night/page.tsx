import { StreamNight } from "@/components/stream/stream-night";

export const metadata = { title: "Stream · Election night — Midterm Pulse 2026", robots: { index: false } };

export default async function StreamNightPage({ searchParams }: PageProps<"/[lang]/stream/night">) {
  return <StreamNight transparent={(await searchParams).bg === "transparent"} />;
}
