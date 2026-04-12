import {
  fetchExplainersIndexData,
  fetchPresidentsOverviewData,
  fetchPromiseIndexData,
  fetchReportsHubData,
  fetchPolicyExplorerData,
  fetchAdministrationsOverviewData,
} from "@/lib/public-site-data";
import { buildPublicBillsDataset } from "@/lib/public-bills";
import { getFutureBills } from "@/lib/shareable-cards";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://equitystack.org";

function absolute(path) {
  return `${BASE_URL}${path}`;
}

function toIsoDate(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap() {
  const [
    presidents,
    policies,
    promises,
    explainers,
    reports,
    administrations,
    futureBills,
  ] =
    await Promise.all([
      fetchPresidentsOverviewData({}),
      fetchPolicyExplorerData({ page_size: 500 }),
      fetchPromiseIndexData({ page_size: 500 }),
      fetchExplainersIndexData(),
      fetchReportsHubData(),
      fetchAdministrationsOverviewData({}),
      getFutureBills(),
    ]);
  const publicBills = buildPublicBillsDataset(futureBills);

  const staticRoutes = [
    "/",
    "/about",
    "/activity",
    "/bills",
    "/current-administration",
    "/dashboard",
    "/future-bills",
    "/narratives",
    "/policies",
    "/presidents",
    "/promises",
    "/promises/all",
    "/administrations",
    "/reports",
    "/explainers",
    "/scorecards",
    "/start",
    "/timeline",
    "/sources",
    "/compare",
    "/compare/presidents",
    "/compare/policies",
    "/methodology",
  ].map((path) => ({
    url: absolute(path),
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));

  const dynamicRoutes = [
    ...(presidents.presidents || []).map((item) => ({
      url: absolute(`/presidents/${item.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...(policies.items || []).map((item) => ({
      url: absolute(`/policies/${item.slug}`),
      lastModified: toIsoDate(item.updated_at || item.latest_source_date || item.date_enacted) || new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    })),
    ...(promises.items || []).map((item) => ({
      url: absolute(`/promises/${item.slug}`),
      lastModified: toIsoDate(item.updated_at || item.latest_action_date || item.promise_date) || new Date(),
      changeFrequency: "weekly",
      priority: 0.75,
    })),
    ...(administrations || []).map((item) => ({
      url: absolute(`/administrations/${item.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    ...(administrations || []).map((item) => ({
      url: absolute(`/promises/president/${item.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    ...(explainers.items || []).map((item) => ({
      url: absolute(`/explainers/${item.slug}`),
      lastModified: toIsoDate(item.updated_at || item.created_at) || new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    })),
    ...(reports.reports || []).map((item) => ({
      url: absolute(item.href || `/reports/${item.slug}`),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    })),
    ...publicBills.map((item) => ({
      url: absolute(item.detailHref),
      lastModified:
        toIsoDate(item.latestActionDate || item.introducedDate || item.updatedAt) || new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
    ...(futureBills || []).map((item) => ({
      url: absolute(item.detailPath),
      lastModified: toIsoDate(item.latest_tracked_update || item.created_at) || new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    })),
  ];

  return Array.from(
    new Map([...staticRoutes, ...dynamicRoutes].map((item) => [item.url, item])).values()
  );
}
