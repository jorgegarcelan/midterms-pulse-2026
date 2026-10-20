import { NextResponse, type NextRequest } from "next/server";
import { getModel } from "@/lib/model-server";
import { raceReadings } from "@/lib/readings";

/*
  GET /api/readings?race=house:PA-07    one race: polling average, Polymarket (Senate), MP-26, Census-26.
*/
const CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };

export async function GET(request: NextRequest) {
  const model = await getModel();
  const wanted = request.nextUrl.searchParams.get("race");
  if (!wanted) return NextResponse.json({ error: "Pass ?race=chamber:code" }, { status: 400 });
  const [chamber = "", code = ""] = wanted.split(":");
  const key = `${chamber.toLowerCase()}:${code.toUpperCase()}`;
  const race = model.races.find((item) => `${item.chamber}:${item.code}` === key);
  if (!race) return NextResponse.json({ error: "Unknown race" }, { status: 404 });
  const readings = (await raceReadings([race], model)).get(key);
  return NextResponse.json(readings, { headers: CACHE });
}
