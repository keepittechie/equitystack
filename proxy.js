import { NextResponse } from "next/server";

function unauthorizedResponse(request) {
  const pathname = request.nextUrl.pathname || "";
  const accept = request.headers.get("accept") || "";
  const isApiRequest =
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname.endsWith("/api") ||
    pathname.includes("/api/") ||
    accept.includes("application/json");

  if (isApiRequest) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Authentication required.",
          code: "admin_auth_required",
        },
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Area"',
        },
      }
    );
  }

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
  const isAdminApi = pathname.startsWith("/api/admin");
  const isProtectedRelationshipWrite =
    pathname.match(/^\/api\/policies\/\d+\/relationships$/) &&
    request.method === "POST";

  if (!isAdminPage && !isAdminApi && !isProtectedRelationshipWrite) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse(request);
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
    return unauthorizedResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/api/policies/:path*/relationships"],
};
