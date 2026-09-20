import { stateTiles } from "@/data/states";

export const states = stateTiles
  .filter((state) => state.code !== "DC")
  .map(({ code, name }) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const stateByCode = new Map(states.map((state) => [state.code, state]));
export const stateByName = new Map(states.map((state) => [state.name, state]));

export type ElectionCycle = "2016" | "2020" | "2024" | "2026";
export type ChamberFilter = "all" | "house" | "senate";
