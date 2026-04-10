import {
  fetchExplainersIndexData,
  fetchPresidentsOverviewData,
  fetchPromiseIndexData,
  fetchReportsHubData,
  fetchPolicyExplorerData,
  fetchAdministrationsOverviewData,
} from "@/lib/public-site-data";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org";

function absolute(path) {
  return `${BASE_URL}${path}`;
}

export default async function sitemap() {
  const [presidents, policies, promises, explainers, reports, administrations] =
    await Promise.all([
      fetchPresidentsOverviewData({}),
      fetchPolicyExplorerData({ page_size: 120 }),
      fetchPromiseIndexData({ page_size: 120 }),
      fetchExplainersIndexData(),
      fetchReportsHubData(),
      fetchAdministrationsOverviewData({}),
    ]);

  const staticRoutes = [
    "/",
    "/dashboard",
    "/policies",
    "/presidents",
    "/promises",
    "/administrations",
    "/reports",
    "/explainers",
    "/timeline",
    "/sources",
    "/compare",
    "/compare/presidents",
    "/compare/policies",
    "/methodology",
  ].map((path) => ({
    url: absolute(path),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const dynamicRoutes = [
    ...(presidents.presidents || []).map((item) => ({
      url: absolute(`/presidents/${item.slug}`),
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...(policies.items || []).map((item) => ({
      url: absolute(`/policies/${item.slug}`),
      changeFrequency: "monthly",
      priority: 0.75,
    })),
    ...(promises.items || []).map((item) => ({
      url: absolute(`/promises/${item.slug}`),
      changeFrequency: "weekly",
      priority: 0.75,
    })),
    ...(administrations || []).map((item) => ({
      url: absolute(`/administrations/${item.slug}`),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    ...(explainers.items || []).map((item) => ({
      url: absolute(`/explainers/${item.slug}`),
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    ...(reports.reports || []).map((item) => ({
      url: absolute(item.href || `/reports/${item.slug}`),
      changeFrequency: "weekly",
      priority: 0.8,
    })),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
