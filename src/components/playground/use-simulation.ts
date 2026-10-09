"use client";

import { useEffect, useRef, useState } from "react";
import { simulateHouse, type ChamberOutlook } from "@/lib/chamber-sim";
import { SIMULATIONS } from "@/lib/mp26";
import { simulateSenate, type SenateOutlook, type SenateRace } from "@/lib/senate-sim";
import type { SimRequest } from "@/lib/playground/sim.worker";

export const QUICK_RUNS = 6000;
export type SimResult = { key: string; runs: number; house: ChamberOutlook; senate: SenateOutlook };

/*
  Scenario simulations in a Web Worker. While a slider moves, each change asks for a quick run
  (6,000 simulations); only one request is in flight and newer inputs replace the queued one.
  When the inputs rest for 300 ms the full 50,000-run simulation follows, with the model's own seeds,
  so an untouched scenario reproduces the published forecast exactly.
*/
export function useSimulation(key: string, house: number[], senate: SenateRace[]) {
  const [result, setResult] = useState<SimResult | null>(null);
  const worker = useRef<Worker | null>(null);
  const busy = useRef(false);
  const queued = useRef<(SimRequest & { key: string }) | null>(null);
  const keys = useRef(new Map<number, string>());
  const nextId = useRef(1);
  const shown = useRef(0);

  useEffect(() => {
    let instance: Worker | null = null;
    try {
      instance = new Worker(new URL("../../lib/playground/sim.worker.ts", import.meta.url));
    } catch {
      instance = null;
    }
    worker.current = instance;
    if (!instance) return;
    instance.onmessage = (event: MessageEvent<{ id: number; runs: number; house: ChamberOutlook; senate: SenateOutlook }>) => {
      const { id, runs, house: houseOutlook, senate: senateOutlook } = event.data;
      busy.current = false;
      const resultKey = keys.current.get(id) || "";
      keys.current.delete(id);
      if (id > shown.current) { shown.current = id; setResult({ key: resultKey, runs, house: houseOutlook, senate: senateOutlook }); }
      const next = queued.current;
      if (next) { queued.current = null; busy.current = true; keys.current.set(next.id, next.key); instance!.postMessage({ id: next.id, house: next.house, senate: next.senate, runs: next.runs }); }
    };
    return () => { instance?.terminate(); worker.current = null; busy.current = false; queued.current = null; };
  }, []);

  const latest = useRef({ house, senate });
  useEffect(() => { latest.current = { house, senate }; });

  useEffect(() => {
    const send = (runs: number) => {
      const request = { id: nextId.current++, key, house: latest.current.house, senate: latest.current.senate, runs };
      const instance = worker.current;
      if (!instance) {
        // No worker (very old browser): compute on the main thread, after paint.
        window.setTimeout(() => {
          const houseOutlook = simulateHouse(request.house.map((signedMargin) => ({ chamber: "house", signedMargin })), { runs });
          const senateOutlook = simulateSenate(request.senate, {}, { runs });
          if (request.id > shown.current) { shown.current = request.id; setResult({ key, runs, house: houseOutlook, senate: senateOutlook }); }
        }, 0);
        return;
      }
      if (busy.current) { queued.current = request; return; }
      busy.current = true;
      keys.current.set(request.id, key);
      instance.postMessage({ id: request.id, house: request.house, senate: request.senate, runs });
    };
    send(QUICK_RUNS);
    const timer = window.setTimeout(() => send(SIMULATIONS), 300);
    return () => window.clearTimeout(timer);
  }, [key]);

  return result;
}
