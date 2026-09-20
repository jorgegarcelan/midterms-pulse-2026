import { NextResponse } from "next/server";

type Party = { party: string; seats_projected?: number; seats_median?: number; p_majority?: number };
type Riding = {
  name_en: string;
  province: string;
  projection: {
    winner: string;
    p_winner: number;
    mean_margin: number;
  };
};
type ForecastPayload = { meta: { run_date: string; n_polls: number }; parties: Party[]; ridings: Riding[] };

function party(payload: ForecastPayload, id: string) {
  return payload.parties.find((item) => item.party === id);
}

function closest(payload: ForecastPayload, chamber: "house" | "senate") {
  return [...payload.ridings]
    .filter((item) => item.projection && Number.isFinite(item.projection.mean_margin))
    .sort((a, b) => Math.abs(a.projection.mean_margin) - Math.abs(b.projection.mean_margin))
    .slice(0, 8)
    .map((item) => ({
      code: chamber === "house" ? item.name_en : item.province,
      state: item.name_en,
      chamber,
      leader: item.projection.winner === "us_dem" ? "D" : "R",
      margin: Math.abs(item.projection.mean_margin),
      winProbability: Math.round(item.projection.p_winner * 100),
    }));
}

export async function GET() {
  try {
    const [houseResponse, senateResponse] = await Promise.all([
      fetch("https://vote-scope.com/web_data/us-house/latest.json", { next: { revalidate: 900 } }),
      fetch("https://vote-scope.com/web_data/us-senate/latest.json", { next: { revalidate: 900 } }),
    ]);
    if (!houseResponse.ok || !senateResponse.ok) throw new Error("Forecast source unavailable");
    const [house, senate] = await Promise.all([houseResponse.json() as Promise<ForecastPayload>, senateResponse.json() as Promise<ForecastPayload>]);
    const houseDem = party(house, "us_dem");
    const houseRep = party(house, "us_rep");
    const senateDem = party(senate, "us_dem");
    const senateRep = party(senate, "us_rep");

    return NextResponse.json({
      updated: house.meta.run_date > senate.meta.run_date ? house.meta.run_date : senate.meta.run_date,
      house: {
        demMajority: Math.round((houseDem?.p_majority || 0) * 100),
        demSeats: Math.round(houseDem?.seats_projected ?? houseDem?.seats_median ?? 0),
        repSeats: Math.round(houseRep?.seats_projected ?? houseRep?.seats_median ?? 0),
        polls: house.meta.n_polls,
      },
      senate: {
        demMajority: Math.round((senateDem?.p_majority || 0) * 100),
        demSeats: Math.round(senateDem?.seats_projected ?? senateDem?.seats_median ?? 0),
        repSeats: Math.round(senateRep?.seats_projected ?? senateRep?.seats_median ?? 0),
        polls: senate.meta.n_polls,
      },
      races: [...closest(senate, "senate"), ...closest(house, "house")],
      source: "Vote-Scope",
      sourceUrl: "https://vote-scope.com/api/",
    });
  } catch {
    return NextResponse.json({ error: "Live forecast unavailable" }, { status: 502 });
  }
}
