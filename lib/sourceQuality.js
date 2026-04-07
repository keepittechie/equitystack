const HIGH_AUTHORITY_DOMAINS = new Set([
  "archives.gov",
  "cdc.gov",
  "census.gov",
  "congress.gov",
  "crsreports.congress.gov",
  "doi.gov",
  "doj.gov",
  "ed.gov",
  "epa.gov",
  "federalregister.gov",
  "gao.gov",
  "govinfo.gov",
  "grants.gov",
  "hud.gov",
  "justice.gov",
  "loc.gov",
  "nih.gov",
  "nsf.gov",
  "regulations.gov",
  "supremecourt.gov",
  "transportation.gov",
  "uscourts.gov",
  "usda.gov",
  "va.gov",
  "whitehouse.gov",
]);

const INSTITUTIONAL_DOMAINS = new Set([
  "presidency.ucsb.edu",
  "supreme.justia.com",
]);

const SECONDARY_DOMAINS = new Set([
  "apnews.com",
  "bbc.com",
  "nytimes.com",
  "politifact.com",
  "propublica.org",
  "reuters.com",
  "washingtonpost.com",
]);

const QUALITY_SCORES = {
  high_authority: 1,
  institutional: 0.8,
  secondary: 0.55,
  low_unverified: 0.25,
};

const QUALITY_ORDER = ["high_authority", "institutional", "secondary", "low_unverified"];

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export function normalizeSourceDomain(value) {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    return hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function domainMatches(domain, allowedDomains) {
  if (!domain) {
    return false;
  }
  for (const allowed of allowedDomains) {
    if (domain === allowed || domain.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

function looksGovernmental(source = {}) {
  const sourceType = normalizeString(source.source_type).toLowerCase();
  const publisher = normalizeString(source.publisher).toLowerCase();
  return (
    sourceType === "government" ||
    publisher.includes("department of") ||
    publisher.includes("u.s.") ||
    publisher.includes("united states") ||
    publisher.includes("congress") ||
    publisher.includes("white house")
  );
}

function looksInstitutional(source = {}, domain = null) {
  const sourceType = normalizeString(source.source_type).toLowerCase();
  const publisher = normalizeString(source.publisher).toLowerCase();
  return (
    sourceType === "archive" ||
    sourceType === "academic" ||
    sourceType === "research" ||
    Boolean(domain?.endsWith(".edu")) ||
    publisher.includes("university") ||
    publisher.includes("college") ||
    publisher.includes("institute") ||
    publisher.includes("archive") ||
    publisher.includes("library")
  );
}

function looksSecondary(source = {}, domain = null) {
  const sourceType = normalizeString(source.source_type).toLowerCase();
  return (
    sourceType === "news" ||
    sourceType === "journalism" ||
    sourceType === "analysis" ||
    domainMatches(domain, SECONDARY_DOMAINS)
  );
}

export function classifySourceQuality(source = {}) {
  const domain = normalizeSourceDomain(source.source_url || source.url);

  if (domainMatches(domain, HIGH_AUTHORITY_DOMAINS) || looksGovernmental(source)) {
    return {
      source_quality_label: "high_authority",
      source_quality_score: QUALITY_SCORES.high_authority,
      domain,
      rationale: "official government/legal source",
    };
  }

  if (domainMatches(domain, INSTITUTIONAL_DOMAINS) || looksInstitutional(source, domain)) {
    return {
      source_quality_label: "institutional",
      source_quality_score: QUALITY_SCORES.institutional,
      domain,
      rationale: "institutional, archive, academic, or official organization source",
    };
  }

  if (looksSecondary(source, domain)) {
    return {
      source_quality_label: "secondary",
      source_quality_score: QUALITY_SCORES.secondary,
      domain,
      rationale: "secondary reporting or analysis source",
    };
  }

  return {
    source_quality_label: "low_unverified",
    source_quality_score: QUALITY_SCORES.low_unverified,
    domain,
    rationale: "unverified or uncategorized source authority",
  };
}

function emptyTierCounts() {
  return {
    high_authority: 0,
    institutional: 0,
    secondary: 0,
    low_unverified: 0,
  };
}

export function summarizeSourceQuality(sources = []) {
  const tierCounts = emptyTierCounts();
  let bestLabel = null;
  let bestScore = 0;

  for (const source of Array.isArray(sources) ? sources : []) {
    const classified = classifySourceQuality(source);
    tierCounts[classified.source_quality_label] += 1;
    if (classified.source_quality_score > bestScore) {
      bestLabel = classified.source_quality_label;
      bestScore = classified.source_quality_score;
    }
  }

  return {
    source_count: Array.isArray(sources) ? sources.length : 0,
    source_quality_label: bestLabel,
    source_quality_score: bestScore,
    high_authority_source_count: tierCounts.high_authority,
    institutional_source_count: tierCounts.institutional,
    secondary_source_count: tierCounts.secondary,
    low_unverified_source_count: tierCounts.low_unverified,
    tier_counts: tierCounts,
  };
}

export function summarizeSourceQualityDistribution(summaries = []) {
  const tierCounts = emptyTierCounts();
  let outcomesWithHighAuthoritySources = 0;
  let outcomesWithAnySources = 0;

  for (const summary of Array.isArray(summaries) ? summaries : []) {
    const counts = summary?.tier_counts || {};
    for (const label of QUALITY_ORDER) {
      tierCounts[label] += Number(counts[label] || 0);
    }
    if (Number(summary?.source_count || 0) > 0) {
      outcomesWithAnySources += 1;
    }
    if (Number(summary?.high_authority_source_count || 0) > 0) {
      outcomesWithHighAuthoritySources += 1;
    }
  }

  return {
    tier_counts: tierCounts,
    outcomes_with_any_sources: outcomesWithAnySources,
    outcomes_with_high_authority_sources: outcomesWithHighAuthoritySources,
    pct_outcomes_with_high_authority_sources: outcomesWithAnySources
      ? Number((outcomesWithHighAuthoritySources / outcomesWithAnySources).toFixed(4))
      : 0,
  };
}
