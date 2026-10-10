import { redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";

// The live wire is now part of "Latest" (/changes).
export default async function LivePage({ params }: PageProps<"/[lang]/live">) {
  const { lang } = await params;
  redirect(localePath(isLocale(lang) ? lang : "es", "/changes"));
}
