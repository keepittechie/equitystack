import { NextResponse } from "next/server";
import { fetchPromiseList, PROMISE_STATUSES } from "@/lib/services/promiseService";

const ALLOWED_SORTS = new Set([
  "promise_date_desc",
  "promise_date_asc",
  "title_asc",
  "title_desc",
  "status_asc",
]);

function parsePage(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPromiseTrackerSchemaMissing(error) {
  return error?.code === "ER_NO_SUCH_TABLE" || error?.errno === 1146;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q")?.trim();
    const president = searchParams.get("president")?.trim();
    const status = searchParams.get("status")?.trim();
    const topic = searchParams.get("topic")?.trim();
    const requestedSort = searchParams.get("sort");
    const sort = requestedSort && ALLOWED_SORTS.has(requestedSort)
      ? requestedSort
      : "promise_date_desc";

    const page = parsePage(searchParams.get("page"), 1);
    const pageSize = Math.min(parsePage(searchParams.get("page_size"), 12), 100);

    const data = await fetchPromiseList({
      q,
      president,
      status,
      topic,
      sort,
      page,
      pageSize,
    });

    return NextResponse.json(data);
  } catch (error) {
    if (isPromiseTrackerSchemaMissing(error)) {
      return NextResponse.json({
        items: [],
        pagination: {
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          has_prev: false,
          has_next: false,
        },
        filters: {
          presidents: [],
          topics: [],
          statuses: PROMISE_STATUSES,
        },
      });
    }

    console.error("Error fetching promises:", error);
    return NextResponse.json(
      { error: "Failed to fetch promises" },
      { status: 500 }
    );
  }
}
