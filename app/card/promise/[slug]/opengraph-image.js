import {
  buildCardImageResponse,
  buildFallbackCardImageResponse,
  cardImageAlt,
  cardImageContentType,
  cardImageSize,
} from "@/lib/card-og";
import { getPromiseCard } from "@/lib/shareable-cards";

export const alt = cardImageAlt;
export const size = cardImageSize;
export const contentType = cardImageContentType;
export const revalidate = 3600;

export default async function Image({ params }) {
  const { slug } = await params;

  try {
    const card = await getPromiseCard(slug);
    if (!card) {
      return buildFallbackCardImageResponse({
        title: "Promise Card",
        category: "Promise",
      });
    }

    return buildCardImageResponse(card);
  } catch {
    return buildFallbackCardImageResponse({
      title: "Promise Card",
      category: "Promise",
    });
  }
}
