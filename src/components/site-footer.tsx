"use client";

import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="site-footer">
      <span>{t("Midterm Pulse 2026 · Transparent election intelligence")}</span>
      <span><Link href="/how-it-works">{t("How it works")}</Link> · <Link href="/glossary">{t("Glossary")}</Link> · <Link href="/methodology">{t("Methodology")}</Link> · <Link href="/changes">{t("What changed")}</Link> · <Link href="/stream">{t("Stream mode")}</Link> · {t("Open-source prototype")}</span>
    </footer>
  );
}
