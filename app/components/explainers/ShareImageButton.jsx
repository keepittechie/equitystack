"use client";

import { useState } from "react";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 675;

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugifyFilename(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function wrapText(value, maxChars, maxLines) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]?$/, "")}...`;
  }

  return lines;
}

function renderTextLines(lines, { x, y, fontSize, lineHeight, fill, weight = 500 }) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}">${escapeXml(line)}</text>`
    )
    .join("");
}

function buildShareCardSvg({
  explainerTitle,
  explainerSlug,
  title,
  text,
  context,
}) {
  const explainerLines = wrapText(explainerTitle, 44, 2);
  const cardTitleLines = wrapText(title, 34, 2);
  const contextLines = wrapText(context, 76, 2);
  const cardTextLines = wrapText(text, 62, contextLines.length ? 4 : 5);
  const path = explainerSlug ? `equitystack.org/explainers/${explainerSlug}` : "equitystack.org";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
  <rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="#040a12"/>
  <rect x="44" y="42" width="1112" height="591" rx="28" fill="#0b1421" stroke="rgba(132,247,198,0.32)" stroke-width="2"/>
  <rect x="72" y="70" width="1056" height="535" rx="22" fill="rgba(18,31,49,0.72)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <circle cx="98" cy="100" r="8" fill="#84f7c6"/>
  <text x="116" y="106" fill="#84f7c6" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="2">EquityStack</text>
  <text x="900" y="106" fill="#9ba9b7" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" text-anchor="end">Share card</text>
  ${renderTextLines(explainerLines, {
    x: 88,
    y: 168,
    fontSize: 34,
    lineHeight: 42,
    fill: "#ffffff",
    weight: 700,
  })}
  <line x1="88" y1="255" x2="1112" y2="255" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  ${renderTextLines(cardTitleLines, {
    x: 88,
    y: 320,
    fontSize: 44,
    lineHeight: 52,
    fill: "#ffffff",
    weight: 800,
  })}
  ${renderTextLines(cardTextLines, {
    x: 88,
    y: 420,
    fontSize: 28,
    lineHeight: 38,
    fill: "#d7e1ea",
    weight: 500,
  })}
  ${
    contextLines.length
      ? `<rect x="88" y="538" width="1024" height="70" rx="14" fill="rgba(132,247,198,0.08)" stroke="rgba(132,247,198,0.18)" stroke-width="1"/>
  ${renderTextLines(contextLines, {
    x: 108,
    y: 568,
    fontSize: 20,
    lineHeight: 24,
    fill: "#9fb2c4",
    weight: 600,
  })}`
      : ""
  }
  <text x="88" y="628" fill="#84f7c6" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">Read the full explainer at ${escapeXml(path)}</text>
</svg>`.trim();
}

async function downloadShareImage({ filename, svg }) {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    throw new Error("Image generation is not available in this browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context || !canvas.toBlob) {
    throw new Error("Canvas export is not available in this browser.");
  }

  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The share image could not be rendered."));
      element.src = svgUrl;
    });

    context.drawImage(image, 0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error("The share image could not be exported."));
        }
      }, "image/png");
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function ShareImageButton({
  explainerTitle,
  explainerSlug,
  title,
  text,
  context = null,
}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleDownload() {
    setStatus("loading");
    setError("");

    try {
      const filename = `equitystack-${slugifyFilename(explainerSlug || explainerTitle)}-${slugifyFilename(title)}.png`;
      const svg = buildShareCardSvg({
        explainerTitle,
        explainerSlug,
        title,
        text,
        context,
      });

      await downloadShareImage({ filename, svg });
      setStatus("done");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      setError("Could not generate image. Try copying the text instead.");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === "loading"}
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] disabled:cursor-wait disabled:opacity-70"
        aria-live="polite"
      >
        {status === "loading" ? "Generating..." : status === "done" ? "Downloaded" : "Download image"}
      </button>
      {error ? (
        <span className="max-w-[13rem] text-[11px] leading-4 text-[var(--warning)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
