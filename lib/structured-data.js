function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org").replace(/\/$/, "");
}

function getSiteId(suffix = "") {
  return `${toAbsoluteUrl("/")}${suffix}`;
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

function toThingEntries(items = []) {
  return items
    .filter(Boolean)
    .map((item) =>
      typeof item === "string"
        ? {
            "@type": "Thing",
            name: item,
          }
        : item
    );
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
        description:
          "EquityStack is a public-interest research platform that tracks U.S. presidents, campaign promises, legislation, civil rights policy, and historical policy impact on Black Americans.",
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
        potentialAction: {
          "@type": "SearchAction",
          target: `${toAbsoluteUrl("/search")}?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

export function buildWebPageJsonLd({
  type = "WebPage",
  title,
  description,
  path,
  imagePath,
  about = [],
  keywords = [],
  mainEntity,
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    mainEntityOfPage: url,
    image: imagePath ? [toAbsoluteUrl(imagePath)] : undefined,
    about: toThingEntries(about),
    keywords,
    mainEntity,
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    inLanguage: "en-US",
  };
}

export function buildAboutPageJsonLd(options) {
  return buildWebPageJsonLd({
    ...options,
    type: "AboutPage",
  });
}

export function buildBreadcrumbJsonLd(items = [], currentPath = "/") {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: toAbsoluteUrl(item.href || (index === items.length - 1 ? currentPath : "/")),
    })),
  };
}

export function buildCollectionPageJsonLd({
  title,
  description,
  path,
  about = [],
  keywords = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#webpage`,
    name: title,
    description,
    url,
    inLanguage: "en-US",
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    about: toThingEntries(about),
    keywords,
    publisher: {
      "@id": getSiteId("#organization"),
    },
  };
}

export function buildDatasetJsonLd({
  title,
  description,
  path,
  keywords = [],
  about = [],
  variableMeasured = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: title,
    description,
    url,
    keywords,
    about: toThingEntries(about),
    variableMeasured: variableMeasured.map((name) => ({
      "@type": "PropertyValue",
      name,
    })),
    creator: {
      "@id": getSiteId("#organization"),
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    inLanguage: "en-US",
  };
}

export function buildItemListJsonLd({
  title,
  description,
  path,
  items = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${url}#itemlist`,
    name: title,
    description,
    url,
    numberOfItems: items.length,
    itemListOrder: "https://schema.org/ItemListUnordered",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: toAbsoluteUrl(item.href),
      name: item.name,
    })),
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    inLanguage: "en-US",
  };
}

