import { redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";

// The district map now lives in the races hub's map view; old links keep working.
export default async function DistrictsPage({ params, searchParams }: PageProps<"/[lang]/districts">) {
  const { lang } = await params;
  const query = new URLSearchParams({ view: "map" });
  const state = (await searchParams).state;
  if (typeof state === "string") query.set("state", state);
  redirect(localePath(isLocale(lang) ? lang : "es", `/races?${query}`));
}
