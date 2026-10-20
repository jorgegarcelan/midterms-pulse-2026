"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIntlLocale, useT } from "@/components/i18n/locale-provider";
import { DISTRICT_HUES, DistrictBoard } from "@/components/gerrymander/district-board";
import { useEnsemble } from "@/components/gerrymander/use-ensemble";
import { CELLS, DISTRICTS, EXAMPLE_MAPS, SIZE, colOf, parseMap, rowOf, tally } from "@/lib/gerrymander";

type GoalKey = "red" | "blue" | "fair" | "free";
const GOALS: { key: GoalKey; label: string; brief: string; test: (blue: number) => boolean; solution: string | null }[] = [
  { key: "red", label: "Make Red win", brief: "Red has 40% of the votes. Draw a map where Red wins at least 3 of the 5 districts.", test: (blue) => blue <= 2, solution: EXAMPLE_MAPS.red },
  { key: "blue", label: "Blue sweep", brief: "Give Blue all five districts. Hard: only a handful of maps do it.", test: (blue) => blue === 5, solution: EXAMPLE_MAPS.blue },
  { key: "fair", label: "Proportional", brief: "Draw a map where seats match votes: Blue 3, Red 2.", test: (blue) => blue === 3, solution: EXAMPLE_MAPS.fair },
  { key: "free", label: "Free draw", brief: "No goal. Draw anything and see where it lands among all possible maps.", test: () => true, solution: null },
];

const empty = () => new Array<number>(CELLS).fill(-1);
const VIEW = SIZE * 100 + 16;

