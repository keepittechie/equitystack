import { NextResponse } from "next/server";

function unauthorizedResponse() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Admin Area"',
    },
  });
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isProtectedRelationshipWrite =
    pathname.match(/^\/api\/policies\/\d+\/relationships$/) &&
    request.method === "POST";

  if (!isAdminPage && !isProtectedRelationshipWrite) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const base64Credentials = authHeader.split(" ")[1];
  const decoded = atob(base64Credentials);
  const [username, password] = decoded.split(":");

  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (
    username !== expectedUsername ||
    password !== expectedPassword
  ) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/policies/:path*/relationships"],
};
