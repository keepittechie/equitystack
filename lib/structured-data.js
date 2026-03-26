function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org").replace(/\/$/, "");
}

export function toAbsoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${normalizedPath}`;
}

function cleanObject(value) {
  if (Array.isArray(value)) {
    return value.map(cleanObject).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, nestedValue]) => [key, cleanObject(nestedValue)])
        .filter(([, nestedValue]) => {
          if (nestedValue === null || nestedValue === undefined) return false;
          if (Array.isArray(nestedValue) && nestedValue.length === 0) return false;
          return nestedValue !== "";
        })
    );
  }

  return value;
}

export function serializeJsonLd(data) {
  return JSON.stringify(cleanObject(data));
}

export function buildSiteJsonLd() {
  const siteUrl = toAbsoluteUrl("/");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}#organization`,
        name: "EquityStack",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: toAbsoluteUrl("/logo.png"),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}#website`,
        name: "EquityStack",
        url: siteUrl,
        description:
          "A data-driven platform for tracking how U.S. laws, court cases, executive actions, and proposed reforms have affected Black Americans over time.",
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
      },
    ],
  };
}

export function buildExplainerJsonLd(explainer) {
  const url = toAbsoluteUrl(`/explainers/${explainer.slug}`);
  const publishedAt = explainer.created_at
    ? new Date(explainer.created_at).toISOString()
    : undefined;
  const updatedAt = explainer.updated_at
    ? new Date(explainer.updated_at).toISOString()
    : publishedAt;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: explainer.title,
    description: explainer.summary,
    articleSection: explainer.category,
    datePublished: publishedAt,
    dateModified: updatedAt,
    mainEntityOfPage: url,
    url,
    author: {
      "@type": "Organization",
      name: "EquityStack",
    },
    publisher: {
      "@type": "Organization",
      name: "EquityStack",
      logo: {
        "@type": "ImageObject",
        url: toAbsoluteUrl("/logo.png"),
      },
    },
    about: [
      "Black Americans",
      "United States policy",
      "Legal history",
    ],
  };
}

export function buildPolicyJsonLd(policy, policyId, totalScore) {
  const url = toAbsoluteUrl(`/policies/${policyId}`);
  const typeMap = {
    "Court Case": "LegalCase",
    Legislation: "Legislation",
    Law: "Legislation",
    "Executive Action": "GovernmentService",
  };

  return {
    "@context": "https://schema.org",
    "@type": typeMap[policy.policy_type] || "CreativeWork",
    name: policy.title,
    description: policy.summary || policy.outcome_summary,
    url,
    dateCreated: policy.date_enacted || undefined,
    datePublished: policy.date_enacted || undefined,
    temporalCoverage: policy.year_enacted ? String(policy.year_enacted) : undefined,
    creator: policy.president
      ? {
          "@type": "Person",
          name: policy.president,
        }
      : undefined,
    about: [
      "Black Americans",
      policy.policy_type,
      policy.era,
      ...(policy.categories || []).map((category) => category.name),
    ],
    keywords: [
      policy.impact_direction,
      policy.status,
      policy.direct_black_impact ? "Direct Black Impact" : "Indirect Black Impact",
      ...(policy.categories || []).map((category) => category.name),
    ],
    isPartOf: {
      "@type": "WebSite",
      name: "EquityStack",
      url: toAbsoluteUrl("/"),
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Impact Direction",
        value: policy.impact_direction,
      },
      {
        "@type": "PropertyValue",
        name: "Policy Status",
        value: policy.status,
      },
      {
        "@type": "PropertyValue",
        name: "Impact Score",
        value: totalScore,
      },
      {
        "@type": "PropertyValue",
        name: "Evidence Strength",
        value: policy.evidence_summary?.evidence_strength,
      },
    ],
  };
}

export function buildPromiseJsonLd(promise) {
  const url = toAbsoluteUrl(`/promises/${promise.slug}`);
  const publishedAt = promise.created_at
    ? new Date(promise.created_at).toISOString()
    : undefined;
  const updatedAt = promise.updated_at
    ? new Date(promise.updated_at).toISOString()
    : publishedAt;

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: promise.title,
    description: promise.summary || promise.promise_text,
    url,
    datePublished: publishedAt,
    dateModified: updatedAt,
    temporalCoverage: promise.promise_date || undefined,
    creator: promise.president
      ? {
          "@type": "Person",
          name: promise.president,
        }
      : undefined,
    about: [
      "Black Americans",
      "Campaign promises",
      "Public promises",
      promise.topic,
      promise.impacted_group,
    ],
    keywords: [
      "Promise Tracker",
      promise.status,
      promise.promise_type,
      promise.campaign_or_official,
      promise.topic,
    ],
    isPartOf: {
      "@type": "WebSite",
      name: "EquityStack",
      url: toAbsoluteUrl("/"),
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Promise Status",
        value: promise.status,
      },
      {
        "@type": "PropertyValue",
        name: "Promise Type",
        value: promise.promise_type,
      },
      {
        "@type": "PropertyValue",
        name: "Action Count",
        value: promise.actions?.length || 0,
      },
      {
        "@type": "PropertyValue",
        name: "Outcome Count",
        value: promise.outcomes?.length || 0,
      },
    ],
  };
}
