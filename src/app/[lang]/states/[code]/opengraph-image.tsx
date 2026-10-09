import { getModel } from "@/lib/model-server";
import { OG_SIZE, renderShareImage, shareCard } from "@/lib/share-image";

export const alt = "State forecast card from Midterm Pulse 2026";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const model = await getModel();
  return renderShareImage((await shareCard(model, ["state", code], OG_SIZE)) || (await shareCard(model, ["map"], OG_SIZE))!, OG_SIZE);
}
