import {
  buildCardImageResponse,
  buildFallbackCardImageResponse,
  cardImageAlt,
  cardImageContentType,
  cardImageSize,
} from "@/lib/card-og";
import { getPolicyCard } from "@/lib/shareable-cards";

export const alt = cardImageAlt;
export const size = cardImageSize;
export const contentType = cardImageContentType;
export const revalidate = 3600;

export default async function Image({ params }) {
  const { slug } = await params;

  try {
    const card = await getPolicyCard(slug);
    if (!card) {
      return buildFallbackCardImageResponse({
        title: "Policy Card",
        category: "Policy",
      });
    }

    return buildCardImageResponse(card);
  } catch {
    return buildFallbackCardImageResponse({
      title: "Policy Card",
      category: "Policy",
    });
  }
}
