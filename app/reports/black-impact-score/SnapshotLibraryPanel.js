"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CopyShareLinkButton from "./CopyShareLinkButton";

const STORAGE_KEY = "equitystack:black-impact-score:saved-snapshots";
const MAX_SNAPSHOTS = 20;

function formatSavedAt(value) {
  if (!value) {
    return "Saved date unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Saved date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function normalizeSnapshot(rawSnapshot) {
  if (!rawSnapshot || typeof rawSnapshot !== "object") {
    return null;
  }

  const permalinkUrl =
    typeof rawSnapshot.permalinkUrl === "string" && rawSnapshot.permalinkUrl.trim()
      ? rawSnapshot.permalinkUrl.trim()
      : null;

  if (!permalinkUrl) {
    return null;
  }

  return {
    label:
      typeof rawSnapshot.label === "string" && rawSnapshot.label.trim()
        ? rawSnapshot.label.trim()
        : "Saved Snapshot",
    permalinkUrl,
    modeSummary:
      typeof rawSnapshot.modeSummary === "string" && rawSnapshot.modeSummary.trim()
        ? rawSnapshot.modeSummary.trim()
        : "Report state",
    savedAt:
      typeof rawSnapshot.savedAt === "string" && rawSnapshot.savedAt.trim()
        ? rawSnapshot.savedAt.trim()
        : new Date().toISOString(),
  };
}

function readSnapshots() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeSnapshot).filter(Boolean).slice(0, MAX_SNAPSHOTS);
  } catch {
    return [];
  }
}

function writeSnapshots(items) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_SNAPSHOTS)));
    return true;
  } catch {
    return false;
  }
}

export default function SnapshotLibraryPanel({ currentSnapshot }) {
  const [snapshots, setSnapshots] = useState([]);
  const [storageReady, setStorageReady] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    try {
      const items = readSnapshots();
      setSnapshots(items);
      setStorageReady(typeof window !== "undefined" && Boolean(window.localStorage));
    } catch {
      setStorageReady(false);
      setSnapshots([]);
    }
  }, []);

  const currentSnapshotRecord = useMemo(
    () => ({
      label: currentSnapshot.label,
      permalinkUrl: currentSnapshot.permalinkUrl,
      modeSummary: currentSnapshot.modeSummary,
      savedAt: new Date().toISOString(),
    }),
    [currentSnapshot.label, currentSnapshot.modeSummary, currentSnapshot.permalinkUrl]
  );

  function handleSaveSnapshot() {
    if (!storageReady) {
      setStatusMessage("Saved snapshots are unavailable in this browser.");
      return;
    }

    const nextItems = (() => {
      const existingIndex = snapshots.findIndex(
        (item) => item.permalinkUrl === currentSnapshotRecord.permalinkUrl
      );

      if (existingIndex === -1) {
        return [currentSnapshotRecord, ...snapshots].slice(0, MAX_SNAPSHOTS);
      }

      const updatedItems = [...snapshots];
      updatedItems[existingIndex] = currentSnapshotRecord;

      return [
        currentSnapshotRecord,
        ...updatedItems.filter((_, index) => index !== existingIndex),
      ].slice(0, MAX_SNAPSHOTS);
    })();

    if (!writeSnapshots(nextItems)) {
      setStatusMessage("Saved snapshots are unavailable in this browser.");
      return;
    }

    setSnapshots(nextItems);
    setStatusMessage("Current view saved.");
  }

  function handleDeleteSnapshot(permalinkUrl) {
    const nextItems = snapshots.filter((item) => item.permalinkUrl !== permalinkUrl);

    if (!writeSnapshots(nextItems)) {
      setStatusMessage("Unable to update saved snapshots.");
      return;
    }

    setSnapshots(nextItems);
    setStatusMessage("Snapshot removed.");
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <section className="card-surface rounded-[1.6rem] p-5 print:hidden">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold mb-2">Saved Snapshots</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            Save the current report state in this browser and reopen it later with the same link and visible mode context.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSaveSnapshot}
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Save Current View
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-5 py-2 text-sm font-medium"
          >
            Print or Save PDF
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">Current Snapshot</p>
        <p className="text-base font-semibold mt-2">{currentSnapshot.label}</p>
        <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{currentSnapshot.modeSummary}</p>
      </div>

      {statusMessage ? (
        <p className="text-sm text-[var(--ink-soft)] mt-4">{statusMessage}</p>
      ) : null}

      {!storageReady ? (
        <p className="text-sm text-[var(--ink-soft)] mt-4">
          Saved snapshots are unavailable in this browser, but the permalink and print actions still work.
        </p>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)] mt-4">
          No saved snapshots yet. Save the current view to keep a reusable local record in this browser.
        </p>
      ) : (
        <div className="space-y-3 mt-4">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.permalinkUrl}
              className="rounded-[1rem] border border-[rgba(120,53,15,0.1)] bg-white/85 p-4"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="max-w-3xl">
                  <p className="text-base font-semibold">{snapshot.label}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{snapshot.modeSummary}</p>
                  <p className="text-xs text-[var(--ink-soft)] mt-2">{formatSavedAt(snapshot.savedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={snapshot.permalinkUrl}
                    className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                  >
                    Open
                  </Link>
                  <CopyShareLinkButton
                    path={snapshot.permalinkUrl}
                    defaultLabel="Copy Permalink"
                    copiedLabel="Permalink Copied"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteSnapshot(snapshot.permalinkUrl)}
                    className="rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