export function buildProfilePageJsonLd({
  title,
  description,
  path,
  imagePath,
  entityName,
  entityDescription,
  about = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#webpage`,
    url,
    name: title,
    description,
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    about: toThingEntries(about),
    mainEntity: {
      "@type": "Person",
      name: entityName,
      description: entityDescription,
      image: imagePath ? toAbsoluteUrl(imagePath) : undefined,
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    inLanguage: "en-US",
  };
}

export function buildReportJsonLd({
  title,
  description,
  path,
  imagePath,
  section,
  datePublished,
  dateModified,
  about = [],
  keywords = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "Report",
    "@id": `${url}#report`,
    headline: title,
    name: title,
    abstract: description,
    description,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified,
    image: imagePath ? [toAbsoluteUrl(imagePath)] : undefined,
    about: toThingEntries(about),
    keywords,
    genre: section,
    author: {
      "@id": getSiteId("#organization"),
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    inLanguage: "en-US",
  };
}

export function buildArticleJsonLd({
  title,
  description,
  path,
  imagePath,
  section,
  datePublished,
  dateModified,
  about = [],
  keywords = [],
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: title,
    description,
    articleSection: section,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified,
    image: imagePath ? [toAbsoluteUrl(imagePath)] : undefined,
    about: toThingEntries(about),
    keywords,
    author: {
      "@id": getSiteId("#organization"),
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    inLanguage: "en-US",
  };
}

export function buildThematicLandingJsonLd({
  title,
  description,
  path,
  imagePath,
  about = [],
  keywords = [],
  breadcrumbItems,
  section = "Research guide",
}) {
  return [
    buildBreadcrumbJsonLd(
      breadcrumbItems || [{ href: "/", label: "Home" }, { label: title }],
      path
    ),
    buildCollectionPageJsonLd({
      title,
      description,
      path,
      about,
      keywords,
    }),
    buildArticleJsonLd({
      title,
      description,
      path,
      imagePath,
      section,
      about,
      keywords,
    }),
  ];
}

export function buildLegislationJsonLd({
  title,
  description,
  path,
  identifier,
  imagePath,
  dateCreated,
  dateModified,
  about = [],
  keywords = [],
  legislationType,
}) {
  const url = toAbsoluteUrl(path);

  return {
    "@context": "https://schema.org",
    "@type": "Legislation",
    "@id": `${url}#legislation`,
    name: title,
    description,
    url,
    identifier,
    legislationType,
    dateCreated,
    dateModified,
    image: imagePath ? [toAbsoluteUrl(imagePath)] : undefined,
    about: toThingEntries(about),
    keywords,
    creator: {
      "@id": getSiteId("#organization"),
    },
    publisher: {
      "@id": getSiteId("#organization"),
    },
    isPartOf: {
      "@id": getSiteId("#website"),
    },
    inLanguage: "en-US",
  };
}

export function buildExplainerJsonLd(explainer) {
  const publishedAt = explainer.created_at
    ? new Date(explainer.created_at).toISOString()
    : undefined;
  const updatedAt = explainer.updated_at
    ? new Date(explainer.updated_at).toISOString()
    : publishedAt;

  return buildArticleJsonLd({
    title: explainer.title,
    description: explainer.summary,
    path: `/explainers/${explainer.slug}`,
    section: explainer.category,
    datePublished: publishedAt,
    dateModified: updatedAt,
    about: [
      "Black Americans",
      "United States policy",
      "Legal history",
    ],
    keywords: [
      explainer.category,
      "Black history explainer",
      "civil rights policy explainer",
    ].filter(Boolean),
  });
}

export function buildPolicyJsonLd(policy, policyId, totalScore) {
  const path = `/policies/${policyId}`;
  const url = toAbsoluteUrl(path);
  const typeMap = {
    "Court Case": "LegalCase",
    Legislation: "Legislation",
    Law: "Legislation",
    "Executive Action": "CreativeWork",
  };
  const recordType = typeMap[policy.policy_type] || "CreativeWork";
  const about = [
    "Black Americans",
    policy.policy_type,
    policy.era,
    ...(policy.categories || []).map((category) => category.name),
  ];
  const keywords = [
    policy.impact_direction,
    policy.status,
    policy.direct_black_impact ? "Direct Black Impact" : "Indirect Black Impact",
    ...(policy.categories || []).map((category) => category.name),
  ];

  return buildWebPageJsonLd({
    title: policy.title,
    description: policy.summary || policy.outcome_summary,
    path,
    about,
    keywords,
    mainEntity: {
      "@type": recordType,
      "@id": `${url}#record`,
      name: policy.title,
      description: policy.summary || policy.outcome_summary,
      url,
      dateCreated: policy.date_enacted || undefined,
      datePublished: policy.date_enacted || undefined,
      temporalCoverage: policy.year_enacted ? String(policy.year_enacted) : undefined,
      legislationType: recordType === "Legislation" ? policy.policy_type : undefined,
      creator: policy.president
        ? {
            "@type": "Person",
            name: policy.president,
          }
        : undefined,
      about: toThingEntries(about),
      keywords,
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
    },
  });
}

export function buildPromiseJsonLd(promise) {
  const path = `/promises/${promise.slug}`;
  const url = toAbsoluteUrl(path);
  const publishedAt = promise.created_at
    ? new Date(promise.created_at).toISOString()
    : undefined;
  const updatedAt = promise.updated_at
    ? new Date(promise.updated_at).toISOString()
    : publishedAt;
  const about = [
    "Black Americans",
    "Campaign promises",
    "Public promises",
    promise.topic,
    promise.impacted_group,
  ];
  const keywords = [
    "Promise Tracker",
    promise.status,
    promise.promise_type,
    promise.campaign_or_official,
    promise.topic,
  ];

  return buildWebPageJsonLd({
    title: promise.title,
    description: promise.summary || promise.promise_text,
    path,
    about,
    keywords,
    mainEntity: {
      "@type": "CreativeWork",
      "@id": `${url}#record`,
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
      about: toThingEntries(about),
      keywords,
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
    },
  });
}
