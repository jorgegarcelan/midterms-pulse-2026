"use client";

import { useEffect, useState } from "react";
import { introRemaining } from "@/components/motion/motion-utils";

// First polls open at 6:00 a.m. Eastern (UTC−5 after DST ends) on November 3, 2026.
const POLLS_OPEN = Date.UTC(2026, 10, 3, 11, 0, 0);
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function parts(now: number) {
  const left = Math.max(0, POLLS_OPEN - now);
  const seconds = Math.floor(left / 1000);
  return [Math.floor(seconds / 86_400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
}

function Digit({ value, delay }: { value: number; delay: number }) {
  return <span className="odo-digit"><span style={{ transform: `translateY(-${value}em)`, "--d": `${delay}ms` } as React.CSSProperties}>{DIGITS.map((digit) => <b key={digit}>{digit}</b>)}</span></span>;
}

export function OdometerCountdown() {
  const [values, setValues] = useState([0, 0, 0, 0]);
  const [rolled, setRolled] = useState(false);

  useEffect(() => {
    let interval = 0;
    let settle = 0;
    const start = window.setTimeout(() => {
      setValues(parts(Date.now()));
      settle = window.setTimeout(() => setRolled(true), 1400);
      interval = window.setInterval(() => setValues(parts(Date.now())), 1000);
    }, introRemaining(250));
    return () => { window.clearTimeout(start); window.clearTimeout(settle); window.clearInterval(interval); };
  }, []);

  const labels = ["days", "hrs", "min", "sec"];
  const [days] = values;
  return (
    <div className="countdown odometer" role="timer" aria-label={`${days} days until polls open on November 3, 2026`}>
      <div className="odometer-label"><i />Until polls open · Nov 3</div>
      <div className="odometer-row" aria-hidden="true">
        {values.map((value, group) => {
          const text = String(value).padStart(2, "0");
          return <div className="odometer-group" key={labels[group]}>
            <div className="odometer-digits">{text.split("").map((digit, index) => <Digit key={index} value={Number(digit)} delay={rolled ? 0 : group * 120 + index * 60} />)}</div>
            <small>{labels[group]}</small>
          </div>;
        }).flatMap((node, index) => index === 0 ? [node] : [<span className="odometer-sep" key={`sep-${index}`}>:</span>, node])}
      </div>
    </div>
  );
}
