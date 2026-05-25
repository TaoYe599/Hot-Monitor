import type {
  DashboardSnapshot,
  EngagementDetails,
  EventFilter,
  EventSortConfig,
  HotspotEngagementAggregates,
  HotspotEventSummary,
  HotspotFilter,
  HotspotSortConfig,
  HotspotCluster,
  MonitorFormInput,
  MonitorRecord,
  SettingsFormInput,
  SettingsRecord,
  SourceKind,
  VerifiedEvent,
  SubscriptionRuleRecord,
  SubscriptionRuleInput,
} from "@hot-monitor/shared";
import {
  DEFAULT_SOURCE_CONFIG,
} from "@hot-monitor/shared";
import { and, desc, eq, gte, lte, or, inArray, sql } from "drizzle-orm";

import type { AppConfig } from "../config.js";
import { nowIso } from "../lib/utils.js";
import {
  eventsTable,
  hotspotsTable,
  monitorsTable,
  notificationLogsTable,
  settingsTable,
  subscriptionRulesTable,
  subscriptionCooldownsTable,
  subscriptionSilentQueueTable,
} from "../db/schema.js";

type DbClient = ReturnType<
  typeof import("drizzle-orm/libsql").drizzle
>;

export class Repository {
  constructor(
    private readonly db: DbClient,
    private readonly config: AppConfig,
  ) {}

  async listMonitors(): Promise<MonitorRecord[]> {
    // 切换排序为按主键 ID 降序排序，保证新创建的任务在最上方，且卡片位置不会因启用状态更新（修改 updatedAt）而改变
    const result = await this.db.select().from(monitorsTable).orderBy(desc(monitorsTable.id));
    return result.map((monitor) => this.asMonitorRecord(monitor));
  }

  async getMonitor(id: number): Promise<MonitorRecord | undefined> {
    const result = await this.db
      .select()
      .from(monitorsTable)
      .where(eq(monitorsTable.id, id))
      .limit(1);
    return result[0] ? this.asMonitorRecord(result[0]) : undefined;
  }

  async createMonitor(input: MonitorFormInput): Promise<MonitorRecord> {
    const createdAt = nowIso();
    const result = await this.db
      .insert(monitorsTable)
      .values({
        name: input.name,
        query: input.query,
        description: input.description ?? null,
        intervalMinutes: input.intervalMinutes,
        cooldownMinutes: input.cooldownMinutes,
        enabled: input.enabled,
        sources: input.sources,
        createdAt,
        updatedAt: createdAt,
        lastRunAt: null,
      })
      .returning();
    return this.asMonitorRecord(result[0]);
  }

