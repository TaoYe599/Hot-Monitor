import type { Client } from "@libsql/client";

import { loadConfig } from "../config.js";
import { createDatabaseConnection } from "./client.js";

const statements = [
  `CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      description TEXT,
      interval_minutes INTEGER NOT NULL,
      cooldown_minutes INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sources TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_at TEXT
    )`,
  `CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_label TEXT NOT NULL,
      published_at TEXT,
      authenticity_score REAL NOT NULL,
      relevance_score REAL NOT NULL,
      evidence TEXT NOT NULL,
      cluster_id INTEGER,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS events_monitor_source_url_idx ON events (monitor_id, source_url)",
  `CREATE TABLE IF NOT EXISTS hotspots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monitor_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      summary TEXT NOT NULL,
      score REAL NOT NULL,
      diversity_score REAL NOT NULL,
      freshness_score REAL NOT NULL,
      engagement_score REAL NOT NULL,
      status TEXT NOT NULL,
      supporting_urls TEXT NOT NULL,
      is_heuristic INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      email_to TEXT NOT NULL,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_secure INTEGER NOT NULL DEFAULT 0,
      smtp_user TEXT,
      smtp_password TEXT,
      smtp_from TEXT,
      event_retention_days INTEGER NOT NULL DEFAULT 30,
      hotspot_retention_days INTEGER NOT NULL DEFAULT 90,
      updated_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      auth TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_idx ON push_subscriptions (endpoint)",
  `CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      target TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS subscription_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      monitor_ids TEXT,
      include_keywords TEXT NOT NULL,
      and_keywords TEXT NOT NULL,
      exclude_keywords TEXT NOT NULL,
      min_score REAL NOT NULL DEFAULT 0.7,
      min_trust_score REAL NOT NULL DEFAULT 0.55,
      min_supporting_sources INTEGER NOT NULL DEFAULT 1,
      delivery_frequency TEXT NOT NULL DEFAULT 'instant',
      delivery_time TEXT,
      prefetch_minutes INTEGER,
      recipients TEXT NOT NULL,
      last_dispatched_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS subscription_cooldowns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      hotspot_id INTEGER NOT NULL,
      last_notified_at TEXT NOT NULL,
      score REAL NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS subscription_silent_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      hotspot_id INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS digest_sent_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_id INTEGER NOT NULL,
      hotspot_id INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS digest_sent_sources_rule_source_sent_idx ON digest_sent_sources (rule_id, source_url, sent_at)"
];

export async function migrateDatabase(client: Client): Promise<void> {
  // Run table creation statements first
  for (const statement of statements) {
    await client.execute(statement);
  }

  // Migration: Add reddit to existing monitors' sources
  try {
    const monitors = await client.execute("SELECT id, sources FROM monitors");
    for (const monitor of monitors.rows ?? []) {
      const sources = JSON.parse(String(monitor.sources));
      if (!("reddit" in sources)) {
        sources.reddit = true;
        await client.execute({
          sql: "UPDATE monitors SET sources = ? WHERE id = ?",
          args: [JSON.stringify(sources), monitor.id],
        });
        console.info(`[migration] Added reddit to monitor ${monitor.id}`);
      }
    }
  } catch (err) {
    console.warn(`[migration] Failed to add reddit to monitors: ${err}`);
  }

  // Migration: Add new columns to events table
  const eventColumns = [
    { name: "original_excerpt", sql: "ALTER TABLE events ADD COLUMN original_excerpt TEXT" },
    { name: "author", sql: "ALTER TABLE events ADD COLUMN author TEXT" },
    { name: "engagement_details", sql: "ALTER TABLE events ADD COLUMN engagement_details TEXT" },
    { name: "is_read", sql: "ALTER TABLE events ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0" },
  ];

  for (const col of eventColumns) {
    try {
      // Check if column exists
      const existing = await client.execute(`PRAGMA table_info(events)`);
      const hasColumn = existing.rows?.some((row: Record<string, unknown>) => row.name === col.name);
      if (!hasColumn) {
        await client.execute(col.sql);
        console.info(`[migration] Added column ${col.name} to events table`);
      }
    } catch (err) {
      console.warn(`[migration] Failed to add column ${col.name}: ${err}`);
    }
  }

  // Migration: Add new columns to hotspots table
  const hotspotColumns = [
    { name: "reason", sql: "ALTER TABLE hotspots ADD COLUMN reason TEXT" },
    { name: "engagement_aggregates", sql: "ALTER TABLE hotspots ADD COLUMN engagement_aggregates TEXT" },
    { name: "earliest_published_at", sql: "ALTER TABLE hotspots ADD COLUMN earliest_published_at TEXT" },
    { name: "latest_published_at", sql: "ALTER TABLE hotspots ADD COLUMN latest_published_at TEXT" },
    { name: "is_heuristic", sql: "ALTER TABLE hotspots ADD COLUMN is_heuristic INTEGER NOT NULL DEFAULT 0" },
  ];

  for (const col of hotspotColumns) {
    try {
      const existing = await client.execute(`PRAGMA table_info(hotspots)`);
      const hasColumn = existing.rows?.some((row: Record<string, unknown>) => row.name === col.name);
      if (!hasColumn) {
        await client.execute(col.sql);
        console.info(`[migration] Added column ${col.name} to hotspots table`);
      }
    } catch (err) {
      console.warn(`[migration] Failed to add column ${col.name}: ${err}`);
    }
  }

  // Migration: Add new columns to settings table
  const settingsColumns = [
    { name: "event_retention_days", sql: "ALTER TABLE settings ADD COLUMN event_retention_days INTEGER NOT NULL DEFAULT 30" },
    { name: "hotspot_retention_days", sql: "ALTER TABLE settings ADD COLUMN hotspot_retention_days INTEGER NOT NULL DEFAULT 90" },
  ];
  for (const col of settingsColumns) {
    try {
      const existing = await client.execute(`PRAGMA table_info(settings)`);
      const hasColumn = existing.rows?.some((row: Record<string, unknown>) => row.name === col.name);
      if (!hasColumn) {
        await client.execute(col.sql);
        console.info(`[migration] Added column ${col.name} to settings table`);
      }
    } catch (err) {
      console.warn(`[migration] Failed to add column ${col.name}: ${err}`);
    }
  }

  // Migration: Add new columns to subscription_rules table
  try {
    const existing = await client.execute(`PRAGMA table_info(subscription_rules)`);
    const hasColumn = existing.rows?.some((row: Record<string, unknown>) => row.name === "prefetch_minutes");
    if (!hasColumn) {
      await client.execute("ALTER TABLE subscription_rules ADD COLUMN prefetch_minutes INTEGER");
      console.info(`[migration] Added column prefetch_minutes to subscription_rules table`);
    }
  } catch (err) {
    console.warn(`[migration] Failed to add column prefetch_minutes: ${err}`);
  }

  // Migration: Drop removed columns from monitors table
  const dropMonitorColumns = ["mode", "notify_channels"];
  for (const col of dropMonitorColumns) {
    try {
      const existing = await client.execute(`PRAGMA table_info(monitors)`);
      const hasColumn = existing.rows?.some((row: Record<string, unknown>) => row.name === col);
      if (hasColumn) {
        await client.execute(`ALTER TABLE monitors DROP COLUMN ${col}`);
        console.info(`[migration] Dropped column ${col} from monitors table`);
      }
    } catch (err) {
      console.warn(`[migration] Failed to drop column ${col} from monitors: ${err}`);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  void (async () => {
    const config = loadConfig();
    const { client } = createDatabaseConnection(config.databasePath);
    await migrateDatabase(client);
    client.close();
  })();
}
