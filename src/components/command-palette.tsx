"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { states } from "@/data/geography";
import { raceSlug } from "@/lib/races";

type Item = { id: string; group: "Pages" | "Races" | "States"; label: string; meta: string; href: string; tone?: "dem" | "rep"; keywords: string };
type ModelRace = { code: string; chamber: "house" | "senate"; leader: "D" | "R"; margin: number; winProbability: number; rating?: string };

export const OPEN_COMMAND_EVENT = "midterm-pulse:command";

type Translate = ReturnType<typeof useT>;
// Search matches the English source text and, when different, the translation shown on screen.
const keywordsFor = (...parts: string[]) => [...new Set(parts)].join(" ").toLowerCase();

const PAGES: [string, string, string][] = [
  ["Dashboard", "/", "Home, story and scenario tools"], ["The model", "/model", "The forecast, how it works, its validation and sources"], ["How the model works", "/how-it-works", "The pipeline, step by step"], ["Model validation", "/validation", "How MP-26 would have done in 2018 and 2022"], ["Methodology", "/methodology", "Sources and validation"],
  ["Latest", "/changes", "Headlines, new polls, market swings and what moved"], ["Polls", "/polls", "Polling tracker"], ["Prediction markets", "/markets", "Polymarket control odds"],
  ["Races: map and list", "/races", "Every House and Senate race"], ["District map", "/races?view=map", "All 435 House districts"], ["States", "/states", "Each state's Senate race and House districts"], ["Candidates", "/candidates", "Every 2026 nominee"],
  ["Geography of the vote", "/geography", "Seven axes: city vs country, education, race, belts, regions"], ["County explorer", "/geography#explore", "3,000+ counties"], ["History", "/history", "2010–2024 cycles"], ["Glossary", "/glossary", "Every term, in plain words"], ["About", "/about", "Who builds Midterm Pulse"],
  ["Playground", "/playground", "Scenario simulator, map builder and data lab"], ["Stream mode", "/stream", "Full-screen scenes for OBS"], ["Election night", "/election-night", "Poll closing times and races to watch, hour by hour"],
];

const pageItems = (t: Translate): Item[] => PAGES.map(([label, href, meta]) => ({ id: `page-${href}`, group: "Pages", label: t(label), meta: t(meta), href, keywords: keywordsFor(`${label} ${meta}`, `${t(label)} ${t(meta)}`) }));

const stateItems = (t: Translate): Item[] => states.map((state) => ({ id: `state-${state.code}`, group: "States", label: t(state.name), meta: t("{code} · state profile", { code: state.code }), href: `/states/${state.code.toLowerCase()}`, keywords: keywordsFor(`${state.name} ${state.code}`, t(state.name)) }));

function raceItems(races: ModelRace[], t: Translate): Item[] {
  return races.map((race) => {
    const name = states.find((state) => state.code === race.code)?.name || race.code;
    const stateName = states.find((state) => state.code === race.code.slice(0, 2))?.name || "";
    return {
      id: `race-${race.chamber}-${race.code}`, group: "Races" as const,
      label: race.chamber === "senate" ? t("{state} Senate", { state: t(name) }) : race.code,
      meta: `${t(race.rating || "Unrated")} · ${race.leader}+${race.margin.toFixed(1)} · ${race.winProbability}%`,
      href: `/races/${raceSlug(race)}`, tone: race.leader === "D" ? "dem" as const : "rep" as const,
      keywords: keywordsFor(`${race.code} ${race.chamber} ${race.rating || ""} ${stateName}`, `${t(race.chamber === "senate" ? "Senate" : "House")} ${race.rating ? t(race.rating) : ""} ${stateName ? t(stateName) : ""}`),
    };
  });
}

let raceCache: Promise<ModelRace[]> | null = null;
function loadRaces() {
  raceCache ??= fetch("/api/model").then((response) => response.json() as Promise<{ races: ModelRace[] }>).then(({ races }) => races).catch(() => { raceCache = null; return []; });
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
  const localize = useLocalePath();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [modelRaces, setModelRaces] = useState<ModelRace[]>([]);
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
    loadRaces().then((items) => { if (!cancelled) setModelRaces(items); });
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const scored = [...pageItems(t), ...raceItems(modelRaces, t), ...stateItems(t)].map((item) => ({ item, score: rank(item, normalized) })).filter((entry) => entry.score > 0);
    const groups: Item["group"][] = normalized ? ["Races", "States", "Pages"] : ["Pages"];
    return groups.flatMap((group) => scored.filter((entry) => entry.item.group === group).sort((a, b) => b.score - a.score).slice(0, group === "Races" ? 8 : 6).map((entry) => entry.item));
  }, [query, modelRaces, t]);

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
  function go(item?: Item) { if (!item) return; close(); router.push(localize(item.href)); }

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
      <div className="command-panel" role="dialog" aria-modal="true" aria-label={t("Search")} onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="command-input">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder={t("Search races, states and pages…")} aria-label={t("Search")} aria-controls="command-results" aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined} />
          <kbd>esc</kbd>
        </div>
        <div className="command-results" id="command-results" role="listbox" ref={listRef}>
          <span className="command-highlight" ref={highlightRef} aria-hidden="true" />
          {results.map((item, index) => {
            const heading = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return <div key={item.id}>
              {heading && <p className="command-group">{t(heading)}</p>}
              <button type="button" role="option" id={`command-${item.id}`} aria-selected={index === active} data-index={index} className="command-item" onMouseMove={() => setActive(index)} onClick={() => go(item)}>
                <span className={item.tone ? `${item.tone}-text` : ""}>{item.label}</span><small>{item.meta}</small><kbd>↵</kbd>
              </button>
            </div>;
          })}
          {results.length === 0 && <p className="command-empty">{t("No match for “{query}”.", { query })}</p>}
        </div>
        <div className="command-foot"><span><kbd>↑</kbd><kbd>↓</kbd> {t("navigate")}</span><span><kbd>↵</kbd> {t("open")}</span><span><kbd>⌘</kbd><kbd>K</kbd> {t("toggle")}</span></div>
      </div>
    </div>
  );
}
