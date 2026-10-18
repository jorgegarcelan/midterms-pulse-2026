"use client";

import { useEffect, useState } from "react";
import { clockNow, type NightState } from "@/lib/night";

const POLL_MS = 15_000;

// ?rehearsal=1 on any night view shows the running rehearsal instead of the real night. Null until read,
// so a rehearsal view never flashes the real night first.
export function useRehearsalFlag() {
  const [rehearsal, setRehearsal] = useState<boolean | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setRehearsal(new URLSearchParams(window.location.search).get("rehearsal") === "1"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return rehearsal;
}

/*
  The night's calls and odds, polled every 15 seconds, plus a clock that ticks every second between
  polls: real time on the night, the simulated time in a rehearsal (corrected for this device's
  clock being off from the server's).
*/
export function useNight(rehearsal: boolean | null) {
  const [state, setState] = useState<NightState | null>(null);
  const [skew, setSkew] = useState(0);
  const [real, setReal] = useState(0);
  useEffect(() => {
    if (rehearsal === null) return;
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/night${rehearsal ? "?rehearsal=1" : ""}`);
        if (!response.ok) return;
        const next = await response.json() as NightState;
        // An edge-cached answer is `Age` seconds old: its serverNow is that much behind.
        const age = Number(response.headers.get("age")) || 0;
        if (alive) { setState(next); setSkew(Date.parse(next.serverNow) + age * 1000 - Date.now()); setReal(Date.now()); }
      } catch { /* keep the last state */ }
    };
    load();
    const poll = window.setInterval(load, POLL_MS);
    const tick = window.setInterval(() => setReal(Date.now()), 1000);
    return () => { alive = false; window.clearInterval(poll); window.clearInterval(tick); };
  }, [rehearsal]);
  const now = state && real ? clockNow(state.clock, real + skew) : 0;
  return { state, now };
}

export const percent = (value: number) => value >= .995 ? ">99%" : value <= .005 ? "<1%" : `${Math.round(value * 100)}%`;
