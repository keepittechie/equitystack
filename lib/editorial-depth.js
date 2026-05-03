export function isThinText(value, minimumLength = 160) {
  const text = String(value || "").trim();
  return text.length < minimumLength;
}

export function sentenceJoin(parts = []) {
  return parts
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ");
}

export function countLabel(count, singular, plural = `${singular}s`) {
  const numeric = Number(count || 0);
  return `${numeric} ${numeric === 1 ? singular : plural}`;
}

export function oxfordJoin(items = []) {
  const values = items
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (!values.length) {
    return "";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export function takeLabels(items = [], selector, limit = 3) {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof selector === "function") {
        return selector(item);
      }
      if (typeof selector === "string") {
        return item?.[selector];
      }
      return item;
    })
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function filterParagraphs(paragraphs = []) {
  return paragraphs
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}