  async updateMonitor(
    id: number,
    patch: Partial<MonitorFormInput>,
  ): Promise<MonitorRecord | undefined> {
    const payload: Partial<typeof monitorsTable.$inferInsert> = {
      updatedAt: nowIso(),
    };

    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.query !== undefined) payload.query = patch.query;
    if (patch.description !== undefined) payload.description = patch.description ?? null;
    if (patch.intervalMinutes !== undefined) payload.intervalMinutes = patch.intervalMinutes;
    if (patch.cooldownMinutes !== undefined) payload.cooldownMinutes = patch.cooldownMinutes;
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.sources !== undefined) payload.sources = patch.sources;

    const result = await this.db
      .update(monitorsTable)
      .set(payload)
      .where(eq(monitorsTable.id, id))
      .returning();
    return result[0] ? this.asMonitorRecord(result[0]) : undefined;
  }

  async markMonitorRun(id: number): Promise<void> {
    await this.db
      .update(monitorsTable)
      .set({
        lastRunAt: nowIso(),
        updatedAt: nowIso(),
      })
      .where(eq(monitorsTable.id, id));
  }

  async deleteMonitor(id: number): Promise<boolean> {
    const monitor = await this.getMonitor(id);
    if (!monitor) {
      return false;
    }

    await this.db.delete(eventsTable).where(eq(eventsTable.monitorId, id));
    await this.db.delete(monitorsTable).where(eq(monitorsTable.id, id));
    return true;
  }

  async listEvents(
    limit = 40,
    sort?: EventSortConfig,
    filter?: EventFilter,
  ): Promise<VerifiedEvent[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (filter?.monitorId !== undefined) {
      conditions.push(eq(eventsTable.monitorId, filter.monitorId));
    }

    if (filter?.sourceTypes && filter.sourceTypes.length > 0) {
      conditions.push(inArray(eventsTable.sourceType, filter.sourceTypes));
    }

    if (filter?.minAuthenticityScore !== undefined) {
      conditions.push(gte(eventsTable.authenticityScore, filter.minAuthenticityScore));
    }

    if (filter?.minRelevanceScore !== undefined) {
      conditions.push(gte(eventsTable.relevanceScore, filter.minRelevanceScore));
    }

    if (filter?.status) {
      conditions.push(eq(eventsTable.status, filter.status));
    }

    if (filter?.timeRange || filter?.timeFrom || filter?.timeTo) {
      const now = new Date();
      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      switch (filter.timeRange) {
        case "today": {
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          toDate = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        }
        case "week": {
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case "month": {
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
        case "custom": {
          if (filter.timeFrom) fromDate = new Date(filter.timeFrom);
          if (filter.timeTo) toDate = new Date(filter.timeTo);
          break;
        }
      }

      if (fromDate) {
        conditions.push(gte(eventsTable.createdAt, fromDate.toISOString()));
      }
      if (toDate) {
        conditions.push(lte(eventsTable.createdAt, toDate.toISOString()));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 构建排序字段 - 使用原始列名避免表名前缀问题
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderField: any;
    if (sort) {
      const { field, order } = sort;
      const direction = order === "asc" ? "asc" : "desc";
      switch (field) {
        case "createdAt":
          orderField = direction === "asc" ? sql`created_at asc` : sql`created_at desc`;
          break;
        case "authenticityScore":
          orderField = direction === "asc" ? sql`authenticity_score asc` : sql`authenticity_score desc`;
          break;
        case "relevanceScore":
          orderField = direction === "asc" ? sql`relevance_score asc` : sql`relevance_score desc`;
          break;
        case "combinedScore":
          orderField = direction === "asc"
            ? sql`authenticity_score * relevance_score asc`
            : sql`authenticity_score * relevance_score desc`;
          break;
        case "sourceType":
          orderField = direction === "asc" ? sql`source_type asc` : sql`source_type desc`;
          break;
        default:
          orderField = sql`created_at desc`;
      }
    } else {
      orderField = sql`created_at desc`;
    }

    const result = await this.db
      .select()
      .from(eventsTable)
      .where(whereClause)
      .orderBy(orderField)
      .limit(limit);

    return result.map((event) => this.asVerifiedEvent(event));
  }

  async listHotspots(
    limit = 30,
    sort?: HotspotSortConfig,
    filter?: HotspotFilter,
    offset = 0,
  ): Promise<{ hotspots: HotspotCluster[]; total: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (filter?.monitorId !== undefined) {
      conditions.push(eq(hotspotsTable.monitorId, filter.monitorId));
    }

    if (filter?.minScore !== undefined) {
      conditions.push(gte(hotspotsTable.score, filter.minScore));
    }

    if (filter?.timeRange || filter?.timeFrom || filter?.timeTo) {
      const now = new Date();
      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      switch (filter.timeRange) {
        case "today": {
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          toDate = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
          break;
        }
        case "week": {
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        }
        case "month": {
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        }
        case "custom": {
          if (filter.timeFrom) fromDate = new Date(filter.timeFrom);
          if (filter.timeTo) toDate = new Date(filter.timeTo);
          break;
        }
      }

      if (fromDate) {
        conditions.push(gte(hotspotsTable.createdAt, fromDate.toISOString()));
      }
      if (toDate) {
        conditions.push(lte(hotspotsTable.createdAt, toDate.toISOString()));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(hotspotsTable)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    // 构建排序字段 - 使用原始列名避免表名前缀问题
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderField: any;
    if (sort) {
      const { field, order } = sort;
      const direction = order === "asc" ? "asc" : "desc";
      switch (field) {
        case "createdAt":
          orderField = direction === "asc" ? sql`created_at asc` : sql`created_at desc`;
          break;
        case "score":
          orderField = direction === "asc" ? sql`score asc` : sql`score desc`;
          break;
        case "diversityScore":
          orderField = direction === "asc" ? sql`diversity_score asc` : sql`diversity_score desc`;
          break;
        case "freshnessScore":
          orderField = direction === "asc" ? sql`freshness_score asc` : sql`freshness_score desc`;
          break;
        case "engagementScore":
          orderField = direction === "asc" ? sql`engagement_score asc` : sql`engagement_score desc`;
          break;
        case "coverage":
          orderField = direction === "asc"
            ? sql`json_array_length(supporting_urls) asc`
            : sql`json_array_length(supporting_urls) desc`;
          break;
        default:
          orderField = sql`created_at desc`;
      }
    } else {
      orderField = sql`created_at desc`;
    }

    const result = await this.db
      .select()
      .from(hotspotsTable)
      .where(whereClause)
      .orderBy(orderField)
      .limit(limit)
      .offset(offset);

    return {
      hotspots: result.map((hotspot) => this.asHotspotCluster(hotspot)),
      total,
    };
  }

  async getEventsByClusterId(clusterId: number): Promise<HotspotEventSummary[]> {
    const result = await this.db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        sourceUrl: eventsTable.sourceUrl,
        sourceType: eventsTable.sourceType,
        sourceLabel: eventsTable.sourceLabel,
        author: eventsTable.author,
        publishedAt: eventsTable.publishedAt,
        authenticityScore: eventsTable.authenticityScore,
        relevanceScore: eventsTable.relevanceScore,
        engagementDetails: eventsTable.engagementDetails,
      })
      .from(eventsTable)
      .where(eq(eventsTable.clusterId, clusterId))
      .orderBy(desc(eventsTable.createdAt));

    return result.map((event) => ({
      id: event.id,
      title: event.title,
      sourceUrl: event.sourceUrl,
      sourceType: event.sourceType as SourceKind,
      sourceLabel: event.sourceLabel,
      author: event.author,
      publishedAt: event.publishedAt,
      authenticityScore: event.authenticityScore,
      relevanceScore: event.relevanceScore,
      engagementDetails: event.engagementDetails as EngagementDetails | null,
    }));
  }

  async getExistingEvent(monitorId: number, sourceUrl: string): Promise<VerifiedEvent | undefined> {
    const result = await this.db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.monitorId, monitorId), eq(eventsTable.sourceUrl, sourceUrl)))
      .limit(1);
    return result[0] ? this.asVerifiedEvent(result[0]) : undefined;
  }

  async createEvent(
    event: Omit<VerifiedEvent, "id" | "createdAt">,
  ): Promise<VerifiedEvent> {
    const result = await this.db
      .insert(eventsTable)
      .values({
        monitorId: event.monitorId,
        title: event.title,
        summary: event.summary,
        originalExcerpt: event.originalExcerpt,
        sourceUrl: event.sourceUrl,
        sourceType: event.sourceType,
        sourceLabel: event.sourceLabel,
        author: event.author,
        publishedAt: event.publishedAt,
        authenticityScore: event.authenticityScore,
        relevanceScore: event.relevanceScore,
        evidence: event.evidence,
        clusterId: event.clusterId,
        status: event.status,
        reason: event.reason,
        engagementDetails: event.engagementDetails,
        isRead: event.isRead,
        createdAt: nowIso(),
      })
      .returning();
    return this.asVerifiedEvent(result[0]);
  }

  async createHotspot(input: typeof hotspotsTable.$inferInsert): Promise<HotspotCluster> {
    const result = await this.db.insert(hotspotsTable).values(input).returning();
    return this.asHotspotCluster(result[0]);
  }

  async updateEventsClusterId(eventIds: number[], clusterId: number): Promise<void> {
    if (eventIds.length === 0) return;
    await this.db
      .update(eventsTable)
      .set({ clusterId })
      .where(inArray(eventsTable.id, eventIds));
  }

  async batchMarkEventsRead(eventIds: number[]): Promise<number> {
    if (eventIds.length === 0) return 0;
    const result = await this.db
      .update(eventsTable)
      .set({ isRead: true })
      .where(inArray(eventsTable.id, eventIds));
    return eventIds.length;
  }

  async batchDeleteEvents(eventIds: number[]): Promise<number> {
    if (eventIds.length === 0) return 0;
    const result = await this.db
      .delete(eventsTable)
      .where(inArray(eventsTable.id, eventIds));
    return eventIds.length;
  }

  async getSettings(): Promise<SettingsRecord> {
    const result = await this.db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, 1))
      .limit(1);

    const existing = result[0];
    if (existing) {
      return existing;
    }

    const seeded = await this.db
      .insert(settingsTable)
      .values({
        id: 1,
        emailTo: this.config.emailTo,
        smtpHost: this.config.smtp.host ?? null,
        smtpPort: this.config.smtp.port ?? null,
        smtpSecure: this.config.smtp.secure,
        smtpUser: this.config.smtp.user ?? null,
        smtpPassword: this.config.smtp.password ?? null,
        smtpFrom: this.config.smtp.from ?? null,
        eventRetentionDays: 30,
        hotspotRetentionDays: 90,
        updatedAt: nowIso(),
      })
      .returning();

    return seeded[0];
  }

  async updateSettings(input: SettingsFormInput): Promise<SettingsRecord> {
    const result = await this.db
      .update(settingsTable)
      .set({
        emailTo: input.emailTo,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpSecure: input.smtpSecure,
        smtpUser: input.smtpUser,
        smtpPassword: input.smtpPassword,
        smtpFrom: input.smtpFrom,
        eventRetentionDays: input.eventRetentionDays,
        hotspotRetentionDays: input.hotspotRetentionDays,
        updatedAt: nowIso(),
      })
      .where(eq(settingsTable.id, 1))
      .returning();

    return result[0];
  }

  async logNotification(params: {
    channel: "email";
    target: string;
    payload: Record<string, unknown>;
    status: "sent" | "failed";
    error?: string;
  }): Promise<void> {
    await this.db.insert(notificationLogsTable).values({
      channel: params.channel,
      target: params.target,
      payload: params.payload,
      status: params.status,
      error: params.error ?? null,
      createdAt: nowIso(),
    });
  }

  async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    const [monitors, events, hotspotsResult, settings, subscriptionRules] = await Promise.all([
      this.listMonitors(),
      this.listEvents(12),
      this.listHotspots(8),
      this.getSettings(),
      this.listSubscriptionRules(),
    ]);

    // 为热点添加事件摘要
    const hotspotsWithEvents = await Promise.all(
      hotspotsResult.hotspots.map(async (hotspot) => {
        const events = await this.getEventsByClusterId(hotspot.id);
        return { ...hotspot, events };
      }),
    );

    return {
      monitors,
      events,
      hotspots: hotspotsWithEvents,
      settings,
      subscriptionRules,
      stats: {
        activeMonitors: monitors.filter((monitor) => monitor.enabled).length,
        acceptedEvents: events.filter((event) => event.status === "accepted").length,
        hotspots: hotspotsResult.total,
        lastEventAt: events[0]?.createdAt ?? null,
      },
    };
  }

  createDefaultMonitorInput(): MonitorFormInput {
    return {
      name: "",
      query: "",
      intervalMinutes: 15,
      cooldownMinutes: 60,
      enabled: true,
      sources: DEFAULT_SOURCE_CONFIG,
    };
  }

  private asMonitorRecord(row: typeof monitorsTable.$inferSelect): MonitorRecord {
    const sources = {
      ...DEFAULT_SOURCE_CONFIG,
      ...row.sources,
    };
    return {
      ...row,
      sources,
    };
  }

  private asVerifiedEvent(row: typeof eventsTable.$inferSelect): VerifiedEvent {
    return {
      id: row.id,
      monitorId: row.monitorId,
      title: row.title,
      summary: row.summary,
      originalExcerpt: row.originalExcerpt,
      sourceUrl: row.sourceUrl,
      sourceType: row.sourceType as SourceKind,
      sourceLabel: row.sourceLabel,
      author: row.author,
      publishedAt: row.publishedAt,
      authenticityScore: row.authenticityScore,
      relevanceScore: row.relevanceScore,
      evidence: row.evidence,
      clusterId: row.clusterId,
      status: row.status as VerifiedEvent["status"],
      reason: row.reason,
      engagementDetails: row.engagementDetails as EngagementDetails | null,
      isRead: row.isRead,
      createdAt: row.createdAt,
    };
  }

  private asHotspotCluster(row: typeof hotspotsTable.$inferSelect): HotspotCluster {
    return {
      id: row.id,
      monitorId: row.monitorId,
      label: row.label,
      summary: row.summary,
      score: row.score,
      diversityScore: row.diversityScore,
      freshnessScore: row.freshnessScore,
      engagementScore: row.engagementScore,
      status: row.status as HotspotCluster["status"],
      supportingUrls: row.supportingUrls,
      reason: row.reason ?? undefined,
      engagementAggregates: row.engagementAggregates as HotspotEngagementAggregates | null,
      earliestPublishedAt: row.earliestPublishedAt,
      latestPublishedAt: row.latestPublishedAt,
      isHeuristic: row.isHeuristic ?? false,
      createdAt: row.createdAt,
    };
  }

  async listSubscriptionRules(): Promise<SubscriptionRuleRecord[]> {
    const result = await this.db
      .select()
      .from(subscriptionRulesTable)
      .orderBy(desc(subscriptionRulesTable.createdAt));
    return result.map((row) => this.asSubscriptionRuleRecord(row));
  }

  async getSubscriptionRule(id: number): Promise<SubscriptionRuleRecord | undefined> {
    const result = await this.db
      .select()
      .from(subscriptionRulesTable)
      .where(eq(subscriptionRulesTable.id, id))
      .limit(1);
    return result[0] ? this.asSubscriptionRuleRecord(result[0]) : undefined;
  }

  async createSubscriptionRule(input: SubscriptionRuleInput): Promise<SubscriptionRuleRecord> {
    const createdAt = nowIso();
    const result = await this.db
      .insert(subscriptionRulesTable)
      .values({
        name: input.name,
        enabled: input.enabled,
        monitorIds: input.monitorIds,
        includeKeywords: input.includeKeywords,
        andKeywords: input.andKeywords,
        excludeKeywords: input.excludeKeywords,
        minScore: input.minScore,
        minTrustScore: input.minTrustScore,
        minSupportingSources: input.minSupportingSources,
        deliveryFrequency: input.deliveryFrequency,
        deliveryTime: input.deliveryTime,
        prefetchMinutes: input.prefetchMinutes,
        recipients: input.recipients,
        lastDispatchedAt: null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    return this.asSubscriptionRuleRecord(result[0]);
  }

  async updateSubscriptionRule(
    id: number,
    patch: Partial<SubscriptionRuleInput> & { lastDispatchedAt?: string | null },
  ): Promise<SubscriptionRuleRecord | undefined> {
    const payload: Partial<typeof subscriptionRulesTable.$inferInsert> = {};

    // 只有当用户确实修改了配置项时，才刷新规则的配置更新时间 updatedAt，避免被系统后台投递时间标记更新操作污染覆盖
    const hasConfigChanges = patch.name !== undefined ||
      patch.enabled !== undefined ||
      patch.monitorIds !== undefined ||
      patch.includeKeywords !== undefined ||
      patch.andKeywords !== undefined ||
      patch.excludeKeywords !== undefined ||
      patch.minScore !== undefined ||
      patch.minTrustScore !== undefined ||
      patch.minSupportingSources !== undefined ||
      patch.deliveryFrequency !== undefined ||
      patch.deliveryTime !== undefined ||
      patch.prefetchMinutes !== undefined ||
      patch.recipients !== undefined;

    if (hasConfigChanges) {
      payload.updatedAt = nowIso();
    }

    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.monitorIds !== undefined) payload.monitorIds = patch.monitorIds;
    if (patch.includeKeywords !== undefined) payload.includeKeywords = patch.includeKeywords;
    if (patch.andKeywords !== undefined) payload.andKeywords = patch.andKeywords;
    if (patch.excludeKeywords !== undefined) payload.excludeKeywords = patch.excludeKeywords;
    if (patch.minScore !== undefined) payload.minScore = patch.minScore;
    if (patch.minTrustScore !== undefined) payload.minTrustScore = patch.minTrustScore;
    if (patch.minSupportingSources !== undefined) payload.minSupportingSources = patch.minSupportingSources;
    if (patch.deliveryFrequency !== undefined) payload.deliveryFrequency = patch.deliveryFrequency;
    if (patch.deliveryTime !== undefined) payload.deliveryTime = patch.deliveryTime;
    if (patch.prefetchMinutes !== undefined) payload.prefetchMinutes = patch.prefetchMinutes;
    if (patch.recipients !== undefined) payload.recipients = patch.recipients;
    if (patch.lastDispatchedAt !== undefined) payload.lastDispatchedAt = patch.lastDispatchedAt;

    const result = await this.db
      .update(subscriptionRulesTable)
      .set(payload)
      .where(eq(subscriptionRulesTable.id, id))
      .returning();
    return result[0] ? this.asSubscriptionRuleRecord(result[0]) : undefined;
  }

  async deleteSubscriptionRule(id: number): Promise<boolean> {
    const existing = await this.getSubscriptionRule(id);
    if (!existing) return false;
    await this.db.delete(subscriptionRulesTable).where(eq(subscriptionRulesTable.id, id));
    await this.db.delete(subscriptionCooldownsTable).where(eq(subscriptionCooldownsTable.ruleId, id));
    await this.db.delete(subscriptionSilentQueueTable).where(eq(subscriptionSilentQueueTable.ruleId, id));
    return true;
  }

  // Cooldown 操作
  async getSubscriptionCooldown(ruleId: number, hotspotId: number) {
    const result = await this.db
      .select()
      .from(subscriptionCooldownsTable)
      .where(
        and(
          eq(subscriptionCooldownsTable.ruleId, ruleId),
          eq(subscriptionCooldownsTable.hotspotId, hotspotId),
        ),
      )
      .limit(1);
    return result[0];
  }

  async setSubscriptionCooldown(ruleId: number, hotspotId: number, score: number) {
    const createdAt = nowIso();
    await this.db.insert(subscriptionCooldownsTable).values({
      ruleId,
      hotspotId,
      lastNotifiedAt: createdAt,
      score,
      createdAt,
    });
  }

  async updateSubscriptionCooldown(ruleId: number, hotspotId: number, score: number) {
    const updatedAt = nowIso();
    await this.db
      .update(subscriptionCooldownsTable)
      .set({
        lastNotifiedAt: updatedAt,
        score,
      })
      .where(
        and(
          eq(subscriptionCooldownsTable.ruleId, ruleId),
          eq(subscriptionCooldownsTable.hotspotId, hotspotId),
        ),
      );
  }

  // Silent Queue 操作
  async listSilentQueue(): Promise<(typeof subscriptionSilentQueueTable.$inferSelect)[]> {
    return this.db.select().from(subscriptionSilentQueueTable);
  }

  async enqueueSilent(ruleId: number, hotspotId: number): Promise<void> {
    const existing = await this.db
      .select()
      .from(subscriptionSilentQueueTable)
      .where(
        and(
          eq(subscriptionSilentQueueTable.ruleId, ruleId),
          eq(subscriptionSilentQueueTable.hotspotId, hotspotId),
        ),
      )
      .limit(1);
    if (existing.length > 0) return;

    await this.db.insert(subscriptionSilentQueueTable).values({
      ruleId,
      hotspotId,
      createdAt: nowIso(),
    });
  }

  async clearSilentQueue(ruleId?: number): Promise<void> {
    if (ruleId !== undefined) {
      await this.db.delete(subscriptionSilentQueueTable).where(eq(subscriptionSilentQueueTable.ruleId, ruleId));
    } else {
      await this.db.delete(subscriptionSilentQueueTable);
    }
  }

  async getHotspot(id: number): Promise<HotspotCluster | undefined> {
    const result = await this.db
      .select()
      .from(hotspotsTable)
      .where(eq(hotspotsTable.id, id))
      .limit(1);
    return result[0] ? this.asHotspotCluster(result[0]) : undefined;
  }

  // 通知统计 - 订阅健康看板数据
  async getNotificationStats() {
    // 获取最近 30 天的通知日志
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentLogs = await this.db
      .select()
      .from(notificationLogsTable)
      .where(gte(notificationLogsTable.createdAt, thirtyDaysAgo))
      .orderBy(desc(notificationLogsTable.createdAt));

    const total = recentLogs.length;
    const sent = recentLogs.filter((l) => l.status === "sent").length;
    const failed = recentLogs.filter((l) => l.status === "failed").length;

    // 统计噪音反馈（用户标记为不相关的比例）
    const irrelevantLogs = recentLogs.filter((l) => {
      const payload = l.payload as { verdict?: string } | null;
      return payload?.verdict === "irrelevant";
    });
    const relevantLogs = recentLogs.filter((l) => {
      const payload = l.payload as { verdict?: string } | null;
      return payload?.verdict === "relevant";
    });

    // 计算每日送达率趋势（最近 7 天）
    const dailyStats: { date: string; sent: number; failed: number; deliveryRate: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const dayLogs = recentLogs.filter((l) => l.createdAt.startsWith(dateStr));
      const daySent = dayLogs.filter((l) => l.status === "sent").length;
      const dayFailed = dayLogs.filter((l) => l.status === "failed").length;
      dailyStats.push({
        date: dateStr,
        sent: daySent,
        failed: dayFailed,
        deliveryRate: dayLogs.length > 0 ? daySent / dayLogs.length : 1,
      });
    }

    return {
      total,
      sent,
      failed,
      deliveryRate: total > 0 ? sent / total : 1,
      noiseRatio: sent > 0 ? irrelevantLogs.length / sent : 0,
      irrelevantCount: irrelevantLogs.length,
      relevantCount: relevantLogs.length,
      dailyStats,
    };
  }

  private asSubscriptionRuleRecord(
    row: typeof subscriptionRulesTable.$inferSelect,
  ): SubscriptionRuleRecord {
    return {
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      monitorIds: row.monitorIds,
      includeKeywords: row.includeKeywords,
      andKeywords: row.andKeywords,
      excludeKeywords: row.excludeKeywords,
      minScore: row.minScore,
      minTrustScore: row.minTrustScore,
      minSupportingSources: row.minSupportingSources,
      deliveryFrequency: row.deliveryFrequency as "instant" | "daily" | "weekly",
      deliveryTime: row.deliveryTime,
      prefetchMinutes: row.prefetchMinutes,
      recipients: row.recipients,
      lastDispatchedAt: row.lastDispatchedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async cleanupOldData(eventRetentionDays: number, hotspotRetentionDays: number): Promise<{ deletedEvents: number; deletedHotspots: number }> {
    const eventThreshold = new Date(Date.now() - eventRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    const hotspotThreshold = new Date(Date.now() - hotspotRetentionDays * 24 * 60 * 60 * 1000).toISOString();

    const deletedEvents = await this.db.delete(eventsTable).where(lte(eventsTable.createdAt, eventThreshold));
    const deletedHotspots = await this.db.delete(hotspotsTable).where(lte(hotspotsTable.createdAt, hotspotThreshold));

    return {
      deletedEvents: deletedEvents.rowsAffected,
      deletedHotspots: deletedHotspots.rowsAffected,
    };
  }
}
