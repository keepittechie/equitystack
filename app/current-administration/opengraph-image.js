import { ImageResponse } from "next/og";
import { fetchCurrentAdministrationOverview } from "@/lib/services/promiseService";

export const alt = "EquityStack current administration overview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const revalidate = 3600;

function formatTermRange(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }

  if (Number.isFinite(startYear)) {
    return `${startYear}-Present`;
  }

  return "Current Term";
}

function buildStat(label, value) {
  return {
    label,
    value: String(value ?? 0),
  };
}

export default async function Image() {
  try {
    const overview = await fetchCurrentAdministrationOverview();

    if (!overview) {
      throw new Error("Missing current administration overview");
    }

    const termLabel = formatTermRange(
      overview?.president?.term_start,
      overview?.president?.term_end
    );

    const stats = [
      buildStat("Promises", overview.total_promises),
      buildStat("Actions", overview.total_actions),
      buildStat("Mixed", overview.impact_breakdown?.Mixed || 0),
    ];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            position: "relative",
            background: "linear-gradient(135deg, #f8efe4 0%, #fffaf4 48%, #f2e4cf 100%)",
            color: "#1f160f",
            fontFamily: "system-ui, sans-serif",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at top left, rgba(138,59,18,0.18), transparent 38%), radial-gradient(circle at bottom right, rgba(180,83,9,0.14), transparent 34%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: -90,
              top: -100,
              width: 360,
              height: 360,
              borderRadius: 999,
              background: "rgba(138,59,18,0.08)",
            }}
          />

          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: "56px 64px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.68)",
                  border: "1px solid rgba(138,59,18,0.14)",
                  fontSize: 24,
                  color: "#8a3b12",
                }}
              >
                Live Public Overview
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: "#6b4c36",
                }}
              >
                EquityStack
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: 900,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  color: "#8a3b12",
                }}
              >
                Current Administration
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: 70,
                  fontWeight: 800,
                  lineHeight: 1.02,
                  letterSpacing: "-0.05em",
                  color: "#1f160f",
                }}
              >
                {overview.administration_name}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: 34,
                  color: "#4b3426",
                }}
              >
                {termLabel}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 26,
                  fontSize: 28,
                  lineHeight: 1.35,
                  color: "#4b3426",
                  maxWidth: 850,
                }}
              >
                Reviewed promises, actions, and documented outcomes from the current presidency term.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 24,
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "16px 18px",
                      borderRadius: 22,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(138,59,18,0.12)",
                      minWidth: 160,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontSize: 16,
                        textTransform: "uppercase",
                        letterSpacing: "0.14em",
                        color: "#8a3b12",
                      }}
                    >
                      {stat.label}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        marginTop: 8,
                        fontSize: 28,
                        fontWeight: 700,
                        color: "#1f160f",
                      }}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  padding: "18px 22px",
                  borderRadius: 24,
                  background: "#8a3b12",
                  color: "#fffaf4",
                  fontSize: 26,
                  fontWeight: 700,
                }}
              >
                Evidence-backed
              </div>
            </div>
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  } catch {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#1f160f",
            color: "#fffaf4",
            fontFamily: "system-ui, sans-serif",
            padding: "56px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#f59e0b",
            }}
          >
            EquityStack
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 860,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: "-0.05em",
              }}
            >
              Current Administration
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 30,
                lineHeight: 1.35,
                color: "#e7d9ca",
              }}
            >
              Live public overview of reviewed promises, actions, and documented outcomes.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: "#e7d9ca",
            }}
          >
            equitystack.org/current-administration
          </div>
        </div>
      ),
      {
        ...size,
      }
    );
  }
}
