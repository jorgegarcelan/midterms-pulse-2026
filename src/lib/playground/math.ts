// Small numeric helpers for the playground charts: scales, ticks, correlation, colours.

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + (value - d0) / span * (r1 - r0);
}

// "Nice" tick values, d3-style.
export function niceTicks(min: number, max: number, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min];
  const raw = (max - min) / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  const step = (error >= 7.5 ? 10 : error >= 3.5 ? 5 : error >= 1.5 ? 2 : 1) * power;
  const ticks: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) ticks.push(Math.round(value / step) * step);
  return ticks;
}

export function extent(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) { if (value < min) min = value; if (value > max) max = value; }
  return [min, max];
}

// Pearson r and the least-squares line y = a + b·x.
export function regression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i += 1) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n, my = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i += 1) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  if (!sxx || !syy) return null;
  const slope = sxy / sxx;
  return { r: sxy / Math.sqrt(sxx * syy), slope, intercept: my - slope * mx, n };
}

// Diverging party colour for a D − R margin in points (positive = Democratic).
const NEUTRAL = [58, 61, 74];
const BLUE = [91, 134, 255];
const RED = [255, 90, 110];
export function marginRgb(margin: number, saturateAt = 20): [number, number, number] {
  const t = clamp(Math.abs(margin) / saturateAt, 0, 1);
  const strength = .32 + .68 * Math.sqrt(t);
  const target = margin >= 0 ? BLUE : RED;
  return [0, 1, 2].map((index) => Math.round(lerp(NEUTRAL[index], target[index], strength))) as [number, number, number];
}
export const marginColor = (margin: number, saturateAt?: number) => `rgb(${marginRgb(margin, saturateAt).join(",")})`;

export const signedLabel = (margin: number, digits = 1) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(digits)}`;
