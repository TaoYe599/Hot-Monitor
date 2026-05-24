
export type SourceKind =
  | "twitter"
  | "search"
  | "google"
  | "rss"
  | "github"
  | "hackernews"
  | "zhihu"
  | "baidu"
  | "weibo"
  | "reddit"
  | "manual";

export type NotificationChannel = "email";

export interface MonitorSourceConfig {
  twitter: boolean;
  search: boolean;
  rss: boolean;
  github: boolean;
  hackernews: boolean;
  zhihu: boolean;
  baidu: boolean;
  weibo: boolean;
  reddit: boolean;
}

export interface MonitorRecord {
  id: number;
  name: string;
  query: string;
  description: string | null;
  intervalMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
  sources: MonitorSourceConfig;
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
  engagementDetails?: EngagementDetails | null;
  existingEvent?: { id: number };
}

export interface VerificationEvidence {
  quote: string;
  reason: string;
}

// 各平台详细互动数据
export interface EngagementDetails {
  // Twitter/X 特有
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  // Hacker News 特有
  points?: number;
  // Reddit 特有
  upvotes?: number;
  downvotes?: number;
  score?: number;
  // 通用
  comments?: number;
}

export interface VerifiedEvent {
  id: number;
  monitorId: number;
  title: string;
  summary: string;
  originalExcerpt: string | null;
  sourceUrl: string;
  sourceType: SourceKind;
  sourceLabel: string;
  author: string | null;
  publishedAt: string | null;
  authenticityScore: number;
  relevanceScore: number;
  evidence: VerificationEvidence[];
  clusterId: number | null;
  status: "accepted" | "rejected";
  reason: string;
  engagementDetails: EngagementDetails | null;
  isRead: boolean;
  createdAt: string;
}

// 热点互动数据聚合（从多个来源聚合）
export interface HotspotEngagementAggregates {
  totalLikes?: number;
  totalRetweets?: number;
  totalReplies?: number;
  totalViews?: number;
  totalPoints?: number;
  totalUpvotes?: number;
  totalDownvotes?: number;
  totalComments?: number;
  totalScore?: number;
  maxLikes?: number;
  maxRetweets?: number;
  maxViews?: number;
  maxComments?: number;
}

export interface HotspotEventSummary {
  id: number;
  title: string;
  sourceUrl: string;
  sourceType: SourceKind;
  sourceLabel: string;
  author: string | null;
  publishedAt: string | null;
  authenticityScore: number;
  relevanceScore: number;
  engagementDetails?: EngagementDetails | null;
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
  reason?: string;
  // 互动数据聚合
  engagementAggregates?: HotspotEngagementAggregates | null;
  // 原始来源中的最早/最新发布时间
  earliestPublishedAt?: string | null;
  latestPublishedAt?: string | null;
  // AI 服务降级标记（Heuristic 模式生成时为 true）
  isHeuristic?: boolean;
  createdAt: string;
}

export interface SettingsRecord {
  id: number;
  emailTo: string[];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  eventRetentionDays: number;
  hotspotRetentionDays: number;
  updatedAt: string;
}

export interface SubscriptionRuleRecord {
  id: number;
  name: string;
  enabled: boolean;
  monitorIds: number[] | null;
  includeKeywords: string[];
  andKeywords: string[];
  excludeKeywords: string[];
  minScore: number;
  minTrustScore: number;
  minSupportingSources: number;
  deliveryFrequency: "instant" | "daily" | "weekly";
  deliveryTime: string | null;
  prefetchMinutes: number | null;
  recipients: string[];
  lastDispatchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRuleInput {
  name: string;
  enabled: boolean;
  monitorIds: number[] | null;
  includeKeywords: string[];
  andKeywords: string[];
  excludeKeywords: string[];
  minScore: number;
  minTrustScore: number;
  minSupportingSources: number;
  deliveryFrequency: "instant" | "daily" | "weekly";
  deliveryTime: string | null;
  prefetchMinutes: number | null;
  recipients: string[];
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  deliveryRate: number;
  noiseRatio: number;
  irrelevantCount: number;
  relevantCount: number;
  dailyStats: {
    date: string;
    sent: number;
    failed: number;
    deliveryRate: number;
  }[];
}

export interface DashboardSnapshot {
  monitors: MonitorRecord[];
  events: VerifiedEvent[];
  hotspots: HotspotCluster[];
  settings: SettingsRecord | null;
  subscriptionRules: SubscriptionRuleRecord[];
  stats: {
    activeMonitors: number;
    acceptedEvents: number;
    hotspots: number;
    lastEventAt: string | null;
  };
}


export interface VerifyKeywordInput {
  monitor: Pick<MonitorRecord, "name" | "query">;
  candidate: SourceItem;
}

export type MatchType = "direct" | "semantic" | "indirect";

export interface VerifyKeywordOutput {
  isMatch: boolean;
  authenticityScore: number;
  relevanceScore: number;
  matchType?: MatchType;
  reason: string;
  summary: string;
  evidence: VerificationEvidence[];
}

export interface HotspotClusterInput {
  monitor: Pick<MonitorRecord, "name" | "query">;
  candidates: SourceItem[];
  reason?: string;
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
  // AI 服务降级标记
  isHeuristic?: boolean;
}

export interface MonitorFormInput {
  name: string;
  query: string;
  description?: string;
  intervalMinutes: number;
  cooldownMinutes: number;
  enabled: boolean;
  sources: MonitorSourceConfig;
}

export interface SettingsFormInput {
  emailTo: string[];
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  eventRetentionDays: number;
  hotspotRetentionDays: number;
}

export interface ScanSummary {
  monitorId: number;
  candidates: number;
  preFilteredCount: number;
  filteredCount: number;
  acceptedEvents: VerifiedEvent[];
  hotspots: HotspotCluster[];
}

export type ScanJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

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
  hackernews: true,
  zhihu: true,
  baidu: true,
  weibo: true,
  reddit: true,
};


// ============== 排序和筛选类型 ==============

export type EventSortField =
  | "createdAt"
  | "authenticityScore"
  | "relevanceScore"
  | "combinedScore"
  | "sourceType";

export type EventSortOrder = "asc" | "desc";

export interface EventFilter {
  monitorId?: number;
  sourceTypes?: SourceKind[];
  minAuthenticityScore?: number;
  minRelevanceScore?: number;
  status?: VerifiedEvent["status"];
  timeRange?: "today" | "week" | "month" | "custom";
  timeFrom?: string;
  timeTo?: string;
}

export interface EventSortConfig {
  field: EventSortField;
  order: EventSortOrder;
}

export type HotspotSortField =
  | "createdAt"
  | "score"
  | "diversityScore"
  | "freshnessScore"
  | "engagementScore"
  | "coverage";

export type HotspotSortOrder = "asc" | "desc";

export interface HotspotFilter {
  monitorId?: number;
  minScore?: number;
  minCoverage?: number;
  timeRange?: "today" | "week" | "month" | "custom";
  timeFrom?: string;
  timeTo?: string;
}

export interface HotspotSortConfig {
  field: HotspotSortField;
  order: HotspotSortOrder;
}

export interface EventsQueryParams {
  sort?: EventSortConfig;
  filter?: EventFilter;
  limit?: number;
}

export interface HotspotsQueryParams {
  sort?: HotspotSortConfig;
  filter?: HotspotFilter;
  limit?: number;
  offset?: number;
}

export interface HotspotsResponse {
  hotspots: (HotspotCluster & { events: HotspotEventSummary[] })[];
  total: number;
}
