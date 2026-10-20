import { NextResponse, type NextRequest } from "next/server";
import { getModel } from "@/lib/model-server";
import { chamberReadings, raceReadings } from "@/lib/readings";

/*
  GET /api/readings                     House and Senate: generic ballot, control markets, MP-26, Census-26.
  GET /api/readings?race=house:PA-07    one race: polling average, Polymarket (Senate), MP-26, Census-26.
*/
const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

export async function GET(request: NextRequest) {
  const model = await getModel();
  const wanted = request.nextUrl.searchParams.get("race");
  if (!wanted) return NextResponse.json(await chamberReadings(model), { headers: CACHE });
  const [chamber = "", code = ""] = wanted.split(":");
  const key = `${chamber.toLowerCase()}:${code.toUpperCase()}`;
  const race = model.races.find((item) => `${item.chamber}:${item.code}` === key);
  if (!race) return NextResponse.json({ error: "Unknown race" }, { status: 404 });
  const readings = (await raceReadings([race])).get(key);
  return NextResponse.json(readings, { headers: CACHE });
}
