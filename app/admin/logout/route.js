import { NextResponse } from "next/server";

export async function GET(request) {
  const destination = new URL("/", request.url);
  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
