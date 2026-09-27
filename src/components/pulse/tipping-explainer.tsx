import Link from "next/link";
import { normalCdf, RACE_COMMON_SD, RACE_SD } from "@/lib/mp26";

type TippingExplainerProps = {
  margins: number[]; // House margins (D positive), national swing already applied
  code: string;
  demMajority: number | null; // published House odds; null when a swing scenario is active
};

const W = 380;
const MAX_MISS = 12;
const lean = (margin: number) => `${margin >= 0 ? "D" : "R"}+${Math.abs(margin).toFixed(1)}`;
const frequency = (probability: number) => probability >= .1 ? `${Math.round(probability * 100)}% of the time` : `about 1 time in ${Math.round(1 / Math.max(probability, 1e-6)).toLocaleString("en-US")}`;

/*
  Why the decisive seat is only ~78% but the chamber is ~99%: the majority's cushion is every seat
  between the tipping point and 50–50, and they only fall together if the whole country misses the
  same way. The bell is the shared national error on race margins (±RACE_COMMON_SD).
*/
export function TippingExplainer({ margins, code, demMajority }: TippingExplainerProps) {
  const sorted = [...margins].sort((a, b) => b - a);
  const tip = sorted[217];
  const leader = tip >= 0 ? "D" : "R";
  const trailer = leader === "D" ? "Republicans" : "Democrats";
  const need = Math.abs(tip);
  // Seats between the tipping point and a coin flip, ordered from the tipping seat toward 50–50.
  const cushion = leader === "D" ? sorted.slice(217).filter((margin) => margin >= 0) : sorted.slice(0, 218).filter((margin) => margin < 0).reverse();
  const shown = cushion.slice(0, 44);
  const seatFlip = 1 - normalCdf(need / RACE_SD);
  const mapFlip = 1 - normalCdf(need / RACE_COMMON_SD);

  // Half bell of the national error, 0 → MAX_MISS points toward the trailing party.
  const x = (miss: number) => 8 + miss / MAX_MISS * (W - 16);
  const y = (miss: number) => 86 - Math.exp(-(miss * miss) / (2 * RACE_COMMON_SD ** 2)) * 62;
  const curve = Array.from({ length: 61 }, (_, index) => index / 60 * MAX_MISS);
  const line = curve.map((miss, index) => `${index ? "L" : "M"}${x(miss).toFixed(1)} ${y(miss).toFixed(1)}`).join("");
  const tail = curve.filter((miss) => miss >= need);
  const tailArea = need < MAX_MISS ? `M${x(need).toFixed(1)} 86L${x(need).toFixed(1)} ${y(need).toFixed(1)}${tail.map((miss) => `L${x(miss).toFixed(1)} ${y(miss).toFixed(1)}`).join("")}L${x(MAX_MISS)} 86Z` : "";
  const cell = Math.min(14, (W - 4) / Math.max(shown.length, 1) - 2);

  return (
    <div className={`tip-why tip-why-${leader.toLowerCase()}`}>
      <p className="tip-why-title">Why {leader === "D" ? "Democrats" : "Republicans"} can lose {code} and still hold the House</p>

      <div className="tip-why-block">
        <span className="tip-why-label"><b>{cushion.length}</b> seats between {code} and a coin flip</span>
        <svg viewBox={`0 0 ${W} 22`} className="tip-why-strip" role="img" aria-label={`${cushion.length} seats lean ${leader} by between ${lean(tip)} and 0`}>
          {shown.map((margin, index) => (
            <rect key={index} x={2 + index * (cell + 2)} y="3" width={cell} height="16" rx="3" className={index === 0 ? "tip" : ""} style={{ opacity: .35 + .65 * Math.min(1, Math.abs(margin) / Math.max(need, 1)) }} />
          ))}
        </svg>
        <span className="tip-why-scale"><span>{lean(tip)} · {code}</span><span>50–50</span></span>
      </div>

      <div className="tip-why-block">
        <span className="tip-why-label">Size of a nationwide polling miss toward {trailer}</span>
        <svg viewBox={`0 0 ${W} 104`} className="tip-why-bell" role="img" aria-label={`A national miss of ${need.toFixed(1)} points or more happens ${frequency(mapFlip)}`}>
          <path d={`${line}L${x(MAX_MISS)} 86L${x(0)} 86Z`} className="bell-fill" />
          {tailArea && <path d={tailArea} className="bell-tail" />}
          <path d={line} className="bell-line" />
          <line x1={x(0)} x2={x(MAX_MISS)} y1="86" y2="86" className="bell-axis" />
          {need < MAX_MISS && <>
            <line x1={x(need)} x2={x(need)} y1="14" y2="86" className="bell-mark" />
            <text x={x(need) + (need > MAX_MISS * .6 ? -6 : 6)} y="22" textAnchor={need > MAX_MISS * .6 ? "end" : "start"} className="bell-note">{leader === "D" ? "R" : "D"}+{need.toFixed(1)} everywhere flips it</text>
          </>}
          {[0, 4, 8, 12].map((tick) => <text key={tick} x={x(tick)} y="100" textAnchor={tick === 0 ? "start" : tick === MAX_MISS ? "end" : "middle"} className="bell-tick">{tick ? `${tick} pts` : "no miss"}</text>)}
        </svg>
      </div>

      <p className="tip-why-copy">
        {code} on its own flips {Math.round(seatFlip * 100)}% of the time. The House flips only if the whole map moves together, a miss the model sees <b>{frequency(mapFlip)}</b>.
        {demMajority !== null && <> Counting local upsets too, {trailer} win the House in <b>{leader === "D" ? 100 - demMajority : demMajority}%</b> of 50,000 simulations.</>}
        {" "}<Link href="/glossary#tipping-point">What is a tipping point?</Link>
      </p>
    </div>
  );
}
