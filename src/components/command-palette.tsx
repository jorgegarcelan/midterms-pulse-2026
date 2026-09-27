"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { states } from "@/data/geography";
import { raceSlug } from "@/lib/races";

type Item = { id: string; group: "Pages" | "Races" | "States"; label: string; meta: string; href: string; tone?: "dem" | "rep"; keywords: string };
type ModelRace = { code: string; chamber: "house" | "senate"; leader: "D" | "R"; margin: number; winProbability: number; rating?: string };

export const OPEN_COMMAND_EVENT = "midterm-pulse:command";

const PAGES: Item[] = [
  ["Dashboard", "/", "Home, story and scenario tools"], ["Forecast model", "/model", "MP-26 distributions and assumptions"], ["How the model works", "/how-it-works", "The pipeline, step by step"], ["Glossary", "/glossary", "Every term, in plain words"], ["District map", "/districts", "All 435 House districts"],
  ["Race directory", "/races", "Every House and Senate race"], ["Polls", "/polls", "Polling tracker"], ["Prediction markets", "/markets", "Polymarket control odds"],
  ["Live desk", "/live", "X watchlist and signal triage"], ["History", "/history", "2010–2024 cycles"], ["County explorer", "/explore", "3,000+ counties"],
  ["Workspace", "/workspace", "Compare, scenarios, timeline"], ["Methodology", "/methodology", "Sources and validation"],
].map(([label, href, meta]) => ({ id: `page-${href}`, group: "Pages", label, meta, href, keywords: `${label} ${meta}`.toLowerCase() }));

const STATES: Item[] = states.map((state) => ({ id: `state-${state.code}`, group: "States", label: state.name, meta: `${state.code} · state profile`, href: `/states/${state.code.toLowerCase()}`, keywords: `${state.name} ${state.code}`.toLowerCase() }));

let raceCache: Promise<Item[]> | null = null;
function loadRaces() {
  raceCache ??= fetch("/api/model").then((response) => response.json() as Promise<{ races: ModelRace[] }>).then(({ races }) => races.map((race) => ({
    id: `race-${race.chamber}-${race.code}`, group: "Races" as const,
    label: race.chamber === "senate" ? `${states.find((state) => state.code === race.code)?.name || race.code} Senate` : race.code,
    meta: `${race.rating || "Unrated"} · ${race.leader}+${race.margin.toFixed(1)} · ${race.winProbability}%`,
    href: `/races/${raceSlug(race)}`, tone: race.leader === "D" ? "dem" as const : "rep" as const,
    keywords: `${race.code} ${race.chamber} ${race.rating || ""} ${states.find((state) => state.code === race.code.slice(0, 2))?.name || ""}`.toLowerCase(),
  }))).catch(() => { raceCache = null; return []; });
  return raceCache;
}

function rank(item: Item, query: string) {
  if (!query) return item.group === "Pages" ? 1 : 0;
  const label = item.label.toLowerCase();
  if (label === query) return 4;
  if (label.startsWith(query)) return 3;
  if (item.keywords.includes(query)) return 2;
  return query.split(/\s+/).every((word) => item.keywords.includes(word) || label.includes(word)) ? 1 : 0;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [races, setRaces] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); }
      else if (event.key === "/" && !typing) { event.preventDefault(); setOpen(true); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_COMMAND_EVENT, onOpen); };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadRaces().then((items) => { if (!cancelled) setRaces(items); });
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const scored = [...PAGES, ...races, ...STATES].map((item) => ({ item, score: rank(item, normalized) })).filter((entry) => entry.score > 0);
    const groups: Item["group"][] = normalized ? ["Races", "States", "Pages"] : ["Pages"];
    return groups.flatMap((group) => scored.filter((entry) => entry.item.group === group).sort((a, b) => b.score - a.score).slice(0, group === "Races" ? 8 : 6).map((entry) => entry.item));
  }, [query, races]);

  // The highlight glides between rows instead of jumping.
  useLayoutEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    const highlight = highlightRef.current;
    if (!highlight) return;
    if (!row) { highlight.style.opacity = "0"; return; }
    highlight.style.opacity = "1";
    highlight.style.transform = `translateY(${row.offsetTop}px)`;
    highlight.style.height = `${row.offsetHeight}px`;
    row.scrollIntoView({ block: "nearest" });
  }, [active, results, open]);

  function close() { setOpen(false); setQuery(""); setActive(0); }
  function go(item?: Item) { if (!item) return; close(); router.push(item.href); }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(results.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); go(results[active]); }
  }

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="command-backdrop" onMouseDown={close}>
      <div className="command-panel" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="command-input">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder="Search races, states and pages…" aria-label="Search" aria-controls="command-results" aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined} />
          <kbd>esc</kbd>
        </div>
        <div className="command-results" id="command-results" role="listbox" ref={listRef}>
          <span className="command-highlight" ref={highlightRef} aria-hidden="true" />
          {results.map((item, index) => {
            const heading = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return <div key={item.id}>
              {heading && <p className="command-group">{heading}</p>}
              <button type="button" role="option" id={`command-${item.id}`} aria-selected={index === active} data-index={index} className="command-item" onMouseMove={() => setActive(index)} onClick={() => go(item)}>
                <span className={item.tone ? `${item.tone}-text` : ""}>{item.label}</span><small>{item.meta}</small><kbd>↵</kbd>
              </button>
            </div>;
          })}
          {results.length === 0 && <p className="command-empty">No match for “{query}”.</p>}
        </div>
        <div className="command-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>⌘</kbd><kbd>K</kbd> toggle</span></div>
      </div>
    </div>
  );
}
