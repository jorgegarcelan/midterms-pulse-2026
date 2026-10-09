import { getModel } from "@/lib/model-server";
import { OG_SIZE, renderShareImage, shareCard } from "@/lib/share-image";

export const alt = "Midterm Pulse 2026: the House forecast map with House and Senate control odds";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image() {
  return renderShareImage((await shareCard(await getModel(), ["map"], OG_SIZE))!, OG_SIZE);
}
