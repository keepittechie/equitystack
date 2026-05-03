const PROMISE_TOPIC_ALIASES = {
  "economic opportunity": "Economy",
  economics: "Economy",
  economy: "Economy",
  "transportation security / workforce": "Workforce",
  workforce: "Workforce",
  transportation: "Infrastructure",
  infrastructure: "Infrastructure",
  "public safety": "Public Safety",
  "law enforcement": "Public Safety",
  immigration: "Immigration",
  healthcare: "Healthcare",
  housing: "Housing",
  education: "Education",
  "criminal justice": "Criminal Justice",
  "voting rights": "Voting Rights",
};

const PROMISE_TOPIC_FILTER_VALUES = Object.entries(PROMISE_TOPIC_ALIASES).reduce(
  (map, [rawLabel, normalizedLabel]) => {
    const key = normalizedLabel.toLowerCase();
    if (!map.has(key)) {
      map.set(key, new Set([normalizedLabel]));
    }

    map.get(key).add(rawLabel);
    map.get(key).add(normalizedLabel);
    return map;
  },
  new Map()
);

export function normalizePromiseTopicLabel(value) {
  const topic = String(value || "").trim();
  if (!topic) {
    return null;
  }

  const normalized = PROMISE_TOPIC_ALIASES[topic.toLowerCase()];
  if (normalized) {
    return normalized;
  }

  const lowered = topic.toLowerCase();

  if (lowered.includes("workforce")) {
    return "Workforce";
  }

  if (lowered.includes("public safety")) {
    return "Public Safety";
  }

  if (lowered.includes("transportation")) {
    return "Infrastructure";
  }

  return topic;
}

export function getPromiseTopicFilterValues(topic) {
  const normalized = normalizePromiseTopicLabel(topic);
  if (!normalized) {
    return [];
  }

  const values = PROMISE_TOPIC_FILTER_VALUES.get(normalized.toLowerCase());
  if (!values) {
    return [normalized];
  }

  return [...values];
}
