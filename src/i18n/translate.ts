import type { Locale } from "@/i18n/config";
import { es } from "@/i18n/es";

export type Vars = Record<string, string | number>;

/*
  English source strings are the keys: t("Every race, one profile") returns the Spanish entry when the
  locale is es, and the English text itself otherwise (or when a translation is missing).
  Placeholders use braces: t("{count} races in view", { count: 470 }).
*/
export function translate(locale: Locale, text: string, vars?: Vars) {
  const template = locale === "es" ? es[text] ?? text : text;
  return vars ? template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match)) : template;
}

export const getT = (locale: Locale) => (text: string, vars?: Vars) => translate(locale, text, vars);
