import { NextResponse } from "next/server";

export async function GET() {
  const destination = new URL("https://equitystack.org");
  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
