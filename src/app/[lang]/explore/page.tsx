import { redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";

// The county explorer is now the last part of the geography page.
export default async function ExplorePage({ params }: PageProps<"/[lang]/explore">) {
  const { lang } = await params;
  redirect(localePath(isLocale(lang) ? lang : "es", "/geography#explore"));
}
