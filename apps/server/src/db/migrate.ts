import type { Client } from "@libsql/client";

import { loadConfig } from "../config.js";
import { createDatabaseConnection } from "./client.js";

const statements = [
  `CREATE TABLE IF NOT EXISTS monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      query TEXT NOT NULL,
      description TEXT,
      interval_minutes INTEGER NOT NULL,
      cooldown_minutes INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sources TEXT NOT NULL,
      notify_channels TEXT NOT NULL,
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
      created_at TEXT NOT NULL
    )`,
  `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      webhook_urls TEXT NOT NULL,
      email_to TEXT NOT NULL,
      smtp_host TEXT,
      smtp_port INTEGER,
      smtp_secure INTEGER NOT NULL DEFAULT 0,
      smtp_user TEXT,
      smtp_password TEXT,
      smtp_from TEXT,
      vapid_public_key TEXT,
      vapid_private_key TEXT,
      vapid_subject TEXT,
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
];

export async function migrateDatabase(client: Client): Promise<void> {
  for (const statement of statements) {
    await client.execute(statement);
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
