import { redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";

// The old analysis workspace is retired: state pages and the Playground cover what it did.
export default async function WorkspacePage({ params }: PageProps<"/[lang]/workspace">) {
  const { lang } = await params;
  redirect(localePath(isLocale(lang) ? lang : "es", "/states"));
}
