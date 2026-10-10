"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/i18n/link";
import { useT } from "@/components/i18n/locale-provider";
import { stripLocale } from "@/i18n/config";

export const MODEL_TABS = [
  { href: "/model", label: "Forecast" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/validation", label: "Validation" },
  { href: "/methodology", label: "Sources" },
];

// One "Model" section with four tabs instead of four separate pages in the menu.
export function ModelTabs() {
  const t = useT();
  const path = stripLocale(usePathname());
  return <nav className="model-tabs" aria-label={t("The model")}>
    <span className="model-tabs-title">{t("The model")}</span>
    <div>{MODEL_TABS.map((tab) => <Link key={tab.href} href={tab.href} className={path === tab.href ? "active" : ""} aria-current={path === tab.href ? "page" : undefined}>{t(tab.label)}</Link>)}</div>
  </nav>;
}
