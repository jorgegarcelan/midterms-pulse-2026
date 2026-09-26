// Shared MP-26 constants, so the server model and client tools cannot drift apart.

export const MODEL_VERSION = "MP-26 v0.2";

export const NATIONAL_SD = 2.75; // shared national error, in generic-ballot points
export const NATIONALIZATION = 0.7; // share of national movement a race absorbs
// Total error on a race margin. Calibrated to the benchmark: the median error implied by Vote-Scope's
// own race odds (|margin| / Φ⁻¹(p)) is ≈9.8 pts for Senate races and ≈8.8 for House races (Sep 2026).
export const RACE_SD = 10;
export const RACE_COMMON_SD = NATIONAL_SD * NATIONALIZATION;
export const RACE_LOCAL_SD = Math.sqrt(RACE_SD ** 2 - RACE_COMMON_SD ** 2);
export const SIMULATIONS = 50_000;

// Abramowitz–Stegun 7.1.26 approximation of the standard normal CDF.
export function normalCdf(z: number) {
  const t = 1 / (1 + .3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (.254829592 + t * (-.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// Probability Democrats carry a race with this expected signed margin (D positive).
export const demWinProbability = (signedMargin: number) => normalCdf(signedMargin / RACE_SD);

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(random: () => number) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
}
