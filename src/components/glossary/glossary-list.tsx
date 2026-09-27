"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import type { GlossaryTerm } from "@/data/glossary";

// Searchable A–Z list. Each entry keeps a stable anchor so other pages can deep-link to it.
export function GlossaryList({ terms }: { terms: GlossaryTerm[] }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const visible = deferred ? terms.filter((term) => `${term.term} ${term.aka || ""} ${term.definition}`.toLowerCase().includes(deferred)) : terms;
  const letters = [...new Set(terms.map((term) => term.term[0].toUpperCase()))];

  return (
    <div className="glossary">
      <div className="glossary-tools">
        <label className="glossary-search"><span className="sr-only">Search the glossary</span>
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a term, e.g. tipping point" />
        </label>
        <nav className="glossary-letters" aria-label="Jump to letter">{letters.map((letter) => <a key={letter} href={`#${terms.find((term) => term.term[0].toUpperCase() === letter)!.id}`}>{letter}</a>)}</nav>
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
        {visible.length === 0 && <p className="table-empty">No term matches “{query}”.</p>}
      </dl>
    </div>
  );
}
