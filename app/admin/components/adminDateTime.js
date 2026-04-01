const ADMIN_TIME_ZONE = "America/Los_Angeles";

const ADMIN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ADMIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function toPartMap(parts) {
  return parts.reduce((bucket, part) => {
    if (part.type !== "literal") {
      bucket[part.type] = part.value;
    }
    return bucket;
  }, {});
}

export function formatAdminDateTime(value, fallback = "—") {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return fallback;
    }

    const parts = toPartMap(ADMIN_DATE_TIME_FORMATTER.formatToParts(parsed));
    if (!parts.month || !parts.day || !parts.year || !parts.hour || !parts.minute || !parts.dayPeriod) {
      return fallback;
    }

    return `${parts.month}-${parts.day}-${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod.toUpperCase()}`;
  } catch {
    return fallback;
  }
}

export { ADMIN_TIME_ZONE };
