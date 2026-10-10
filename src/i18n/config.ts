export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

export const isLocale = (value: string | undefined): value is Locale => LOCALES.includes(value as Locale);

// Spanish lives at the bare path (/races); English carries a prefix (/en/races).
export function localePath(locale: Locale, href: string) {
  if (locale === DEFAULT_LOCALE || !href.startsWith("/") || href.startsWith("/api/") || href.startsWith("/data/")) return href;
  return href === "/" ? "/en" : `/en${href}`;
}

export function stripLocale(pathname: string) {
  if (pathname === "/en" || pathname === "/es") return "/";
  return pathname.replace(/^\/(en|es)(?=\/)/, "");
}

export const intlLocale = (locale: Locale) => (locale === "es" ? "es-ES" : "en-US");
