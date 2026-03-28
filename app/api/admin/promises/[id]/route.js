import { NextResponse } from "next/server";
import { validateAdminPromisePayload } from "@/lib/admin/promiseValidation";
import {
  fetchAdminPromiseDetail,
  updateAdminPromiseRecord,
} from "@/lib/services/adminPromiseService";

export async function GET(request, context) {
  try {
    const { id } = await context.params;
    const promiseId = Number(id);

    if (!Number.isFinite(promiseId)) {
      return NextResponse.json({ error: "Invalid promise id" }, { status: 400 });
    }

    const promise = await fetchAdminPromiseDetail(promiseId);
    if (!promise) {
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    return NextResponse.json(promise);
  } catch (error) {
    console.error("Error fetching admin promise detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin promise detail" },
      { status: 500 }
    );
  }
}

export async function PUT(request, context) {
  try {
    const { id } = await context.params;
    const promiseId = Number(id);

    if (!Number.isFinite(promiseId)) {
      return NextResponse.json({ error: "Invalid promise id" }, { status: 400 });
    }

    const body = await request.json();
    const { errors, payload } = validateAdminPromisePayload(body);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: errors[0], errors },
        { status: 400 }
      );
    }

    const promise = await updateAdminPromiseRecord(promiseId, payload);
    return NextResponse.json({ success: true, promise });
  } catch (error) {
    const message = error?.message || "Failed to update promise";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
