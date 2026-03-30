import { NextResponse } from "next/server";

export async function POST(request, context) {
  const { id } = await context.params;
  return NextResponse.json(
    {
      error: `Legacy staging promotion is disabled for staged item ${id}. Use the canonical current-admin review, finalize, pre-commit, and import workflow instead.`,
    },
    { status: 409 }
  );
}
