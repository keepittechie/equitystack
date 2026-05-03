import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const ALLOWED_RELATIONSHIP_TYPES = [
  "expands",
  "restricts",
  "replaces",
  "responds_to",
  "enables",
  "undermines",
];

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const policyId = Number(id);

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    const body = await request.json();
    const relatedPolicyId = Number(body.related_policy_id);
    const relationshipType = body.relationship_type;
    const notes = body.notes?.trim() || null;

    if (!Number.isFinite(relatedPolicyId)) {
      return NextResponse.json(
        { error: "Invalid related policy id" },
        { status: 400 }
      );
    }

    if (policyId === relatedPolicyId) {
      return NextResponse.json(
        { error: "A policy cannot relate to itself" },
        { status: 400 }
      );
    }

    if (!ALLOWED_RELATIONSHIP_TYPES.includes(relationshipType)) {
      return NextResponse.json(
        { error: "Invalid relationship type" },
        { status: 400 }
      );
    }

    const db = getDb();

    const [policyRows] = await db.query(
      `
      SELECT id
      FROM policies
      WHERE id IN (?, ?)
        AND is_archived = 0
      `,
      [policyId, relatedPolicyId]
    );

    if (policyRows.length !== 2) {
      return NextResponse.json(
        { error: "One or both policies were not found" },
        { status: 404 }
      );
    }

    const [existingRows] = await db.query(
      `
      SELECT id
      FROM policy_relationships
      WHERE
        (policy_id = ? AND related_policy_id = ? AND relationship_type = ?)
        OR
        (policy_id = ? AND related_policy_id = ? AND relationship_type = ?)
      LIMIT 1
      `,
      [
        policyId,
        relatedPolicyId,
        relationshipType,
        relatedPolicyId,
        policyId,
        relationshipType,
      ]
    );

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: "Relationship already exists" },
        { status: 409 }
      );
    }

    const [result] = await db.query(
      `
      INSERT INTO policy_relationships (
        policy_id,
        related_policy_id,
        relationship_type,
        notes
      )
      VALUES (?, ?, ?, ?)
      `,
      [policyId, relatedPolicyId, relationshipType, notes]
    );

    return NextResponse.json({
      success: true,
      id: result.insertId,
    });
  } catch (error) {
    console.error("Error creating relationship:", error);
    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 }
    );
  }
}
