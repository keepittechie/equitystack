import { ImageResponse } from "next/og";

export const cardImageAlt = "EquityStack shareable card preview";
export const cardImageSize = {
  width: 1200,
  height: 630,
};
export const cardImageContentType = "image/png";

function trimText(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function pickIndicator(card) {
  const preferred = (card.keyData || []).find((item) =>
    ["Impact", "Status", "Priority", "President", "Category"].includes(item.label)
  );

  return preferred || card.keyData?.[0] || null;
}

export function buildCardImageResponse(card) {
  const indicator = pickIndicator(card);
  const title = trimText(card.title, 120);
  const summary = trimText(card.summary, 180);
  const category = trimText(card.category, 40);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "linear-gradient(135deg, #f8efe4 0%, #fffaf4 45%, #f2e4cf 100%)",
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
              "radial-gradient(circle at top left, rgba(138,59,18,0.18), transparent 38%), radial-gradient(circle at bottom right, rgba(180,83,9,0.15), transparent 34%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            right: -80,
            top: -80,
            width: 320,
            height: 320,
            borderRadius: 999,
            background: "rgba(138,59,18,0.08)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "56px 64px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
            <div
              style={{
                display: "flex",
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.65)",
                border: "1px solid rgba(138,59,18,0.14)",
                fontSize: 24,
                color: "#8a3b12",
              }}
            >
              {category}
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
              maxWidth: 980,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 68,
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: "-0.05em",
                color: "#1f160f",
              }}
            >
              {title}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 30,
                lineHeight: 1.35,
                color: "#4b3426",
                maxWidth: 930,
              }}
            >
              {summary}
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
              {(card.keyData || []).slice(0, 3).map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
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
                    {item.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      marginTop: 8,
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#1f160f",
                    }}
                  >
                    {trimText(item.value, 24)}
                  </div>
                </div>
              ))}
            </div>

            {indicator ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  padding: "18px 20px",
                  borderRadius: 24,
                  background: "#8a3b12",
                  color: "#fffaf4",
                  minWidth: 220,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 16,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    opacity: 0.8,
                  }}
                >
                  {indicator.label}
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 8,
                    fontSize: 28,
                    fontWeight: 700,
                    textAlign: "right",
                  }}
                >
                  {trimText(indicator.value, 26)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      ...cardImageSize,
    }
  );
}

export function buildFallbackCardImageResponse({ title = "EquityStack", category = "Shareable Card" } = {}) {
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
          padding: "60px 70px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#f59e0b",
            textTransform: "uppercase",
            letterSpacing: "0.16em",
          }}
        >
          {category}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {trimText(title, 120)}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#d6c7b6",
          }}
        >
          EquityStack
        </div>
      </div>
    ),
    {
      ...cardImageSize,
    }
  );
}
