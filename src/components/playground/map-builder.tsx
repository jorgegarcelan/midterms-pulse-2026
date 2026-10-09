"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/i18n/locale-provider";
import { CountUp } from "@/components/motion/count-up";
import { copyText, useResource } from "@/components/playground/hooks";
import { exportMapImage } from "@/components/playground/map-export";
import { loadMapGeometry, MAP_HEIGHT, MAP_WIDTH } from "@/lib/playground/geo";
import { signedLabel } from "@/lib/playground/math";
import { decodePicks, encodePicks, type Pick, type Picks } from "@/lib/playground/picks";
import { patchUrl, type PlayRace } from "@/lib/playground/types";
import { raceName } from "@/lib/races";
import { seatsNotUp } from "@/lib/senate-sim";

type Chamber = "senate" | "house";
type Brush = "cycle" | "D" | "R" | "clear";
type Start = "model" | "safe" | "blank";
type Props = { races: PlayRace[]; initial: Record<string, string | undefined> };

export const PICK_COLORS = { D: "#4f7df5", R: "#f0566b", none: "#3a3e4b", off: "#1b1e27" } as const;
const SAFE = 10;

function startPicks(races: PlayRace[], start: Start): Picks {
  if (start === "blank") return {};
  return Object.fromEntries(races.filter((race) => start === "model" || Math.abs(race.signedMargin) >= SAFE).map((race) => [race.code, race.signedMargin >= 0 ? "D" : "R"]));
}
const nextPick = (pick: Pick | undefined): Pick | undefined => pick === undefined ? "D" : pick === "D" ? "R" : undefined;

