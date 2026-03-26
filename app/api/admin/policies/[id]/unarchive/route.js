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
      SET is_archived = 0
      WHERE id = ?
      `,
      [policyId]
    );

    return NextResponse.json({
      success: true,
      policy_id: policyId,
      archived: false,
    });
  } catch (error) {
    console.error("Error unarchiving policy:", error);
    return NextResponse.json(
      { error: "Failed to unarchive policy" },
      { status: 500 }
    );
  }
}
