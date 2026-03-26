import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PATCH(request, context) {
  try {
    const db = getDb();
    const { id } = await context.params;
    const policyId = Number(id);

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    await db.query(
      `
      UPDATE policies
      SET is_archived = 1
      WHERE id = ?
      `,
      [policyId]
    );

    return NextResponse.json({
      success: true,
      policy_id: policyId,
      archived: true,
    });
  } catch (error) {
    console.error("Error archiving policy:", error);
    return NextResponse.json(
      { error: "Failed to archive policy" },
      { status: 500 }
    );
  }
}
