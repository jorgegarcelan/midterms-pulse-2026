"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalePath, useT } from "@/components/i18n/locale-provider";
import { percent } from "@/components/night/use-night";
import { POLL_CLOSING } from "@/data/poll-closing";
import { clockNow, closingTime, etClock, raceKey, SCENARIOS, spainClock, type NightCall, type NightState, type Scenario, type Winner } from "@/lib/night";
import { raceName } from "@/lib/races";

type DeskState = NightState & { pending: number; store: "redis" | "file" | "none"; rehearsalActive: boolean };
type DeskRace = { key: string; name: string; state: string; chamber: "house" | "senate"; p: number; signed: number };
type ModelRace = { chamber: "house" | "senate"; code: string; state: string; signedMargin: number; leader: "D" | "R"; winProbability: number };

const TOKEN_KEY = "night-desk-token";
// This browser's copy of the live calls, in case the store (a free Redis without persistence) is wiped mid-night.
const BACKUP_KEY = "night-desk-backup";
// A race the model gives at least 97% is called at poll closing on a normal night: one click calls them all.
const SAFE = 97;
const SPEEDS = [1, 10, 20, 30, 60];
const SCENARIO_LABEL: Record<Scenario, string> = { forecast: "The polls are right", "dem-wave": "Democrats beat the polls by 4", "rep-wave": "Republicans beat the polls by 4", random: "Random night" };

