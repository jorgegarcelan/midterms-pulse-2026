"use client";

import { useEffect, useState } from "react";
import { blueSeats, enumerateMaps } from "@/lib/gerrymander";

export type Ensemble = { maps: Uint8Array[]; seats: number[]; counts: number[] };

// Lists every legal map once, after hydration (about 15 ms), and shares the cached result between sections.
export function useEnsemble() {
  const [ensemble, setEnsemble] = useState<Ensemble | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const maps = enumerateMaps();
      const seats = maps.map(blueSeats);
      const counts = [0, 0, 0, 0, 0, 0];
      for (const value of seats) counts[value]++;
      setEnsemble({ maps, seats, counts });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return ensemble;
}
