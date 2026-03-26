import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { POLICY_IMPACT_SCORE_SQL } from "@/lib/analytics/impactAggregator";

const ALLOWED_SORTS = new Set([
  "relevance",
  "year_asc",
  "year_desc",
  "title_asc",
  "title_desc",
  "impact_score_desc",
  "impact_score_asc",
]);

function parseOptionalYear(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const q = searchParams.get("q");
    const party = searchParams.get("party");
    const era = searchParams.get("era");
    const category = searchParams.get("category");
    const impactDirection = searchParams.get("impact_direction");
    const directBlackImpact = searchParams.get("direct_black_impact");
    const bipartisan = searchParams.get("bipartisan");
    const yearFrom = parseOptionalYear(searchParams.get("year_from"));
    const yearTo = parseOptionalYear(searchParams.get("year_to"));
    const requestedSort = searchParams.get("sort");
    const defaultSort = q ? "relevance" : "year_asc";
    const sort =
      requestedSort && ALLOWED_SORTS.has(requestedSort) ? requestedSort : defaultSort;

    const page = Math.max(Number(searchParams.get("page") || 1), 1);
    const pageSize = Math.min(
      Math.max(Number(searchParams.get("page_size") || 20), 1),
      100
    );
    const offset = (page - 1) * pageSize;
    const normalizedYearFrom =
      yearFrom !== null && yearTo !== null ? Math.min(yearFrom, yearTo) : yearFrom;
    const normalizedYearTo =
      yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo;

    let fromAndWhere = `
      FROM policies p
      LEFT JOIN presidents pr ON p.president_id = pr.id
      LEFT JOIN parties pa ON p.primary_party_id = pa.id
      LEFT JOIN eras e ON p.era_id = e.id
      LEFT JOIN policy_scores ps ON p.id = ps.policy_id
      LEFT JOIN policy_policy_categories ppc ON p.id = ppc.policy_id
      LEFT JOIN policy_categories pc ON ppc.category_id = pc.id
      LEFT JOIN sources s ON p.id = s.policy_id
      WHERE 1=1
        AND p.is_archived = 0
    `;

    const selectParams = [];
    const params = [];

    let searchRankSelect = `0 AS search_rank,`;

    if (q) {
      fromAndWhere += `
        AND (
          p.title LIKE ?
          OR p.summary LIKE ?
          OR p.outcome_summary LIKE ?
          OR p.impact_notes LIKE ?
          OR pr.full_name LIKE ?
          OR pa.name LIKE ?
          OR e.name LIKE ?
          OR pc.name LIKE ?
        )
      `;
      const likeValue = `%${q}%`;
      params.push(
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue,
        likeValue
      );

      searchRankSelect = `
        (
          CASE
            WHEN LOWER(p.title) = LOWER(?) THEN 120
            WHEN LOWER(p.title) LIKE LOWER(?) THEN 90
            WHEN LOWER(p.title) LIKE LOWER(?) THEN 70
            WHEN LOWER(pc.name) = LOWER(?) THEN 45
            WHEN LOWER(pr.full_name) = LOWER(?) THEN 30
            WHEN LOWER(pa.name) = LOWER(?) THEN 30
            WHEN LOWER(e.name) = LOWER(?) THEN 30
            WHEN LOWER(p.summary) LIKE LOWER(?) THEN 20
            WHEN LOWER(p.outcome_summary) LIKE LOWER(?) THEN 15
            WHEN LOWER(p.impact_notes) LIKE LOWER(?) THEN 10
            ELSE 0
          END
        ) AS search_rank,
      `;

      selectParams.push(
        q,
        `${q}%`,
        `%${q}%`,
        q,
        q,
        q,
        q,
        `%${q}%`,
        `%${q}%`,
        `%${q}%`
      );
    }

    if (party) {
      fromAndWhere += ` AND pa.name = ?`;
      params.push(party);
    }

    if (era) {
      fromAndWhere += ` AND e.name = ?`;
      params.push(era);
    }

    if (category) {
      fromAndWhere += ` AND pc.name = ?`;
      params.push(category);
    }

    if (impactDirection) {
      fromAndWhere += ` AND p.impact_direction = ?`;
      params.push(impactDirection);
    }

    if (directBlackImpact === "true") {
      fromAndWhere += ` AND p.direct_black_impact = 1`;
    } else if (directBlackImpact === "false") {
      fromAndWhere += ` AND p.direct_black_impact = 0`;
    }

    if (bipartisan === "true") {
      fromAndWhere += ` AND p.bipartisan = 1`;
    } else if (bipartisan === "false") {
      fromAndWhere += ` AND p.bipartisan = 0`;
    }

    if (normalizedYearFrom !== null) {
      fromAndWhere += ` AND p.year_enacted >= ?`;
      params.push(normalizedYearFrom);
    }

    if (normalizedYearTo !== null) {
      fromAndWhere += ` AND p.year_enacted <= ?`;
      params.push(normalizedYearTo);
    }

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) AS total
      ${fromAndWhere}
    `;

    const [countRows] = await db.query(countQuery, params);
    const total = Number(countRows[0]?.total || 0);

    let dataQuery = `
      SELECT DISTINCT
        p.id,
        p.title,
        p.policy_type,
        p.year_enacted,
        p.date_enacted,
        p.summary,
        p.bipartisan,
        p.direct_black_impact,
        p.status,
        p.impact_direction,
        pr.full_name AS president,
        pa.name AS primary_party,
        e.name AS era,
        ps.directness_score,
        ps.material_impact_score,
        ps.evidence_score,
        ps.durability_score,
        ps.equity_score,
        ps.harm_offset_score,
        (
          SELECT COUNT(DISTINCT epl.explainer_id)
          FROM explainer_policy_links epl
          JOIN explainers e2
            ON e2.id = epl.explainer_id
           AND e2.published = 1
          WHERE epl.policy_id = p.id
        ) AS related_explainer_count,
        (
          SELECT COUNT(DISTINCT efbl.future_bill_id)
          FROM explainer_policy_links epl
          JOIN explainer_future_bill_links efbl
            ON efbl.explainer_id = epl.explainer_id
          WHERE epl.policy_id = p.id
        ) AS related_future_bill_count,
        (
          SELECT COUNT(DISTINCT ltr.legislator_id)
          FROM explainer_policy_links epl
          JOIN explainer_future_bill_links efbl
            ON efbl.explainer_id = epl.explainer_id
          JOIN future_bill_links fbl
            ON fbl.future_bill_id = efbl.future_bill_id
          JOIN legislator_tracked_bill_roles ltr
            ON ltr.tracked_bill_id = fbl.tracked_bill_id
          WHERE epl.policy_id = p.id
        ) AS linked_legislator_count,
        ${searchRankSelect}
        ${POLICY_IMPACT_SCORE_SQL} AS impact_score,
        COUNT(DISTINCT s.id) AS total_sources,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Government' THEN s.id END) AS government_sources,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Academic' THEN s.id END) AS academic_sources,
        COUNT(DISTINCT CASE WHEN s.source_type = 'Archive' THEN s.id END) AS archive_sources
      ${fromAndWhere}
      GROUP BY
        p.id,
        p.title,
        p.policy_type,
        p.year_enacted,
        p.date_enacted,
        p.summary,
        p.bipartisan,
        p.direct_black_impact,
        p.status,
        p.impact_direction,
        pr.full_name,
        pa.name,
        e.name,
        ps.directness_score,
        ps.material_impact_score,
        ps.evidence_score,
        ps.durability_score,
        ps.equity_score,
        ps.harm_offset_score
    `;

    switch (sort) {
      case "relevance":
        dataQuery += q
          ? ` ORDER BY search_rank DESC, impact_score DESC, p.year_enacted DESC, p.title ASC`
          : ` ORDER BY p.year_enacted ASC, p.title ASC`;
        break;
      case "year_desc":
        dataQuery += ` ORDER BY p.year_enacted DESC, p.title ASC`;
        break;
      case "title_asc":
        dataQuery += ` ORDER BY p.title ASC`;
        break;
      case "title_desc":
        dataQuery += ` ORDER BY p.title DESC`;
        break;
      case "impact_score_desc":
        dataQuery += ` ORDER BY impact_score DESC, p.year_enacted DESC, p.title ASC`;
        break;
      case "impact_score_asc":
        dataQuery += ` ORDER BY impact_score ASC, p.year_enacted ASC, p.title ASC`;
        break;
      case "year_asc":
      default:
        dataQuery += ` ORDER BY p.year_enacted ASC, p.title ASC`;
        break;
    }

    dataQuery += ` LIMIT ? OFFSET ?`;

    const [rows] = await db.query(dataQuery, [...selectParams, ...params, pageSize, offset]);

    const enhanced = rows.map((row) => {
      const totalSources = Number(row.total_sources || 0);
      const governmentSources = Number(row.government_sources || 0);
      const academicSources = Number(row.academic_sources || 0);
      const archiveSources = Number(row.archive_sources || 0);

      let evidence_strength = "Limited";

      if (
        totalSources >= 3 &&
        (governmentSources >= 1 || academicSources >= 1)
      ) {
        evidence_strength = "Strong";
      } else if (totalSources >= 2) {
        evidence_strength = "Moderate";
      }

      return {
        ...row,
        impact_score:
          row.impact_score !== null && row.impact_score !== undefined
            ? Number(row.impact_score)
            : null,
        accountability_summary: {
          related_explainer_count: Number(row.related_explainer_count || 0),
          related_future_bill_count: Number(row.related_future_bill_count || 0),
          linked_legislator_count: Number(row.linked_legislator_count || 0),
        },
        evidence_summary: {
          total_sources: totalSources,
          government_sources: governmentSources,
          academic_sources: academicSources,
          archive_sources: archiveSources,
          evidence_strength,
        },
      };
    });

    return NextResponse.json({
      items: enhanced,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
        has_prev: page > 1,
        has_next: offset + enhanced.length < total,
      },
    });
  } catch (error) {
    console.error("Error fetching policies:", error);
    return NextResponse.json(
      { error: "Failed to fetch policies" },
      { status: 500 }
    );
  }
}