export function DrawGame({ onValidMap }: { onValidMap: (blueSeats: number) => void }) {
  const t = useT();
  const intl = useIntlLocale();
  const ensemble = useEnsemble();
  const [goal, setGoal] = useState<GoalKey>("red");
  const [assign, setAssign] = useState<number[]>(empty);
  const [brush, setBrush] = useState(0);
  const [full, setFull] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stroke = useRef<{ mode: "paint" | "erase"; last: number } | null>(null);
  const playback = useRef(0);

  const result = useMemo(() => tally(assign), [assign]);
  const active = GOALS.find((item) => item.key === goal)!;
  const won = result.valid && active.test(result.seats.B);
  const filled = assign.filter((district) => district >= 0).length;

  useEffect(() => { if (result.valid) onValidMap(result.seats.B); }, [result, onValidMap]);
  useEffect(() => () => window.clearInterval(playback.current), []);
  useEffect(() => {
    if (full === null) return;
    const timer = window.setTimeout(() => setFull(null), 900);
    return () => window.clearTimeout(timer);
  }, [full]);

  const stopPlayback = () => window.clearInterval(playback.current);

  const cellAt = (event: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * VIEW - 8;
    const y = (event.clientY - rect.top) / rect.height * VIEW - 8;
    const col = Math.floor(x / 100);
    const row = Math.floor(y / 100);
    return col < 0 || row < 0 || col >= SIZE || row >= SIZE ? -1 : row * SIZE + col;
  };

  // A ref mirrors the board so fast drags never paint from a stale copy between renders.
  const assignRef = useRef(assign);
  const commit = (next: number[]) => { assignRef.current = next; setAssign(next); };
  const countOf = (district: number) => assignRef.current.filter((value) => value === district).length;

  const apply = (cell: number, mode: "paint" | "erase") => {
    const current = assignRef.current;
    if (mode === "erase") {
      if (current[cell] < 0 || (brush >= 0 && current[cell] !== brush)) return;
      const next = [...current];
      next[cell] = -1;
      commit(next);
      return;
    }
    if (current[cell] === brush) return;
    if (countOf(brush) >= SIZE) { setFull(brush); return; }
    const next = [...current];
    next[cell] = brush;
    commit(next);
  };

  const onDown = (event: React.PointerEvent<SVGSVGElement>) => {
    const cell = cellAt(event);
    if (cell < 0) return;
    stopPlayback();
    event.currentTarget.setPointerCapture(event.pointerId);
    // Starting a stroke on your own district (or with the eraser) erases; anywhere else paints.
    const mode = brush < 0 || assign[cell] === brush ? "erase" : "paint";
    stroke.current = { mode, last: cell };
    apply(cell, mode);
  };
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!stroke.current) return;
    const cell = cellAt(event);
    if (cell < 0 || cell === stroke.current.last) return;
    // Fast drags skip cells between pointer events; walk the gap one orthogonal step at a time.
    let row = rowOf(stroke.current.last);
    let col = colOf(stroke.current.last);
    while (row * SIZE + col !== cell) {
      if (Math.abs(rowOf(cell) - row) >= Math.abs(colOf(cell) - col)) row += Math.sign(rowOf(cell) - row);
      else col += Math.sign(colOf(cell) - col);
      apply(row * SIZE + col, stroke.current.mode);
    }
    stroke.current.last = cell;
  };
  const onUp = () => {
    if (!stroke.current) return;
    stroke.current = null;
    // A finished district hands the pen to the next one that still needs voters.
    if (brush >= 0 && countOf(brush) >= SIZE) {
      const next = Array.from({ length: DISTRICTS }, (_, i) => (brush + 1 + i) % DISTRICTS).find((d) => countOf(d) < SIZE);
      if (next !== undefined) setBrush(next);
    }
  };

  // Keys 1–5 pick a district, 0 or E the eraser.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.metaKey || event.ctrlKey) return;
      if (/^[1-5]$/.test(event.key)) setBrush(Number(event.key) - 1);
      else if (event.key === "0" || event.key.toLowerCase() === "e") setBrush(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reset = () => { stopPlayback(); commit(empty()); setBrush(0); };
  const showSolution = () => {
    if (!active.solution) return;
    stopPlayback();
    const target = parseMap(active.solution);
    const order = Array.from({ length: CELLS }, (_, cell) => cell).sort((a, b) => target[a] - target[b] || a - b);
    let step = 0;
    commit(empty());
    playback.current = window.setInterval(() => {
      const cell = order[step++];
      const next = [...assignRef.current];
      next[cell] = target[cell];
      commit(next);
      if (step >= order.length) stopPlayback();
    }, 55);
  };

  const matching = ensemble ? ensemble.seats.filter(active.test).length : null;
  const total = ensemble?.maps.length ?? 4006;
  const sameResult = ensemble && result.valid ? ensemble.counts[result.seats.B] : null;

  return (
    <div className="gm-game" data-won={won && goal !== "free" ? "" : undefined}>
      <div className="gm-goals" role="tablist" aria-label={t("Goal")}>
        {GOALS.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={goal === item.key} className={goal === item.key ? "on" : ""} onClick={() => { setGoal(item.key); reset(); }}>
            {t(item.label)}
          </button>
        ))}
      </div>

      <div className="gm-game-body">
        <div className="gm-game-board">
          <DistrictBoard
            ref={svgRef}
            assign={assign}
            fill="district"
            badges
            className="gm-paint"
            ariaLabel={t("Drawing board: {filled} of 25 voters assigned", { filled })}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {won && goal !== "free" && (
            <div className="gm-win" role="status">
              <div className="gm-burst" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ "--a": `${i * 20}deg`, "--d": `${(i % 3) * 40}ms` } as React.CSSProperties} />)}</div>
              <strong>{t("Gerrymander complete")}</strong>
              <span>{goal === "fair" ? t("Seats now match votes.") : t("Same voters, the result you wanted.")}</span>
            </div>
          )}
        </div>

        <div className="gm-game-side">
          <p className="gm-brief">{t(active.brief)}</p>
          {matching !== null && goal !== "free" && (
            <p className="gm-odds">{t("{count} of {total} possible maps do it", { count: matching.toLocaleString(intl), total: total.toLocaleString(intl) })} <b>· {(matching / total * 100).toLocaleString(intl, { maximumFractionDigits: matching / total < .01 ? 2 : 0 })}%</b></p>
          )}

          <div className="gm-brushes" role="radiogroup" aria-label={t("District to paint")}>
            {result.districts.map((district) => {
              const status = district.cells.length === SIZE ? (district.contiguous ? "done" : "split") : "open";
              return (
                <button
                  key={district.id}
                  type="button"
                  role="radio"
                  aria-checked={brush === district.id}
                  className={`gm-brush ${brush === district.id ? "on" : ""} ${status}${full === district.id ? " shake" : ""}`}
                  style={{ "--hue": DISTRICT_HUES[district.id] } as React.CSSProperties}
                  onClick={() => setBrush(district.id)}
                >
                  <i />
                  <span>{t("District {n}", { n: district.id + 1 })}</span>
                  <small>{status === "split" ? t("not connected") : `${district.cells.length}/5`}</small>
                  {district.winner && <b className={district.winner === "B" ? "blue" : "red"}>{district.winner === "B" ? t("Blue") : t("Red")} {Math.max(district.blue, district.red)}–{Math.min(district.blue, district.red)}</b>}
                </button>
              );
            })}
            <button type="button" role="radio" aria-checked={brush === -1} className={`gm-brush eraser ${brush === -1 ? "on" : ""}`} onClick={() => setBrush(-1)}>
              <i /><span>{t("Eraser")}</span><small>E</small>
            </button>
          </div>

          <div className="gm-game-score">
            <div><span>{t("Seats")}</span><b className="blue">{result.seats.B}</b><b className="red">{result.seats.R}</b></div>
            <div><span>{t("Wasted votes")}</span><b className="blue">{result.wasted.B}</b><b className="red">{result.wasted.R}</b></div>
          </div>

          <p className="gm-game-status" aria-live="polite">
            {result.valid
              ? t("Valid map. {count} of the {total} possible maps give this same result.", { count: (sameResult ?? 0).toLocaleString(intl), total: total.toLocaleString(intl) })
              : filled === 0
                ? t("Tip: drag to paint. Start a stroke on your own district to erase.")
                : t("{left} voters left to assign.", { left: CELLS - filled })}
          </p>

          <div className="gm-game-actions">
            <button type="button" className="viz-button" onClick={reset}>{t("Clear")}</button>
            {active.solution && <button type="button" className="viz-button" onClick={showSolution}>{t("Show a solution")}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
