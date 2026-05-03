import { serializeJsonLd } from "@/lib/structured-data";

export default function StructuredData({ data }) {
  const items = Array.isArray(data) ? data.filter(Boolean) : data ? [data] : [];

  if (!items.length) {
    return null;
  }

  return items.map((item, index) => (
    <script
      key={item?.["@id"] || item?.["@type"] || index}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
    />
  ));
}
