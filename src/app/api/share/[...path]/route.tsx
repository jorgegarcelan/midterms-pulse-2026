import { getModel } from "@/lib/model-server";
import { DOWNLOAD_SIZE, parseShareOptions, renderShareImage, shareCard } from "@/lib/share-image";

// Downloadable share images: /api/share/map, /house, /senate, /race/{slug}, /state/{code}.
// ?swing= and ?picks=GA-D,ME-R reproduce the scenario on screen; ?download=1 saves instead of opening.
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const card = await shareCard(await getModel(), path, DOWNLOAD_SIZE, parseShareOptions(url.searchParams));
  if (!card) return new Response("No share image for this path", { status: 404 });
  return renderShareImage(card, DOWNLOAD_SIZE, {
    "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
    "Content-Disposition": `${url.searchParams.has("download") ? "attachment" : "inline"}; filename="${card.filename}"`,
  });
}
