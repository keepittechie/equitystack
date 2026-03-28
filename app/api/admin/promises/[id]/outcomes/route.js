import { NextResponse } from "next/server";
import { validateAdminPromiseOutcomePayload } from "@/lib/admin/promiseValidation";
import { createAdminPromiseOutcome } from "@/lib/services/adminPromiseService";

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const promiseId = Number(id);

    if (!Number.isFinite(promiseId)) {
      return NextResponse.json({ error: "Invalid promise id" }, { status: 400 });
    }

    const body = await request.json();
    const { errors, payload } = validateAdminPromiseOutcomePayload(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    const promise = await createAdminPromiseOutcome(promiseId, payload);
    return NextResponse.json({ success: true, promise });
  } catch (error) {
    const message = error?.message || "Failed to create promise outcome";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
