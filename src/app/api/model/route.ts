import { NextResponse } from "next/server";
import { getModel } from "@/lib/model-server";

// Cached at the edge for five minutes: the stream scenes poll it, and a TV audience should cost one run.
export const revalidate = 300;

export async function GET() {
  return NextResponse.json(await getModel());
}
