export type SeatPoint = { x: number; y: number; angle: number; ring: number };

// Parliament chart on a unit semicircle: concentric rows, seats per row proportional to radius,
// ordered left → right by angle so seat k can be assigned to the k-th most Democratic district.
export function parliamentLayout(total: number, rows: number, inner: number) {
  const radii = Array.from({ length: rows }, (_, index) => inner + (1 - inner) * (index / (rows - 1)));
  const sum = radii.reduce((acc, radius) => acc + radius, 0);
  const counts = radii.map((radius) => Math.round(total * radius / sum));
  counts[rows - 1] += total - counts.reduce((acc, count) => acc + count, 0);
  const seats: SeatPoint[] = [];
  radii.forEach((radius, ring) => {
    const count = counts[ring];
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI * index / (count - 1);
      seats.push({ x: -Math.cos(angle) * radius, y: -Math.sin(angle) * radius, angle, ring });
    }
  });
  const dot = Math.min((1 - inner) / (rows - 1), Math.PI * radii[rows - 1] / (counts[rows - 1] - 1)) * 0.4;
  return { seats: seats.sort((a, b) => a.angle - b.angle || b.ring - a.ring), dot };
}
