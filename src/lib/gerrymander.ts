/*
  A 5×5 toy state for the gerrymandering explainer: 25 voters, 5 districts of 5, a district goes to
  whoever holds 3 of its 5 voters. Blue has 15 voters (60%) and Red 10 (40%).
  Every way of cutting the grid into five connected districts of five can be listed (there are 4,006),
  which is the same "ensemble" idea researchers use on real states, at a size a browser does in ~15 ms.
*/

export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const DISTRICTS = 5;
export const SEATS_TO_WIN = 3;

// Side of the square box each real district outline is projected into.
export const SHAPE_BOX = 240;

export type Party = "B" | "R";

// Row by row. Blue clusters in the middle and right, Red along the west edge and the south-east corner.
export const VOTERS = ("RRRBB" + "RBBBB" + "RBBBB" + "RRBBB" + "RBBRR").split("") as Party[];

// Cell → district index, row by row.
export const EXAMPLE_MAPS = {
  fair: "0000011111222223333344444",
  red: "0001100111222332233344444",
  blue: "0111100001222232443344433",
} as const;
export type ExampleKey = keyof typeof EXAMPLE_MAPS;

export const parseMap = (map: string) => map.split("").map(Number);

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;

export const NEIGHBORS: number[][] = Array.from({ length: CELLS }, (_, cell) => {
  const row = rowOf(cell);
  const col = colOf(cell);
  const out: number[] = [];
  if (row > 0) out.push(cell - SIZE);
  if (row < SIZE - 1) out.push(cell + SIZE);
  if (col > 0) out.push(cell - 1);
  if (col < SIZE - 1) out.push(cell + 1);
  return out;
});

// Every shared side between two cells, so district borders can fade in and out edge by edge.
export const EDGES: { a: number; b: number; vertical: boolean }[] = [];
for (let cell = 0; cell < CELLS; cell++) {
  if (colOf(cell) < SIZE - 1) EDGES.push({ a: cell, b: cell + 1, vertical: true });
  if (rowOf(cell) < SIZE - 1) EDGES.push({ a: cell, b: cell + SIZE, vertical: false });
}

export function isContiguous(cells: number[]) {
  if (cells.length < 2) return true;
  const inside = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const next of NEIGHBORS[cell]) if (inside.has(next) && !seen.has(next)) { seen.add(next); stack.push(next); }
  }
  return seen.size === cells.length;
}

export type DistrictResult = {
  id: number; cells: number[]; blue: number; red: number;
  complete: boolean; contiguous: boolean; winner: Party | null;
  wasted: { B: number; R: number };
};

// Results per district. A district only has a winner once it has exactly 5 connected cells.
export function tally(assign: number[]) {
  const districts: DistrictResult[] = Array.from({ length: DISTRICTS }, (_, id) => {
    const cells = assign.flatMap((district, cell) => (district === id ? [cell] : []));
    const blue = cells.filter((cell) => VOTERS[cell] === "B").length;
    const red = cells.length - blue;
    const contiguous = isContiguous(cells);
    const complete = cells.length === SIZE && contiguous;
    const winner: Party | null = complete ? (blue >= SEATS_TO_WIN ? "B" : "R") : null;
    // Wasted votes: every vote for the loser, and every winning vote beyond the 3 it needed.
    const wasted = winner === "B" ? { B: blue - SEATS_TO_WIN, R: red } : winner === "R" ? { B: blue, R: red - SEATS_TO_WIN } : { B: 0, R: 0 };
    return { id, cells, blue, red, complete, contiguous, winner, wasted };
  });
  const seats = { B: districts.filter((d) => d.winner === "B").length, R: districts.filter((d) => d.winner === "R").length };
  const wasted = { B: districts.reduce((sum, d) => sum + d.wasted.B, 0), R: districts.reduce((sum, d) => sum + d.wasted.R, 0) };
  const valid = districts.every((d) => d.complete);
  return { districts, seats, wasted, valid };
}

// Which voters are wasted: the loser's, then the winner's surplus (the last ones in reading order).
export function wastedCells(assign: number[]) {
  const out = new Set<number>();
  for (const district of tally(assign).districts) {
    if (!district.winner) continue;
    const winners = district.cells.filter((cell) => VOTERS[cell] === district.winner);
    district.cells.filter((cell) => VOTERS[cell] !== district.winner).forEach((cell) => out.add(cell));
    winners.slice(SEATS_TO_WIN).forEach((cell) => out.add(cell));
  }
  return out;
}

// Packed: the victim wins with votes to spare. Cracked: the victim loses. Victim = the party the map works against.
export function technique(district: DistrictResult, victim: Party): "packed" | "cracked" | null {
  if (!district.winner) return null;
  const votes = victim === "B" ? district.blue : district.red;
  if (district.winner === victim) return votes > SEATS_TO_WIN ? "packed" : null;
  return votes > 0 ? "cracked" : null;
}

/*
  All partitions of the grid into five connected districts of five. Always grow the district that holds
  the lowest free cell (so each partition is found once) and prune when the free cells split into a piece
  whose size is not a multiple of five. Cells are bits of a 25-bit mask.
*/
let ensembleCache: Uint8Array[] | null = null;
export function enumerateMaps() {
  if (ensembleCache) return ensembleCache;
  const regionsFrom = (start: number, free: number) => {
    let layer = new Set([1 << start]);
    for (let size = 1; size < SIZE; size++) {
      const next = new Set<number>();
      for (const mask of layer) for (let cell = 0; cell < CELLS; cell++) {
        if (!(mask >> cell & 1)) continue;
        for (const other of NEIGHBORS[cell]) if ((free >> other & 1) && !(mask >> other & 1)) next.add(mask | 1 << other);
      }
      layer = next;
    }
    return [...layer];
  };
  const piecesOk = (free: number) => {
    let seen = 0;
    for (let cell = 0; cell < CELLS; cell++) {
      if (!(free >> cell & 1) || (seen >> cell & 1)) continue;
      let size = 0;
      const stack = [cell];
      seen |= 1 << cell;
      while (stack.length) {
        const current = stack.pop()!;
        size++;
        for (const other of NEIGHBORS[current]) if ((free >> other & 1) && !(seen >> other & 1)) { seen |= 1 << other; stack.push(other); }
      }
      if (size % SIZE) return false;
    }
    return true;
  };
  const maps: Uint8Array[] = [];
  const chosen: number[] = [];
  const walk = (free: number) => {
    if (!free) {
      const map = new Uint8Array(CELLS);
      chosen.forEach((mask, district) => { for (let cell = 0; cell < CELLS; cell++) if (mask >> cell & 1) map[cell] = district; });
      maps.push(map);
      return;
    }
    let start = 0;
    while (!(free >> start & 1)) start++;
    for (const region of regionsFrom(start, free)) {
      const rest = free & ~region;
      if (!piecesOk(rest)) continue;
      chosen.push(region);
      walk(rest);
      chosen.pop();
    }
  };
  walk((1 << CELLS) - 1);
  ensembleCache = maps;
  return maps;
}

export const blueSeats = (map: ArrayLike<number>) => {
  const blue = new Array(DISTRICTS).fill(0);
  for (let cell = 0; cell < CELLS; cell++) if (VOTERS[cell] === "B") blue[map[cell]]++;
  return blue.filter((count) => count >= SEATS_TO_WIN).length;
};
