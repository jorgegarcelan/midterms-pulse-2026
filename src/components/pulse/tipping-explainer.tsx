import Link from "next/link";
import { normalCdf, RACE_COMMON_SD, RACE_SD } from "@/lib/mp26";

type TippingExplainerProps = {
  margins: number[]; // House margins (D positive), national swing already applied
  code: string;
  demMajority: number | null; // published House odds; null when a swing scenario is active
};

const W = 380;
const MAJORITY = 218;
const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;
const frequency = (probability: number) => probability >= .1 ? `${Math.round(probability * 100)}% of the time` : `about 1 time in ${Math.round(1 / Math.max(probability, 1e-6)).toLocaleString("en-US")}`;

/*
  Why the tipping-point seat is ~78% but the chamber is ~99%. The chart answers "how many seats does
  the leading party keep if the forecast misses toward the other side by X points everywhere?".
  The line steps down one district at a time and crosses the 218 line exactly when the tipping
  seat flips; the bell underneath is how often a nationwide miss of that size happens.
*/
export function TippingExplainer({ margins, code, demMajority }: TippingExplainerProps) {
  const sorted = [...margins].sort((a, b) => b - a);
  const tip = sorted[MAJORITY - 1];
  const leader = tip >= 0 ? "D" : "R";
  const sign = leader === "D" ? 1 : -1;
  const party = leader === "D" ? "Democrats" : "Republicans";
  const rivals = leader === "D" ? "Republicans" : "Democrats";
  const partyAdj = leader === "D" ? "Democratic" : "Republican";
  const need = Math.abs(tip);
  // Leads of the leading party, smallest first: each one is a step down as the miss grows.
  const leads = margins.map((margin) => margin * sign).filter((value) => value > 0).sort((a, b) => a - b);
  const seats = leads.length;
  const spare = seats - MAJORITY;
  const mustFlip = seats - MAJORITY + 1;
  const smallest = leads[0] ?? 0;
  const seatFlip = 1 - normalCdf(need / RACE_SD);
  const mapFlip = 1 - normalCdf(need / RACE_COMMON_SD);

  // Chart geometry: x = size of the miss toward the trailing party; top = seats kept; bottom = how likely.
  const maxMiss = Math.min(20, Math.max(12, Math.ceil(need + 3)));
  const x = (miss: number) => 30 + miss / maxMiss * (W - 38);
  const seatsAt = (miss: number) => leads.filter((value) => value > miss).length;
  const low = Math.min(seatsAt(maxMiss), MAJORITY - 4);
  const high = Math.max(seats, MAJORITY + 4);
  const y = (count: number) => 16 + (high - count) / (high - low) * 90;
  const steps = (from: number, to: number) => {
    let path = `M${x(from).toFixed(1)} ${y(seatsAt(from)).toFixed(1)}`;
    for (const value of leads) {
      if (value <= from || value > to) continue;
      path += `H${x(value).toFixed(1)}V${y(seatsAt(value)).toFixed(1)}`;
    }
    return `${path}H${x(to).toFixed(1)}`;
  };
  const bellY = (miss: number) => 172 - Math.exp(-(miss * miss) / (2 * RACE_COMMON_SD ** 2)) * 34;
  const curve = Array.from({ length: 61 }, (_, index) => index / 60 * maxMiss);
  const bell = curve.map((miss, index) => `${index ? "L" : "M"}${x(miss).toFixed(1)} ${bellY(miss).toFixed(1)}`).join("");
  const tail = `M${x(need).toFixed(1)} 172L${x(need).toFixed(1)} ${bellY(need).toFixed(1)}${curve.filter((miss) => miss > need).map((miss) => `L${x(miss).toFixed(1)} ${bellY(miss).toFixed(1)}`).join("")}L${x(maxMiss).toFixed(1)} 172Z`;
  const ticks = [0, Math.round(maxMiss / 3), Math.round(maxMiss * 2 / 3), maxMiss];
  const flipLabelLeft = x(need) > W * .62;

  return (
    <div className={`tip-why tip-why-${leader.toLowerCase()}`}>
      <p className="tip-why-title">Why {code} is the seat that decides the House</p>

      <ol className="tip-why-steps">
        <li><b>{code} is the 218th most {partyAdj} district</b> of 435, at {lean(tip)}. Win it plus every district more {partyAdj} than it, and you have exactly the 218 seats a majority needs.</li>
        <li><b>{party} lead in {seats} districts</b>, {spare} more than they need. To lose the House they must lose <b>{mustFlip}</b> of them.</li>
        <li>The {mustFlip} easiest for {rivals} are the narrowest leads, from {lean(smallest * sign)} up to {code} at {lean(tip)}. Taking all of them needs the forecast to miss by <b>{need.toFixed(1)} points toward {rivals}, everywhere at once</b>.</li>
      </ol>

      <svg viewBox={`0 0 ${W} 198`} className="tip-why-chart" role="img" aria-label={`${party} keep ${seats} seats with no miss and fall below 218 when the forecast misses by ${need.toFixed(1)} points toward ${rivals}; a nationwide miss that large happens ${frequency(mapFlip)}`}>
        <text x="30" y="6" className="chart-cap">{party.toUpperCase()}&apos; SEATS</text>
        <line x1={x(0)} x2={x(maxMiss)} y1={y(MAJORITY - .5)} y2={y(MAJORITY - .5)} className="majority-line" />
        <text x={x(maxMiss)} y={y(MAJORITY - .5) - 4} textAnchor="end" className="majority-label">218 = majority</text>
        <rect x={x(0)} y={y(seats) - 2} width={x(need) - x(0)} height={y(MAJORITY - .5) - y(seats) + 2} className="cushion" />
        <path d={steps(0, need)} className="seat-line lead" />
        <path d={steps(need, maxMiss)} className="seat-line lost" />
        <text x={x(0) + 4} y={y(seats) + 13} className="seat-label">{seats} seats today</text>
        <text x={x(smallest) - 6} y={y((seats + MAJORITY) / 2) + 3} textAnchor="end" className="cushion-label">{mustFlip} narrowest leads →</text>
        <circle cx={x(need)} cy={y(MAJORITY - .5)} r="4" className="flip-dot" />
        <text x={x(need) + (flipLabelLeft ? -8 : 8)} y={y(MAJORITY - .5) + 16} textAnchor={flipLabelLeft ? "end" : "start"} className="flip-label">{code} flips → {MAJORITY - 1}</text>
        {[high, MAJORITY, low].filter((count, index, list) => list.indexOf(count) === index && count !== MAJORITY).map((count) => <text key={count} x="24" y={y(count) + 3} textAnchor="end" className="axis-tick">{count}</text>)}

        <text x="30" y="132" className="chart-cap">HOW OFTEN THE WHOLE MAP MISSES THIS MUCH</text>
        <path d={`${bell}L${x(maxMiss)} 172L${x(0)} 172Z`} className="bell-fill" />
        <path d={tail} className="bell-tail" />
        <path d={bell} className="bell-line" />
        <text x={x(.2)} y="168" className="bell-note">small: common</text>
        <line x1={x(need)} x2={x(need)} y1={y(MAJORITY - .5)} y2="172" className="flip-rule" />
        <text x={x(need) + (flipLabelLeft ? -6 : 6)} y="156" textAnchor={flipLabelLeft ? "end" : "start"} className="tail-label">{frequency(mapFlip)}</text>
        <line x1={x(0)} x2={x(maxMiss)} y1="172" y2="172" className="axis" />
        {ticks.map((tick) => <text key={tick} x={x(tick)} y="185" textAnchor={tick === 0 ? "start" : tick === maxMiss ? "end" : "middle"} className="axis-tick">{tick ? `${leader === "D" ? "R" : "D"}+${tick}` : "no miss"}</text>)}
        <text x={x(maxMiss)} y="197" textAnchor="end" className="axis-cap">forecast miss, every district at once →</text>
      </svg>

      <p className="tip-why-copy">
        One district misses by {need.toFixed(1)} points often: {code} alone flips {Math.round(seatFlip * 100)}% of the time. All {mustFlip} missing together is rare.
        {demMajority !== null && <> Counting local upsets too, {rivals} win the House in <b>{leader === "D" ? 100 - demMajority : demMajority}%</b> of 50,000 simulations.</>}
        {" "}<Link href="/glossary#tipping-point">Glossary: tipping point</Link>
      </p>
    </div>
  );
}
