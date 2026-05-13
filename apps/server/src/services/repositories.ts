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
  MonitorMode,
  MonitorRecord,
  NotificationChannel,
  SettingsFormInput,
  SettingsRecord,
  SourceKind,
  VerifiedEvent,
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
    const result = await this.db.select().from(monitorsTable).orderBy(desc(monitorsTable.updatedAt));
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
        mode: input.mode,
        query: input.query,
        description: input.description ?? null,
        intervalMinutes: input.intervalMinutes,
        cooldownMinutes: input.cooldownMinutes,
        enabled: input.enabled,
        sources: input.sources,
        notifyChannels: input.notifyChannels,
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
    if (patch.mode !== undefined) payload.mode = patch.mode;
    if (patch.query !== undefined) payload.query = patch.query;
    if (patch.description !== undefined) payload.description = patch.description ?? null;
    if (patch.intervalMinutes !== undefined) payload.intervalMinutes = patch.intervalMinutes;
    if (patch.cooldownMinutes !== undefined) payload.cooldownMinutes = patch.cooldownMinutes;
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.sources !== undefined) payload.sources = patch.sources;
    if (patch.notifyChannels !== undefined) payload.notifyChannels = patch.notifyChannels;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = desc(eventsTable.createdAt);

    if (sort) {
      const { field, order } = sort;

      switch (field) {
        case "createdAt":
          orderBy = order === "asc" ? eventsTable.createdAt : desc(eventsTable.createdAt);
          break;
        case "authenticityScore":
          orderBy = order === "asc"
            ? eventsTable.authenticityScore
            : desc(eventsTable.authenticityScore);
          break;
        case "relevanceScore":
          orderBy = order === "asc"
            ? eventsTable.relevanceScore
            : desc(eventsTable.relevanceScore);
          break;
        case "combinedScore":
          orderBy = order === "asc"
            ? sql`authenticity_score * relevance_score`
            : desc(sql`authenticity_score * relevance_score`);
          break;
        case "sourceType":
          orderBy = order === "asc"
            ? eventsTable.sourceType
            : desc(eventsTable.sourceType);
          break;
      }
    }

    const result = await this.db
      .select()
      .from(eventsTable)
      .where(whereClause)
      .orderBy(orderBy)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = desc(hotspotsTable.createdAt);

    if (sort) {
      const { field, order } = sort;

      switch (field) {
        case "createdAt":
          orderBy = order === "asc" ? hotspotsTable.createdAt : desc(hotspotsTable.createdAt);
          break;
        case "score":
          orderBy = order === "asc"
            ? hotspotsTable.score
            : desc(hotspotsTable.score);
          break;
        case "diversityScore":
          orderBy = order === "asc"
            ? hotspotsTable.diversityScore
            : desc(hotspotsTable.diversityScore);
          break;
        case "freshnessScore":
          orderBy = order === "asc"
            ? hotspotsTable.freshnessScore
            : desc(hotspotsTable.freshnessScore);
          break;
        case "engagementScore":
          orderBy = order === "asc"
            ? hotspotsTable.engagementScore
            : desc(hotspotsTable.engagementScore);
          break;
        case "coverage":
          orderBy = order === "asc"
            ? sql`json_array_length(supporting_urls)`
            : desc(sql`json_array_length(supporting_urls)`);
          break;
      }
    }

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(hotspotsTable)
      .where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);

    const result = await this.db
      .select()
      .from(hotspotsTable)
      .where(whereClause)
      .orderBy(orderBy)
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
        updatedAt: nowIso(),
      })
      .where(eq(settingsTable.id, 1))
      .returning();

    return result[0];
  }

  async logNotification(params: {
    channel: NotificationChannel;
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
    const [monitors, events, hotspotsResult, settings] = await Promise.all([
      this.listMonitors(),
      this.listEvents(12),
      this.listHotspots(8),
      this.getSettings(),
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
      mode: "keyword",
      query: "",
      intervalMinutes: 15,
      cooldownMinutes: 60,
      enabled: true,
      sources: DEFAULT_SOURCE_CONFIG,
      notifyChannels: ["email"],
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
      mode: row.mode as MonitorMode,
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
      createdAt: row.createdAt,
    };
  }
}
