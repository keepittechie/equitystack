export async function GET() {
  return new Response("Admin session cleared. Revisit /admin to log in again.", {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="Admin Area"',
    },
  });
}
