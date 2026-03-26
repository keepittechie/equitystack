export function buildPageMetadata({
  title,
  description,
  path,
}) {
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
      url: path || "/",
    },
    twitter: {
      title,
      description,
    },
  };
}
