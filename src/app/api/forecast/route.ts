import { NextResponse } from "next/server";
import { fetchForecast } from "@/lib/forecast";

export async function GET() {
  return NextResponse.json(await fetchForecast());
}
