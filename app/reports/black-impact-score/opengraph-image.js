import { ImageResponse } from "next/og";
import { headers } from "next/headers";

export const alt = "Black Impact Score";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function formatPresidentSlug(slug) {
  if (!slug) {
    return null;
  }

  return String(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSearchParamsFromHeaders(headerStore) {
  const nextUrl = headerStore.get("next-url");

  if (!nextUrl) {
    return new URLSearchParams();
  }

  try {
    const parsed = nextUrl.startsWith("http")
      ? new URL(nextUrl)
      : new URL(nextUrl, "http://localhost");

    return parsed.searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export default async function Image() {
  const headerStore = await headers();
  const searchParams = getSearchParamsFromHeaders(headerStore);
  const presidentSlug = searchParams.get("president");
  const presidentName = formatPresidentSlug(presidentSlug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#0d1117",
          color: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(180,83,9,0.22), transparent 42%), radial-gradient(circle at bottom right, rgba(217,119,6,0.18), transparent 34%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "60px 70px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                fontSize: 24,
                color: "#e2e8f0",
              }}
            >
              Outcome-Based Presidential Analysis
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 930,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 74,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.04em",
                color: "#ffffff",
              }}
            >
              Black Impact Score
            </div>

            {presidentName ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: 28,
                  paddingTop: 24,
                  borderTop: "1px solid rgba(255,255,255,0.16)",
                  maxWidth: 760,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 24,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#f59e0b",
                  }}
                >
                  Outcome-Based Score
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 16,
                    fontSize: 54,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: "#f8fafc",
                  }}
                >
                  {presidentName}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  marginTop: 24,
                  fontSize: 30,
                  lineHeight: 1.4,
                  color: "#cbd5e1",
                  maxWidth: 860,
                }}
              >
                Data-driven presidential analysis based on documented real-world outcomes affecting Black Americans.
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 22,
                  color: "#e2e8f0",
                }}
              >
                Documented Outcomes
              </div>
              <div
                style={{
                  display: "flex",
                  padding: "10px 16px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 22,
                  color: "#e2e8f0",
                }}
              >
                Evidence-Based Scoring
              </div>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#94a3b8",
              }}
            >
              EquityStack
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
