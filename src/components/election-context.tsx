"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChamberFilter, ElectionCycle } from "@/data/geography";

type ElectionContextValue = {
  stateCode: string;
  county: string;
  cycle: ElectionCycle;
  chamber: ChamberFilter;
  pinnedStates: string[];
  setContext: (next: Partial<Pick<ElectionContextValue, "stateCode" | "county" | "cycle" | "chamber">>) => void;
  togglePinnedState: (code: string) => void;
};

const ElectionContext = createContext<ElectionContextValue | null>(null);
const STORAGE_KEY = "midterm-pulse-context";

function validCycle(value: string | null): ElectionCycle {
  return value === "2016" || value === "2020" || value === "2024" || value === "2026" ? value : "2026";
}

function validChamber(value: string | null): ChamberFilter {
  return value === "house" || value === "senate" ? value : "all";
}

export function ElectionContextProvider({ children }: { children: React.ReactNode }) {
  const [stateCode, setStateCode] = useState("US");
  const [county, setCounty] = useState("");
  const [cycle, setCycle] = useState<ElectionCycle>("2026");
  const [chamber, setChamber] = useState<ChamberFilter>("all");
  const [pinnedStates, setPinnedStates] = useState<string[]>(["AZ", "PA"]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let saved: Partial<ElectionContextValue> = {};
    try { saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* optional preference */ }
    const nextState = (params.get("state") || saved.stateCode || "US").toUpperCase();
    const timer = window.setTimeout(() => {
      setStateCode(nextState);
      setCounty(params.get("county") || saved.county || "");
      setCycle(validCycle(params.get("cycle") || saved.cycle || null));
      setChamber(validChamber(params.get("chamber") || saved.chamber || null));
      if (Array.isArray(saved.pinnedStates)) setPinnedStates(saved.pinnedStates.filter((item): item is string => typeof item === "string").slice(0, 4));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setContext = useCallback((next: Partial<Pick<ElectionContextValue, "stateCode" | "county" | "cycle" | "chamber">>) => {
    const state = next.stateCode ?? stateCode;
    const nextCounty = next.county ?? county;
    const nextCycle = next.cycle ?? cycle;
    const nextChamber = next.chamber ?? chamber;
    setStateCode(state);
    setCounty(nextCounty);
    setCycle(nextCycle);
    setChamber(nextChamber);
    const url = new URL(window.location.href);
    if (state === "US") url.searchParams.delete("state"); else url.searchParams.set("state", state);
    if (nextCounty) url.searchParams.set("county", nextCounty); else url.searchParams.delete("county");
    if (nextCycle === "2026") url.searchParams.delete("cycle"); else url.searchParams.set("cycle", nextCycle);
    if (nextChamber === "all") url.searchParams.delete("chamber"); else url.searchParams.set("chamber", nextChamber);
    window.history.replaceState({}, "", url);
  }, [chamber, county, cycle, stateCode]);

  const togglePinnedState = useCallback((code: string) => {
    setPinnedStates((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code].slice(-4));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ stateCode, county, cycle, chamber, pinnedStates }));
  }, [chamber, county, cycle, pinnedStates, stateCode]);

  const value = useMemo(() => ({ stateCode, county, cycle, chamber, pinnedStates, setContext, togglePinnedState }), [chamber, county, cycle, pinnedStates, setContext, stateCode, togglePinnedState]);
  return <ElectionContext.Provider value={value}>{children}</ElectionContext.Provider>;
}

export function useElectionContext() {
  const value = useContext(ElectionContext);
  if (!value) throw new Error("useElectionContext must be used inside ElectionContextProvider");
  return value;
}
