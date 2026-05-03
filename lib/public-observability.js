import { getDb } from "@/lib/db";

let ensureTablesPromise;

async function ensureTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      const db = getDb();

      await db.query(`
        CREATE TABLE IF NOT EXISTS public_signals (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          event_type VARCHAR(64) NOT NULL,
          page_path VARCHAR(512) NOT NULL,
          route_kind VARCHAR(64) DEFAULT NULL,
          entity_type VARCHAR(64) DEFAULT NULL,
          entity_key VARCHAR(191) DEFAULT NULL,
          target_path VARCHAR(512) DEFAULT NULL,
          referrer VARCHAR(512) DEFAULT NULL,
          user_agent VARCHAR(512) DEFAULT NULL,
          metadata_json JSON DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_public_signals_event_type (event_type),
          INDEX idx_public_signals_route_kind (route_kind),
          INDEX idx_public_signals_entity_type (entity_type),
          INDEX idx_public_signals_created_at (created_at)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS public_feedback (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          page_path VARCHAR(512) NOT NULL,
          route_kind VARCHAR(64) DEFAULT NULL,
          entity_type VARCHAR(64) DEFAULT NULL,
          entity_key VARCHAR(191) DEFAULT NULL,
          helpful TINYINT(1) NOT NULL,
          notes TEXT DEFAULT NULL,
          referrer VARCHAR(512) DEFAULT NULL,
          user_agent VARCHAR(512) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_public_feedback_entity_type (entity_type),
          INDEX idx_public_feedback_created_at (created_at)
        )
      `);
    })();
  }

  return ensureTablesPromise;
}

export async function recordPublicSignal({
  eventType,
  pagePath,
  routeKind = null,
  entityType = null,
  entityKey = null,
  targetPath = null,
  referrer = null,
  userAgent = null,
  metadata = null,
}) {
  await ensureTables();
  const db = getDb();

  await db.query(
    `
      INSERT INTO public_signals (
        event_type,
        page_path,
        route_kind,
        entity_type,
        entity_key,
        target_path,
        referrer,
        user_agent,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      eventType,
      pagePath,
      routeKind,
      entityType,
      entityKey,
      targetPath,
      referrer,
      userAgent,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export async function recordPublicFeedback({
  pagePath,
  routeKind = null,
  entityType = null,
  entityKey = null,
  helpful,
  notes = null,
  referrer = null,
  userAgent = null,
}) {
  await ensureTables();
  const db = getDb();

  await db.query(
    `
      INSERT INTO public_feedback (
        page_path,
        route_kind,
        entity_type,
        entity_key,
        helpful,
        notes,
        referrer,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      pagePath,
      routeKind,
      entityType,
      entityKey,
      helpful ? 1 : 0,
      notes,
      referrer,
      userAgent,
    ]
  );
}
