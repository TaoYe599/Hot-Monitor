import type {
  MonitorSourceConfig,
  NotificationChannel,
  VerificationEvidence,
} from "@hot-monitor/shared";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const monitorsTable = sqliteTable("monitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  query: text("query").notNull(),
  description: text("description"),
  intervalMinutes: integer("interval_minutes").notNull(),
  cooldownMinutes: integer("cooldown_minutes").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sources: text("sources", { mode: "json" })
    .$type<MonitorSourceConfig>()
    .notNull(),
  notifyChannels: text("notify_channels", { mode: "json" })
    .$type<NotificationChannel[]>()
    .notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  lastRunAt: text("last_run_at"),
});

export const eventsTable = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    monitorId: integer("monitor_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceType: text("source_type").notNull(),
    sourceLabel: text("source_label").notNull(),
    publishedAt: text("published_at"),
    authenticityScore: real("authenticity_score").notNull(),
    relevanceScore: real("relevance_score").notNull(),
    evidence: text("evidence", { mode: "json" })
      .$type<VerificationEvidence[]>()
      .notNull(),
    clusterId: integer("cluster_id"),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    monitorSourceIdx: uniqueIndex("events_monitor_source_url_idx").on(
      table.monitorId,
      table.sourceUrl,
    ),
  }),
);

export const hotspotsTable = sqliteTable("hotspots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  monitorId: integer("monitor_id").notNull(),
  label: text("label").notNull(),
  summary: text("summary").notNull(),
  score: real("score").notNull(),
  diversityScore: real("diversity_score").notNull(),
  freshnessScore: real("freshness_score").notNull(),
  engagementScore: real("engagement_score").notNull(),
  status: text("status").notNull(),
  supportingUrls: text("supporting_urls", { mode: "json" })
    .$type<string[]>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});

export const settingsTable = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  webhookUrls: text("webhook_urls", { mode: "json" }).$type<string[]>().notNull(),
  emailTo: text("email_to", { mode: "json" }).$type<string[]>().notNull(),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(false),
  smtpUser: text("smtp_user"),
  smtpPassword: text("smtp_password"),
  smtpFrom: text("smtp_from"),
  vapidPublicKey: text("vapid_public_key"),
  vapidPrivateKey: text("vapid_private_key"),
  vapidSubject: text("vapid_subject"),
  updatedAt: text("updated_at").notNull(),
});

export const pushSubscriptionsTable = sqliteTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    endpoint: text("endpoint").notNull(),
    auth: text("auth").notNull(),
    p256dh: text("p256dh").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    endpointIdx: uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
  }),
);

export const notificationLogsTable = sqliteTable("notification_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channel: text("channel").notNull(),
  target: text("target").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});
