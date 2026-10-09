"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "@/components/i18n/link";
import { useIntlLocale, useLocale, useT } from "@/components/i18n/locale-provider";
import type { GlossaryTerm } from "@/data/glossary";

// Searchable A–Z list. Each entry keeps a stable anchor so other pages can deep-link to it.
export function GlossaryList({ terms: source }: { terms: GlossaryTerm[] }) {
  const t = useT();
  const locale = useLocale();
  const intl = useIntlLocale();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  // English keeps the source order; translated terms are re-sorted so the A–Z index stays alphabetical.
  const terms = useMemo(() => {
    const localized = source.map((term) => ({
      ...term,
      term: t(term.term),
      aka: term.aka && t(term.aka),
      definition: t(term.definition),
      example: term.example && t(term.example),
      link: term.link && { ...term.link, label: t(term.link.label) },
    }));
    return locale === "en" ? localized : localized.sort((a, b) => a.term.localeCompare(b.term, intl));
  }, [source, t, locale, intl]);
  const visible = deferred ? terms.filter((term) => `${term.term} ${term.aka || ""} ${term.definition}`.toLowerCase().includes(deferred)) : terms;
  const letters = [...new Set(terms.map((term) => term.term[0].toUpperCase()))];

  return (
    <div className="glossary">
      <div className="glossary-tools">
        <label className="glossary-search"><span className="sr-only">{t("Search the glossary")}</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search a term, e.g. tipping point")} />
        </label>
        <nav className="glossary-letters" aria-label={t("Jump to letter")}>{letters.map((letter) => <a key={letter} href={`#${terms.find((term) => term.term[0].toUpperCase() === letter)!.id}`}>{letter}</a>)}</nav>
      </div>
      <dl className="glossary-list">
        {visible.map((term) => (
          <div className="glossary-term" id={term.id} key={term.id}>
            <dt><a href={`#${term.id}`}>{term.term}</a>{term.aka && <small>{term.aka}</small>}</dt>
            <dd>
              <p>{term.definition}</p>
              {term.example && <p className="glossary-example">{term.example}</p>}
              {term.link && <Link href={term.link.href}>{term.link.label} →</Link>}
            </dd>
          </div>
        ))}
        {visible.length === 0 && <p className="table-empty">{t("No term matches “{query}”.", { query })}</p>}
      </dl>
    </div>
  );
}
