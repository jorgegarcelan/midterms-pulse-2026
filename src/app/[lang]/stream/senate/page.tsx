import { StreamSenate } from "@/components/stream/stream-senate";

export const metadata = { title: "Stream · Senate — Midterm Pulse 2026", robots: { index: false } };

export default async function StreamSenatePage({ searchParams }: PageProps<"/[lang]/stream/senate">) {
  return <StreamSenate transparent={(await searchParams).bg === "transparent"} />;
}