// Click or drag across the map to call races; totals, the URL and the downloadable image follow every stroke.
export function MapBuilder({ races, initial }: Props) {
  const t = useT();
  const byChamber = useMemo(() => ({
    senate: races.filter((race) => race.chamber === "senate").sort((a, b) => a.code.localeCompare(b.code)),
    house: races.filter((race) => race.chamber === "house").sort((a, b) => a.code.localeCompare(b.code)),
  }), [races]);
  const codes = useMemo(() => ({ senate: byChamber.senate.map((race) => race.code), house: byChamber.house.map((race) => race.code) }), [byChamber]);
  const notUp = useMemo(() => seatsNotUp(byChamber.senate.map((race) => ({ ...race, margin: race.margin }))), [byChamber]);

  const [chamber, setChamber] = useState<Chamber>(initial.c === "house" ? "house" : "senate");
  const [picks, setPicks] = useState<Record<Chamber, Picks>>(() => {
    const chosen: Chamber = initial.c === "house" ? "house" : "senate";
    const fromUrl = decodePicks(codes[chosen], initial.p);
    return {
      senate: chosen === "senate" && fromUrl ? fromUrl : startPicks(byChamber.senate, "model"),
      house: chosen === "house" && fromUrl ? fromUrl : startPicks(byChamber.house, "model"),
    };
  });
  const [history, setHistory] = useState<Record<Chamber, Picks[]>>({ senate: [], house: [] });
  const [brush, setBrush] = useState<Brush>("cycle");
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "copied" | "exporting" | "error">("");
  const geometry = useResource(loadMapGeometry);
  const root = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ value: Pick | undefined; done: Set<string> } | null>(null);

  const current = picks[chamber];
  const list = byChamber[chamber];
  const raceByCode = useMemo(() => new Map(list.map((race) => [race.code, race])), [list]);

  useEffect(() => { patchUrl({ c: chamber === "senate" ? null : chamber, p: encodePicks(codes[chamber], picks[chamber]) }); }, [chamber, codes, picks]);

  const commit = useCallback((next: Picks) => {
    setHistory((stack) => ({ ...stack, [chamber]: [...stack[chamber].slice(-99), picks[chamber]] }));
    setPicks((all) => ({ ...all, [chamber]: next }));
  }, [chamber, picks]);

  const undo = useCallback(() => {
    const stack = history[chamber];
    if (!stack.length) return;
    setPicks((all) => ({ ...all, [chamber]: stack[stack.length - 1] }));
    setHistory((all) => ({ ...all, [chamber]: stack.slice(0, -1) }));
  }, [chamber, history]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      if (!root.current || root.current.offsetParent === null) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  function setOne(code: string, value: Pick | undefined) {
    const next = { ...current };
    if (value) next[code] = value; else delete next[code];
    commit(next);
  }

  // ---- Painting: pointerdown decides the colour, pointermove spreads it to every shape under the pointer.
  function paintValue(code: string) {
    return brush === "cycle" ? nextPick(current[code]) : brush === "clear" ? undefined : brush;
  }
  function codeAt(x: number, y: number) {
    const element = document.elementFromPoint(x, y) as SVGElement | null;
    const code = element?.getAttribute?.("data-code");
    return code && raceByCode.has(code) ? code : null;
  }
  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const code = codeAt(event.clientX, event.clientY);
    if (!code) return;
    event.preventDefault();
    const value = paintValue(code);
    stroke.current = { value, done: new Set([code]) };
    setOne(code, value);
  }
  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const code = codeAt(event.clientX, event.clientY);
    const rect = event.currentTarget.getBoundingClientRect();
    setHover(code ? { code, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    const active = stroke.current;
    if (!active || !code || active.done.has(code)) return;
    active.done.add(code);
    setPicks((all) => {
      const next = { ...all[chamber] };
      if (active.value) next[code] = active.value; else delete next[code];
      return { ...all, [chamber]: next };
    });
  }
  const endStroke = () => { stroke.current = null; };

  function reset(start: Start) { commit(startPicks(list, start)); }

  // ---- Totals
  const counted = list.reduce((sum, race) => { const pick = current[race.code]; if (pick) sum[pick] += 1; return sum; }, { D: 0, R: 0 });
  const base = chamber === "senate" ? notUp : { D: 0, R: 0 };
  const total = chamber === "senate" ? 100 : 435;
  const majority = chamber === "senate" ? 51 : 218;
  const dem = base.D + counted.D;
  const rep = base.R + counted.R;
  const open = total - dem - rep;
  const repControl = chamber === "senate" ? total - majority + 1 : majority; // 50 Senate seats + the VP
  const verdict = dem >= majority ? t(chamber === "senate" ? "Democrats win the Senate" : "Democrats win the House")
    : rep >= repControl ? t(chamber === "senate" ? "Republicans win the Senate" : "Republicans win the House")
    : t("{open} seats undecided · Democrats need {d} more, Republicans {r}", { open, d: majority - dem, r: repControl - rep });

  const shapes = geometry.data ? (chamber === "senate" ? geometry.data.states : geometry.data.districts) : [];
  const fillFor = (code: string) => raceByCode.has(code) ? PICK_COLORS[current[code] ?? "none"] : PICK_COLORS.off;

  const sideRaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...list].sort((a, b) => Math.abs(a.signedMargin) - Math.abs(b.signedMargin));
    if (!needle) return chamber === "senate" ? sorted : sorted.slice(0, 60);
    return sorted.filter((race) => `${race.code} ${raceName(race, t)}`.toLowerCase().includes(needle)).slice(0, 80);
  }, [chamber, list, query, t]);

  async function download() {
    if (!geometry.data) return;
    setStatus("exporting");
    try {
      await exportMapImage({
        shapes, fill: fillFor, title: t(chamber === "senate" ? "My 2026 Senate map" : "My 2026 House map"),
        dem, rep, open, majority, total, verdict,
        labels: { dem: t("Democrats"), rep: t("Republicans"), open: t("Undecided"), majority: t("{n} for majority", { n: majority }) },
        filename: `midterm-pulse-${chamber}-map.png`,
      });
      setStatus("");
    } catch {
      setStatus("error");
    }
  }

  async function copyLink() {
    if (await copyText(window.location.href)) { setStatus("copied"); window.setTimeout(() => setStatus(""), 1800); }
  }

  const hoverRace = hover ? raceByCode.get(hover.code) : null;

  return <div className="pg-builder" ref={root}>
    <div className="pg-builder-main panel">
      <div className="pg-toolbar">
        <div className="pg-seg" role="group" aria-label={t("Chamber")}>
          {(["senate", "house"] as const).map((key) => <button key={key} type="button" aria-pressed={chamber === key} onClick={() => { setChamber(key); setHover(null); }}>{t(key === "senate" ? "Senate" : "House")}</button>)}
        </div>
        <div className="pg-seg" role="group" aria-label={t("Brush")}>
          <button type="button" aria-pressed={brush === "cycle"} onClick={() => setBrush("cycle")} title={t("Each click cycles D → R → undecided")}>{t("Cycle")}</button>
          <button type="button" className="d" aria-pressed={brush === "D"} onClick={() => setBrush("D")}>D</button>
          <button type="button" className="r" aria-pressed={brush === "R"} onClick={() => setBrush("R")}>R</button>
          <button type="button" aria-pressed={brush === "clear"} onClick={() => setBrush("clear")}>{t("Undecided")}</button>
        </div>
        <span className="pg-spacer" />
        <button type="button" className="pg-button ghost" onClick={undo} disabled={!history[chamber].length} title={t("Undo (Ctrl/⌘ Z)")}>↶ {t("Undo")}</button>
      </div>

      <div className="pg-tally">
        <div className="pg-tally-numbers">
          <strong className="dem">D <CountUp value={dem} duration={450} /></strong>
          <span className="mid"><b>{t("{n} for majority", { n: majority })}</b>{open > 0 && <span>{t("{n} undecided", { n: open })}</span>}</span>
          <strong className="rep"><CountUp value={rep} duration={450} /> R</strong>
        </div>
        <div className="pg-tally-bar" role="img" aria-label={t("{dem} Democratic, {rep} Republican, {open} undecided", { dem, rep, open })}>
          <i className="dem" style={{ flexGrow: dem }} /><i className="none" style={{ flexGrow: open }} /><i className="rep" style={{ flexGrow: rep }} />
          <b style={{ left: `${(majority - .5) / total * 100}%` }} />
        </div>
        <p className="pg-verdict" aria-live="polite"><b>{verdict}</b>{chamber === "senate" && <> · {t("{d} D and {r} R seats are not on the ballot", { d: notUp.D, r: notUp.R })}</>}</p>
      </div>

      <div className={`pg-map ${chamber}`}>
        {geometry.error ? <div className="pg-map-loading">{t("The map boundaries could not be loaded. Use the list to call races.")}</div>
          : !geometry.data ? <div className="pg-map-loading pg-skeleton" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>{t("Loading Census boundaries…")}</div>
          : <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label={t(chamber === "senate" ? "Senate map: click or drag across states to call them" : "House map: click or drag across districts to call them")}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endStroke} onPointerCancel={endStroke} onPointerLeave={() => { endStroke(); setHover(null); }}>
            {shapes.map((shape) => {
              const race = raceByCode.get(shape.code);
              const fill = fillFor(shape.code);
              return <path
                key={shape.code}
                d={shape.d}
                data-code={race ? shape.code : undefined}
                fill={fill}
                style={chamber === "senate" ? { stroke: fill } : undefined}
                className={`${race ? "" : "off"}${hover?.code === shape.code && chamber === "house" ? " hot" : ""}`}
                tabIndex={race && chamber === "senate" ? 0 : undefined}
                role={race && chamber === "senate" ? "button" : undefined}
                aria-label={race && chamber === "senate" ? `${raceName(race, t)}: ${current[shape.code] ? t(current[shape.code] === "D" ? "Democrat" : "Republican") : t("Undecided")}` : undefined}
                onKeyDown={race ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOne(shape.code, paintValue(shape.code)); } } : undefined}
              />;
            })}
            {chamber === "senate" && <g className="pg-outlines" aria-hidden="true">
              {shapes.map((shape) => <path key={shape.code} d={shape.outline} />)}
              {hover && geometry.data.states.find((shape) => shape.code === hover.code) && <path className="hot" d={geometry.data.states.find((shape) => shape.code === hover.code)!.outline} />}
            </g>}
          </svg>}
        {hover && hover.x >= 0 && hoverRace && <div className="pg-map-tip" style={{ left: hover.x, top: hover.y }}>
          <b>{hoverRace.code}</b> {raceName(hoverRace, t)} · {t("model")} <span className={hoverRace.signedMargin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(hoverRace.signedMargin)}</span>
        </div>}
      </div>
      <p className="pg-hint">{t("Click a state or district to cycle it D → R → undecided, or pick a brush and drag across the map to paint. Undo with")} <kbd>Ctrl/⌘ Z</kbd>.</p>
    </div>

    <aside className="pg-side panel">
      <div className="pg-actions" style={{ justifyContent: "start" }}>
        <button type="button" className="pg-button" onClick={download} disabled={!geometry.data || status === "exporting"}>{status === "exporting" ? t("Rendering…") : t("Download image")}</button>
        <button type="button" className="pg-button ghost" onClick={copyLink}>{status === "copied" ? t("Link copied ✓") : t("Copy link")}</button>
      </div>
      {status === "error" && <p className="pg-error">{t("The image could not be created in this browser.")}</p>}
      <div>
        <h3>{t("Start from")}</h3>
        <div className="pg-seg" role="group" aria-label={t("Start from")} style={{ marginTop: 8 }}>
          <button type="button" onClick={() => reset("model")}>{t("Model leaners")}</button>
          <button type="button" onClick={() => reset("safe")} title={t("Only races the model has at {n}+ points", { n: SAFE })}>{t("Safe seats")}</button>
          <button type="button" onClick={() => reset("blank")}>{t("Blank")}</button>
        </div>
      </div>
      <label className="pg-field">{t(chamber === "senate" ? "Find a state" : "Find a district")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={chamber === "senate" ? "GA, Maine…" : "PA-07, Arizona…"} /></label>
      <p className="pg-hint">{query ? t("{n} matches", { n: sideRaces.length }) : chamber === "senate" ? t("All 35 races, closest first.") : t("The 60 closest races; search for any other.")}</p>
      <ul className="pg-race-list">
        {sideRaces.map((race) => {
          const pick = current[race.code];
          return <li key={race.code} className={hover?.code === race.code ? "hot" : ""} onMouseEnter={() => setHover({ code: race.code, x: -999, y: -999 })} onMouseLeave={() => setHover(null)}>
            <span><b>{race.code}</b><small>{raceName(race, t)} · <span className={race.signedMargin >= 0 ? "dem-text" : "rep-text"}>{signedLabel(race.signedMargin)}</span></small></span>
            <span className="pg-seg" role="group" aria-label={raceName(race, t)}>
              <button type="button" className="d" aria-pressed={pick === "D"} onClick={() => setOne(race.code, pick === "D" ? undefined : "D")}>D</button>
              <button type="button" className="r" aria-pressed={pick === "R"} onClick={() => setOne(race.code, pick === "R" ? undefined : "R")}>R</button>
            </span>
          </li>;
        })}
      </ul>
    </aside>
  </div>;
}
