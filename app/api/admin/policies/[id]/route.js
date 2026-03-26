import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validatePolicyPayload } from "@/lib/admin/policyValidation";

export async function GET(request, context) {
  try {
    const db = getDb();
    const { id } = await context.params;
    const policyId = Number(id);

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    const [policyRows] = await db.query(
      `
      SELECT *
      FROM policies
      WHERE id = ?
      `,
      [policyId]
    );

    if (policyRows.length === 0) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const [categoryRows] = await db.query(
      `
      SELECT category_id
      FROM policy_policy_categories
      WHERE policy_id = ?
      `,
      [policyId]
    );

    const [scoreRows] = await db.query(
      `
      SELECT
        directness_score,
        material_impact_score,
        evidence_score,
        durability_score,
        equity_score,
        harm_offset_score,
        notes
      FROM policy_scores
      WHERE policy_id = ?
      LIMIT 1
      `,
      [policyId]
    );

    const [sourceRows] = await db.query(
      `
      SELECT
        id,
        source_title,
        source_url,
        source_type,
        publisher,
        published_date,
        notes
      FROM sources
      WHERE policy_id = ?
      ORDER BY id ASC
      `,
      [policyId]
    );

    const [metricRows] = await db.query(
      `
      SELECT
        id,
        metric_name,
        demographic_group,
        before_value,
        after_value,
        unit,
        geography,
        year_before,
        year_after,
        methodology_note
      FROM metrics
      WHERE policy_id = ?
      ORDER BY id ASC
      `,
      [policyId]
    );

    return NextResponse.json({
      ...policyRows[0],
      category_ids: categoryRows.map((row) => row.category_id),
      scores: scoreRows[0] || null,
      sources: sourceRows,
      metrics: metricRows,
    });
  } catch (error) {
    console.error("Error fetching admin policy detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin policy detail" },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  const db = getDb();
  const connection = await db.getConnection();

  try {
    const { id } = await context.params;
    const policyId = Number(id);

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    const body = await request.json();

    const { errors, payload } = validatePolicyPayload(body);
    const {
      title,
      policy_type,
      summary,
      year_enacted,
      date_enacted,
      era_id,
      president_id,
      house_party_id,
      senate_party_id,
      primary_party_id,
      bipartisan,
      direct_black_impact,
      outcome_summary,
      status,
      impact_direction,
      impact_notes,
      category_ids,
      scores,
      sources,
      metrics,
    } = payload;

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

    await connection.query(
      `
      UPDATE policies
      SET
        title = ?,
        policy_type = ?,
        summary = ?,
        year_enacted = ?,
        date_enacted = ?,
        era_id = ?,
        president_id = ?,
        house_party_id = ?,
        senate_party_id = ?,
        primary_party_id = ?,
        bipartisan = ?,
        direct_black_impact = ?,
        outcome_summary = ?,
        status = ?,
        impact_direction = ?,
        impact_notes = ?
      WHERE id = ?
      `,
      [
        title,
        policy_type,
        summary || null,
        year_enacted,
        date_enacted || null,
        era_id,
        president_id,
        house_party_id,
        senate_party_id,
        primary_party_id,
        bipartisan,
        direct_black_impact,
        outcome_summary || null,
        status || "Active",
        impact_direction || "Positive",
        impact_notes || null,
        policyId,
      ]
    );

    await connection.query(
      `DELETE FROM policy_policy_categories WHERE policy_id = ?`,
      [policyId]
    );

    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const categoryValues = category_ids.map((categoryId) => [
        policyId,
        Number(categoryId),
      ]);

      await connection.query(
        `
        INSERT INTO policy_policy_categories (policy_id, category_id)
        VALUES ?
        `,
        [categoryValues]
      );
    }

    await connection.query(`DELETE FROM policy_scores WHERE policy_id = ?`, [policyId]);

    if (scores && typeof scores === "object") {
      await connection.query(
        `
        INSERT INTO policy_scores (
          policy_id,
          directness_score,
          material_impact_score,
          evidence_score,
          durability_score,
          equity_score,
          harm_offset_score,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          policyId,
          scores.directness_score,
          scores.material_impact_score,
          scores.evidence_score,
          scores.durability_score,
          scores.equity_score,
          scores.harm_offset_score,
          scores.notes || null,
        ]
      );
    }

    await connection.query(`DELETE FROM sources WHERE policy_id = ?`, [policyId]);

    if (Array.isArray(sources)) {
      for (const source of sources) {
        if (!source?.source_title || !source?.source_url || !source?.source_type) {
          continue;
        }

        await connection.query(
          `
          INSERT INTO sources (
            policy_id,
            source_title,
            source_url,
            source_type,
            publisher,
            published_date,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            policyId,
            source.source_title,
            source.source_url,
            source.source_type,
            source.publisher || null,
            source.published_date || null,
            source.notes || null,
          ]
        );
      }
    }

    await connection.query(`DELETE FROM metrics WHERE policy_id = ?`, [policyId]);

    if (Array.isArray(metrics)) {
      for (const metric of metrics) {
        if (!metric?.metric_name) {
          continue;
        }

        await connection.query(
          `
          INSERT INTO metrics (
            policy_id,
            metric_name,
            demographic_group,
            before_value,
            after_value,
            unit,
            geography,
            year_before,
            year_after,
            methodology_note
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            policyId,
            metric.metric_name,
            metric.demographic_group,
            metric.before_value,
            metric.after_value,
            metric.unit || null,
            metric.geography || null,
            metric.year_before,
            metric.year_after,
            metric.methodology_note || null,
          ]
        );
      }
    }

    await connection.commit();

    return NextResponse.json({
      success: true,
      policy_id: policyId,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error updating policy:", error);
    return NextResponse.json(
      { error: "Failed to update policy" },
      { status: 500 }
    );
  } finally {
    connection.release();
  }
}
