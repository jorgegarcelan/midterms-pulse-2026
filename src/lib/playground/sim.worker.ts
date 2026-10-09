import { simulateHouse } from "@/lib/chamber-sim";
import { simulateSenate, type SenateRace } from "@/lib/senate-sim";

// Runs scenario simulations off the main thread so sliders stay at 60 fps while the engine works.
export type SimRequest = { id: number; house: number[]; senate: SenateRace[]; runs: number };

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { id, house, senate, runs } = event.data;
  const houseOutlook = simulateHouse(house.map((signedMargin) => ({ chamber: "house", signedMargin })), { runs });
  const senateOutlook = simulateSenate(senate, {}, { runs });
  self.postMessage({ id, runs, house: houseOutlook, senate: senateOutlook });
};
