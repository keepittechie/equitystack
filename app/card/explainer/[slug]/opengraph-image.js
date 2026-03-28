import {
  buildCardImageResponse,
  buildFallbackCardImageResponse,
  cardImageAlt,
  cardImageContentType,
  cardImageSize,
} from "@/lib/card-og";
import { getExplainerCard } from "@/lib/shareable-cards";

export const alt = cardImageAlt;
export const size = cardImageSize;
export const contentType = cardImageContentType;
export const revalidate = 3600;

export default async function Image({ params }) {
  const { slug } = await params;

  try {
    const card = await getExplainerCard(slug);
    if (!card) {
      return buildFallbackCardImageResponse({
        title: "Explainer Card",
        category: "Explainer",
      });
    }

    return buildCardImageResponse(card);
  } catch {
    return buildFallbackCardImageResponse({
      title: "Explainer Card",
      category: "Explainer",
    });
  }
}
