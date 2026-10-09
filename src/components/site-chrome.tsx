"use client";

import { usePathname } from "next/navigation";
import { ContextBar } from "@/components/context-bar";
import { SiteHeader } from "@/components/site-header";
import { stripLocale } from "@/i18n/config";

// Header and context bar for every page except the stream views, which are full-bleed broadcast canvases.
export function SiteChrome() {
  const path = stripLocale(usePathname());
  if (path.startsWith("/stream/")) return null;
  return <><SiteHeader /><ContextBar /></>;
}
