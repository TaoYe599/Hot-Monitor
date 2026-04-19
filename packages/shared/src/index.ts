export type MonitorMode = "keyword" | "topic";

export type SourceKind =
  | "twitter"
  | "search"
  | "rss"
  | "github"
  | "manual";

export type NotificationChannel = "push" | "webhook" | "email";

export interface MonitorSourceConfig {
  twitter: boolean;
  search: boolean;
  rss: boolean;
  github: boolean;
}

export interface MonitorRecord {
  id: number;
  name: string;
  mode: MonitorMode;
  query: string;
  description: string | null;
  intervalMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
  sources: MonitorSourceConfig;
  notifyChannels: NotificationChannel[];
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
}

export interface SourceItem {
  id?: string;
  sourceKind: SourceKind;
  sourceLabel: string;
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  excerpt: string;
  content: string;
  engagementScore: number;
  trustScore: number;
  tags: string[];
  raw: Record<string, unknown>;
}

export interface VerificationEvidence {
  quote: string;
  reason: string;
}

export interface VerifiedEvent {
  id: number;
  monitorId: number;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceType: SourceKind;
  sourceLabel: string;
  publishedAt: string | null;
  authenticityScore: number;
  relevanceScore: number;
  evidence: VerificationEvidence[];
  clusterId: number | null;
  status: "accepted" | "rejected";
  reason: string;
  createdAt: string;
}

export interface HotspotCluster {
  id: number;
  monitorId: number;
  label: string;
  summary: string;
  score: number;
  diversityScore: number;
  freshnessScore: number;
  engagementScore: number;
  status: "notified" | "candidate";
  supportingUrls: string[];
  createdAt: string;
}

export interface SettingsRecord {
  id: number;
  webhookUrls: string[];
  emailTo: string[];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  vapidSubject: string | null;
  updatedAt: string;
}

export interface PushSubscriptionRecord {
  id: number;
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
  createdAt: string;
}

export interface DashboardSnapshot {
  monitors: MonitorRecord[];
  events: VerifiedEvent[];
  hotspots: HotspotCluster[];
  settings: SettingsRecord | null;
  stats: {
    activeMonitors: number;
    acceptedEvents: number;
    hotspots: number;
    lastEventAt: string | null;
  };
}

export interface VerifyKeywordInput {
  monitor: Pick<MonitorRecord, "name" | "query" | "mode">;
  candidate: SourceItem;
}

export interface VerifyKeywordOutput {
  isMatch: boolean;
  authenticityScore: number;
  relevanceScore: number;
  reason: string;
  summary: string;
  evidence: VerificationEvidence[];
}

export interface HotspotClusterInput {
  monitor: Pick<MonitorRecord, "name" | "query" | "mode">;
  candidates: SourceItem[];
}

export interface HotspotClusterOutput {
  label: string;
  summary: string;
  score: number;
  diversityScore: number;
  freshnessScore: number;
  engagementScore: number;
  shouldNotify: boolean;
  reason: string;
  supportingUrls: string[];
}

export interface MonitorFormInput {
  name: string;
  mode: MonitorMode;
  query: string;
  description?: string;
  intervalMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
  sources: MonitorSourceConfig;
  notifyChannels: NotificationChannel[];
}

export interface SettingsFormInput {
  webhookUrls: string[];
  emailTo: string[];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  vapidSubject: string | null;
}

export interface ScanSummary {
  monitorId: number;
  candidates: number;
  acceptedEvents: VerifiedEvent[];
  hotspots: HotspotCluster[];
}

export type ScanJobStatus = "queued" | "running" | "succeeded" | "failed";

export type ScanJobTrigger = "manual" | "scheduler";

export interface ScanJobRecord {
  id: string;
  monitorId: number;
  monitorName: string;
  trigger: ScanJobTrigger;
  status: ScanJobStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  summary: ScanSummary | null;
  error: string | null;
}

export const DEFAULT_SOURCE_CONFIG: MonitorSourceConfig = {
  twitter: true,
  search: true,
  rss: true,
  github: true,
};

export const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannel[] = [
  "push",
  "webhook",
  "email",
];