const readToken = () => { try { return window.localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
const writeToken = (value: string) => { try { if (value) window.localStorage.setItem(TOKEN_KEY, value); else window.localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };
const readBackup = (): NightCall[] => { try { return JSON.parse(window.localStorage.getItem(BACKUP_KEY) || "[]"); } catch { return []; } };
const writeBackup = (calls: NightCall[] | null) => { try { if (calls) window.localStorage.setItem(BACKUP_KEY, JSON.stringify(calls)); else window.localStorage.removeItem(BACKUP_KEY); } catch { /* private mode */ } };

// The call desk: mark races called as the networks project them, and run rehearsals of the night.
export function CallDesk() {
  const t = useT();
  const localize = useLocalePath();
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  // Ask for the rehearsal first: the server answers with the live night when none is running.
  const [slot, setSlot] = useState<"live" | "rehearsal">("rehearsal");
  const [desk, setDesk] = useState<DeskState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [races, setRaces] = useState<DeskRace[]>([]);
  const [query, setQuery] = useState("");
  const [scenario, setScenario] = useState<Scenario>("random");
  const [speed, setSpeed] = useState(20);
  const [skew, setSkew] = useState(0);
  const [real, setReal] = useState(0);
  const [lost, setLost] = useState<NightCall[]>([]);

  useEffect(() => { const timer = window.setTimeout(() => setToken(readToken()), 0); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    fetch("/api/model").then((response) => response.json()).then((model: { races: ModelRace[] }) => setRaces(model.races.map((race) => ({
      key: raceKey(race), name: raceName(race, t), state: race.state, chamber: race.chamber, signed: race.signedMargin,
      p: race.leader === "D" ? race.winProbability : 100 - race.winProbability,
    })))).catch(() => setError(t("Could not load the races.")));
  }, [t]);

  const send = useCallback(async (body: Record<string, unknown>) => {
    if (!token) return;
    setBusy(body.action !== "state");
    try {
      const response = await fetch("/api/night", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || response.statusText);
      setDesk(json);
      setSlot(json.mode);
      if (json.mode === "live") {
        // Emptied on purpose (reset, or the last call undone): drop the copy too.
        if (json.calls.length) writeBackup(json.calls);
        else if (body.action === "reset" || body.action === "uncall") writeBackup(null);
        // Empty store but calls in this browser: the store was wiped, offer to put them back.
        setLost(json.calls.length ? [] : readBackup());
      }
      setSkew(Date.parse(json.serverNow) - Date.now());
      setReal(Date.now());
      setError("");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally { setBusy(false); }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const load = () => send({ action: "state", slot });
    const first = window.setTimeout(load, 0);
    const poll = window.setInterval(load, 5000);
    const tick = window.setInterval(() => setReal(Date.now()), 1000);
    return () => { window.clearTimeout(first); window.clearInterval(poll); window.clearInterval(tick); };
  }, [token, slot, send]);

  const now = desk && real ? clockNow(desk.clock, real + skew) : 0;
  const calls = useMemo(() => new Map((desk?.calls ?? []).map((call) => [call.key, call])), [desk]);
  const names = useMemo(() => new Map(races.map((race) => [race.key, race.name])), [races]);
  const slots = useMemo(() => [...new Set(POLL_CLOSING.map((state) => state.close))].sort().map((close) => {
    const codes = new Set(POLL_CLOSING.filter((state) => state.close === close).map((state) => state.code));
    const list = races.filter((race) => codes.has(race.state)).sort((a, b) => Math.abs(a.signed) - Math.abs(b.signed));
    return { close, at: closingTime(close), codes: [...codes], contested: list.filter((race) => race.p < SAFE && race.p > 100 - SAFE), safe: list.filter((race) => race.p >= SAFE || race.p <= 100 - SAFE) };
  }), [races]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? races.filter((race) => race.name.toLowerCase().includes(needle) || race.key.toLowerCase().includes(needle)).slice(0, 30) : [];
  }, [query, races]);

  const call = (key: string, winner: Winner) => send({ action: "call", slot, calls: [{ key, winner }] });
  const uncall = (key: string) => send({ action: "uncall", slot, keys: [key] });
  const callSafe = (list: DeskRace[]) => {
    const open = list.filter((race) => !calls.has(race.key));
    if (open.length) send({ action: "call", slot, calls: open.map((race) => ({ key: race.key, winner: race.signed >= 0 ? "D" : "R" })) });
  };

  if (!token) return <section className="panel desk-login">
    <p className="eyebrow">{t("CALL DESK")}</p>
    <h1>{t("Desk token")}</h1>
    <p>{t("The token is the DESK_TOKEN variable set on the server. It stays in this browser only.")}</p>
    <form onSubmit={(event) => { event.preventDefault(); writeToken(draft.trim()); setToken(draft.trim()); }}>
      <input type="password" autoComplete="off" value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={t("Desk token")} />
      <button type="submit">{t("Enter")}</button>
    </form>
  </section>;

  const row = (race: DeskRace) => {
    const made = calls.get(race.key);
    return <div key={race.key} className={`desk-race${made ? ` called ${made.winner === "D" ? "dem" : "rep"}` : ""}`}>
      <span className="desk-race-name">{race.name}</span>
      <span className="desk-race-model">{race.signed >= 0 ? "D" : "R"}+{Math.abs(race.signed).toFixed(1)} · {race.p}% D</span>
      <span className="desk-race-status">{made ? `✓ ${made.winner} ${spainClock(Date.parse(made.at))}` : "—"}</span>
      <span className="desk-race-actions">
        <button type="button" className="dem" disabled={busy || made?.winner === "D"} onClick={() => call(race.key, "D")}>D</button>
        <button type="button" className="rep" disabled={busy || made?.winner === "R"} onClick={() => call(race.key, "R")}>R</button>
        <button type="button" disabled={busy || !made} onClick={() => uncall(race.key)} aria-label={t("Undo call")}>✕</button>
      </span>
    </div>;
  };

  const running = desk?.mode === "rehearsal" && desk.clock;
  const canRehearse = !desk?.rehearsalActive;
  return <div className={`desk${slot === "rehearsal" ? " rehearsal" : ""}`}>
    <header className="desk-head">
      <div>
        <p className="eyebrow">{slot === "rehearsal" ? t("CALL DESK · REHEARSAL") : t("CALL DESK · LIVE")}</p>
        {desk?.rehearsalActive && <div className="segmented desk-slot-toggle">
          <button type="button" className={slot === "rehearsal" ? "selected" : ""} onClick={() => setSlot("rehearsal")}>{t("Rehearsal")}</button>
          <button type="button" className={slot === "live" ? "selected" : ""} onClick={() => setSlot("live")}>{t("Live")}</button>
        </div>}
        <p className="desk-clock"><strong>{now ? spainClock(now, true) : "—"}</strong> {t("in Spain")}{now ? ` · ${etClock(now)} ET` : ""}</p>
      </div>
      {desk?.house && desk.senate && <div className="desk-score">
        <span>{t("House")} <b className="dem-text">{desk.house.locked.D}</b>–<b className="rep-text">{desk.house.locked.R}</b> · {percent(desk.house.controlD)} D</span>
        <span>{t("Senate")} <b className="dem-text">{desk.senate.locked.D}</b>–<b className="rep-text">{desk.senate.locked.R}</b> · {percent(desk.senate.controlD)} D</span>
      </div>}
      <button type="button" className="desk-signout" onClick={() => { writeToken(""); setToken(""); setDesk(null); }}>{t("Sign out")}</button>
    </header>

    {error && <p className="desk-error" role="alert">{error}</p>}
    {slot === "live" && lost.length > 0 && <p className="desk-error" role="alert">
      {t("The store has no live calls, but this browser kept {n}. If the database was wiped, put them back:", { n: lost.length })}{" "}
      <button type="button" disabled={busy} onClick={() => send({ action: "restore", calls: lost })}>{t("Restore {n} calls", { n: lost.length })}</button>{" "}
      <button type="button" disabled={busy} onClick={() => { writeBackup(null); setLost([]); }}>{t("Discard the copy")}</button>
    </p>}
    {desk?.store === "none" && <p className="desk-error">{t("No results store on this deployment: connect a Redis database in Vercel (Storage) before the night. Calls cannot be saved.")}</p>}

    <section className="panel desk-controls">
      {running ? <>
        <p><b>{t("Rehearsal running")}</b> · {t("scenario: {name}", { name: t(SCENARIO_LABEL[(desk.scenario || "random") as Scenario]) })} · ×{desk.clock!.speed} · {t("{n} scripted calls still to come", { n: desk.pending })}</p>
        <div className="desk-buttons">
          <button type="button" disabled={busy} onClick={() => send({ action: "clock", speed: desk.clock!.speed ? 0 : speed })}>{desk.clock!.speed ? t("Pause") : t("Resume")}</button>
          <select value={desk.clock!.speed || speed} onChange={(event) => { const next = Number(event.target.value); setSpeed(next); send({ action: "clock", speed: next }); }} aria-label={t("Speed")}>{SPEEDS.map((value) => <option key={value} value={value}>×{value}</option>)}</select>
          <button type="button" disabled={busy} onClick={() => send({ action: "clock", jump: new Date(now + 30 * 60_000).toISOString() })}>{t("+30 min")}</button>
          <button type="button" disabled={busy} onClick={() => send({ action: "clock", jump: new Date(now - 30 * 60_000).toISOString() })}>{t("−30 min")}</button>
          <a href={`${localize("/election-night")}?rehearsal=1`} target="_blank" rel="noreferrer">{t("Open guide")} ↗</a>
          <a href={`${localize("/stream/night")}?rehearsal=1`} target="_blank" rel="noreferrer">{t("Open stream scene")} ↗</a>
          <button type="button" className="danger" disabled={busy} onClick={() => send({ action: "stop" })}>{t("End rehearsal")}</button>
        </div>
      </> : <>
        <p>{t("Live calls are public within seconds. Practise first with a rehearsal: a simulated night on a sped-up clock, visible only with ?rehearsal=1.")}</p>
        <div className="desk-buttons">
          <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)} aria-label={t("Scenario")}>{SCENARIOS.map((value) => <option key={value} value={value}>{t(SCENARIO_LABEL[value])}</option>)}</select>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label={t("Speed")}>{SPEEDS.map((value) => <option key={value} value={value}>×{value}</option>)}</select>
          <button type="button" disabled={busy || !canRehearse} onClick={() => send({ action: "rehearse", scenario, speed })}>{t("Start rehearsal")}</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm(t("Freeze the forecast as it stands now as the baseline for the night?"))) send({ action: "freeze" }); }}>{t("Freeze forecast")}</button>
          <button type="button" className="danger" disabled={busy} onClick={() => { const typed = window.prompt(t("Type RESET to delete every live call.")); if (typed) send({ action: "reset", confirm: typed }); }}>{t("Clear live calls")}</button>
        </div>
      </>}
      {desk?.baseline && <p className="desk-meta">{t("Baseline: {version} of {date}", { version: desk.baseline.version, date: desk.baseline.runDate })} · {t("store: {kind}", { kind: desk.store })}</p>}
    </section>

    <div className="desk-grid">
      <div className="desk-main">
        <input className="desk-search" type="search" placeholder={t("Find a race: PA-07, Georgia…")} value={query} onChange={(event) => setQuery(event.target.value)} />
        {matches.length > 0 && <section className="panel desk-slot">{matches.map(row)}</section>}
        {slots.map((item) => {
          const closed = now >= item.at;
          const safeOpen = item.safe.filter((race) => !calls.has(race.key));
          return <section key={item.close} className={`panel desk-slot${closed ? " closed" : ""}`}>
            <header>
              <strong>{spainClock(item.at)}</strong>
              <span>{item.codes.join(" ")}</span>
              <em>{closed ? t("polls closed") : t("open")}</em>
              {/* Networks never project a state before its polls close. */}
              <button type="button" disabled={busy || !closed || !safeOpen.length} onClick={() => callSafe(item.safe)}>{t("Call {n} safe seats", { n: safeOpen.length })}</button>
            </header>
            {item.contested.map(row)}
            {item.safe.length > 0 && <details><summary>{t("{n} safe seats ({called} called)", { n: item.safe.length, called: item.safe.length - safeOpen.length })}</summary>{item.safe.map(row)}</details>}
          </section>;
        })}
      </div>
      <aside className="panel desk-log">
        <p className="eyebrow">{t("LATEST CALLS")}</p>
        <ol>{(desk?.calls ?? []).slice(0, 40).map((made) => <li key={made.key}>
          <time>{spainClock(Date.parse(made.at))}</time><b className={made.winner === "D" ? "dem-text" : "rep-text"}>{made.winner}</b><span>{names.get(made.key) || made.key}</span>
          <button type="button" disabled={busy} onClick={() => uncall(made.key)}>{t("Undo")}</button>
        </li>)}</ol>
      </aside>
    </div>
  </div>;
}
