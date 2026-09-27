import { NextResponse } from "next/server";
import { getModel } from "@/lib/model-server";

export async function GET() {
  return NextResponse.json(await getModel());
}
