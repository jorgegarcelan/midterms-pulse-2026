"use client";

import { Hemicycle } from "@/components/motion/hemicycle";

type Chamber = { demSeats: number };
type SeatLabProps = { house: Chamber; senate: Chamber; swing: number; onSwing: (value: number) => void };

// Model v0.1 conversion: one national point moves 2.15 House seats and 0.18 Senate seats.
export function SeatLab({ house, senate, swing, onSwing }: SeatLabProps) {
  const houseDem = Math.round(Math.max(0, Math.min(435, house.demSeats + swing * 2.15)));
  const senateDem = Math.round(Math.max(0, Math.min(100, senate.demSeats + swing * 0.18)));
  const label = swing === 0 ? "Current baseline" : `${swing > 0 ? "D" : "R"}+${Math.abs(swing)}`;

  return (
    <section className="panel seat-lab" id="methodology" aria-labelledby="seat-lab-title">
      <div className="seat-lab-head">
        <div>
          <p className="eyebrow">SCENARIO LAB · SEAT PROJECTION</p>
          <h2 id="seat-lab-title">Drag the national environment</h2>
          <p>Every seat is a dot. Move the national vote and watch the chambers re-sort around the majority line. This is a sensitivity test on the MP-26 v0.1 conversion, not a prediction.</p>
        </div>
        <div className="method-links"><a href="https://www.cookpolitical.com/ratings/house-race-ratings" target="_blank" rel="noreferrer">House ratings ↗</a><a href="https://vote-scope.com/en/us/senate/" target="_blank" rel="noreferrer">Senate benchmark ↗</a><a href="https://uspollingdata.com/polls/generic-ballot/" target="_blank" rel="noreferrer">Generic ballot ↗</a></div>
      </div>
      <div className="seat-lab-grid">
        <Hemicycle label="House of Representatives" total={435} dem={houseDem} majority={218} rows={11} />
        <Hemicycle label="Senate" total={100} dem={senateDem} majority={51} rows={5} inner={.42} majorityNote="VP breaks ties" />
      </div>
      <div className="swing-control">
        <output htmlFor="national-swing" className={swing > 0 ? "dem-text" : swing < 0 ? "rep-text" : ""}>{label}</output>
        <div className="swing-range" style={{ "--pct": `${(swing + 5) * 10}%` } as React.CSSProperties}>
          <input id="national-swing" aria-label="National swing" type="range" min="-5" max="5" step="0.5" value={swing} onChange={(event) => onSwing(Number(event.target.value))} />
          <span className="swing-shock go" key={swing} aria-hidden="true" />
          <div className="swing-ticks" aria-hidden="true"><span>R +5</span><span>R +2.5</span><span>0</span><span>D +2.5</span><span>D +5</span></div>
        </div>
        <button type="button" onClick={() => onSwing(0)}>Reset</button>
      </div>
    </section>
  );
}
