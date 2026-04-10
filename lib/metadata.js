import { toAbsoluteUrl } from "@/lib/structured-data";

export function buildPageMetadata({
  title,
  description,
  path,
  imagePath,
  type = "website",
  twitterCard = imagePath ? "summary_large_image" : "summary",
  robots,
}) {
  const image = imagePath ? toAbsoluteUrl(imagePath) : undefined;

  return {
    title,
    description,
    alternates: path
      ? {
          canonical: path,
        }
      : undefined,
    openGraph: {
      title,
      description,
      siteName: "EquityStack",
      type,
      url: path || "/",
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: twitterCard,
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots,
  };
}
