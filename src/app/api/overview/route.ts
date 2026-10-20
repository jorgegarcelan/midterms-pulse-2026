import { NextResponse } from "next/server";
import { getModel } from "@/lib/model-server";
import { overview } from "@/lib/overview";

// The general layer for every page: polls, markets and expert ratings, race by race and per chamber.
export async function GET() {
  return NextResponse.json(await overview(await getModel()), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
