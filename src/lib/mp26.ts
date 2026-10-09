// Shared MP-26 constants, so the server model and client tools cannot drift apart.

export const MODEL_VERSION = "MP-26 v0.4";

// Shared national error, in generic-ballot points. Chosen so the correlated part of a race's error
// (NATIONAL_SD × NATIONALIZATION ≈ 2.87 pts) matches the common error the benchmark publishes (common_sd 2.867).
export const NATIONAL_SD = 4.1;
export const NATIONALIZATION = 0.7; // share of national movement a race absorbs
// Total error on a race margin, fitted to the benchmark's own race odds with its expected D − R margin
// (9 Oct 2026, races between 3% and 97%): best fit ≈6 pts for the Senate and ≈8 for the House.
// 7.5 keeps one engine for both chambers; mean odds error vs the benchmark is 5.5 pts (Senate) and 1.2 (House).
export const RACE_SD = 7.5;
export const RACE_COMMON_SD = NATIONAL_SD * NATIONALIZATION;
export const RACE_LOCAL_SD = Math.sqrt(RACE_SD ** 2 - RACE_COMMON_SD ** 2);
export const SIMULATIONS = 50_000;
export const POLL_HALF_LIFE_DAYS = 30;
export const POPULATION_WEIGHT = { LV: 1, RV: .86, A: .72 } as const;
export const AGGREGATE_SAMPLE_WEIGHT = .55;

/*
  Two-party topline sanity check. The poll indexes occasionally carry single-party toplines (one side
  coded 0) or races with a strong independent; neither measures the D-vs-R margin the model needs.
*/
export function isTwoPartyTopline(dem?: number, rep?: number) {
  return Number.isFinite(dem) && Number.isFinite(rep) && dem! >= 20 && rep! >= 20 && dem! + rep! >= 70;
}

export type WeightedPoll = { endDate: string; sample: number; population: "LV" | "RV" | "A" };

// Weight of one generic-ballot poll on `anchorDate`: recency × sample size × population.
export function pollWeight(poll: WeightedPoll, anchorDate: string) {
  const age = Math.max(0, (Date.parse(`${anchorDate}T00:00:00Z`) - Date.parse(`${poll.endDate}T00:00:00Z`)) / 86_400_000);
  const recency = .5 ** (age / POLL_HALF_LIFE_DAYS);
  const sample = poll.sample > 0 ? Math.sqrt(poll.sample / 1000) : AGGREGATE_SAMPLE_WEIGHT;
  return { age, recency, sample, population: POPULATION_WEIGHT[poll.population], weight: recency * sample * POPULATION_WEIGHT[poll.population] };
}

// Abramowitz–Stegun 7.1.26 approximation of the standard normal CDF.
export function normalCdf(z: number) {
  const t = 1 / (1 + .3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (.254829592 + t * (-.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// Probability Democrats carry a race with this expected signed margin (D positive).
export const demWinProbability = (signedMargin: number) => normalCdf(signedMargin / RACE_SD);

// Acklam's rational approximation of the inverse standard normal CDF.
export function inverseNormal(p: number) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-.00778489400243029, -.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [.00778469570904146, .32246712907004, 2.445134137143, 3.75440866190742];
  const low = .02425;
  if (p < low) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - low) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - .5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
