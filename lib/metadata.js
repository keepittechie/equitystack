import { toAbsoluteUrl } from "@/lib/structured-data";

const DEFAULT_SOCIAL_IMAGE_PATH = "/images/hero/civil-rights-march.jpg";

export function buildPageMetadata({
  title,
  description,
  path,
  imagePath = DEFAULT_SOCIAL_IMAGE_PATH,
  type = "website",
  twitterCard = imagePath ? "summary_large_image" : "summary",
  robots,
  keywords,
}) {
  const image = imagePath ? toAbsoluteUrl(imagePath) : undefined;

  return {
    title,
    description,
    keywords,
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
      locale: "en_US",
      images: image
        ? [
            {
              url: image,
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

export function hasMeaningfulSearchParams(searchParams = {}, ignoredKeys = []) {
  const ignored = new Set(ignoredKeys);

  return Object.entries(searchParams || {}).some(([key, value]) => {
    if (ignored.has(key)) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.some((item) => String(item || "").trim() !== "");
    }

    return String(value || "").trim() !== "";
  });
}

export function buildListingMetadata({
  title,
  description,
  path,
  imagePath,
  keywords,
  robots,
  searchParams,
  ignoredSearchParams = [],
}) {
  const filteredView = hasMeaningfulSearchParams(searchParams, ignoredSearchParams);

  return buildPageMetadata({
    title,
    description,
    path,
    imagePath,
    keywords,
    robots:
      robots ||
      (filteredView
        ? {
            index: false,
            follow: true,
          }
        : undefined),
  });
}
