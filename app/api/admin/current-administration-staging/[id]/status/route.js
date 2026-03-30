import { NextResponse } from "next/server";

export async function PATCH(request, context) {
  const { id } = await context.params;
  return NextResponse.json(
    {
      error: `Legacy staging mutation is disabled for staged item ${id}. Use /admin/current-admin-review and the canonical current-admin workflow instead.`,
    },
    { status: 409 }
  );
}
