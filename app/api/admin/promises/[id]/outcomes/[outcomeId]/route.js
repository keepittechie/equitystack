import { NextResponse } from "next/server";
import { validateAdminPromiseOutcomePayload } from "@/lib/admin/promiseValidation";
import { updateAdminPromiseOutcome } from "@/lib/services/adminPromiseService";

export async function PUT(request, context) {
  try {
    const { id, outcomeId } = await context.params;
    const promiseId = Number(id);
    const numericOutcomeId = Number(outcomeId);

    if (!Number.isFinite(promiseId) || !Number.isFinite(numericOutcomeId)) {
      return NextResponse.json(
        { error: "Invalid promise or outcome id" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { errors, payload } = validateAdminPromiseOutcomePayload(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    const promise = await updateAdminPromiseOutcome(
      promiseId,
      numericOutcomeId,
      payload
    );

    return NextResponse.json({ success: true, promise });
  } catch (error) {
    const message = error?.message || "Failed to update promise outcome";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
