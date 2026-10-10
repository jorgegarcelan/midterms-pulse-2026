"use client";

import { createContext, useCallback, useContext } from "react";
import { DEFAULT_LOCALE, intlLocale, localePath, type Locale } from "@/i18n/config";
import { translate, type Vars } from "@/i18n/translate";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

export function useT() {
  const locale = useLocale();
  return useCallback((text: string, vars?: Vars) => translate(locale, text, vars), [locale]);
}

export function useLocalePath() {
  const locale = useLocale();
  return useCallback((href: string) => localePath(locale, href), [locale]);
}

// Intl locale tag for toLocaleString / Intl.NumberFormat / toLocaleDateString.
export const useIntlLocale = () => intlLocale(useLocale());
