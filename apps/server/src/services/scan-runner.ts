import type {
  EngagementDetails,
  HotspotCluster,
  HotspotClusterOutput,
  HotspotEngagementAggregates,
  MonitorRecord,
  ScanSummary,
  SourceItem,
  VerifiedEvent,
} from "@hot-monitor/shared";

import type { LiveEventBus } from "../lib/event-bus.js";
import {
  nowIso,
  normalizeUrl,
  scoreCandidateForMonitor,
  expandQuery,
  keywordDensityWithExpansion,
} from "../lib/utils.js";
import { AiService } from "./ai-service.js";
import { NotificationService } from "./notification-service.js";
import { Repository } from "./repositories.js";
import { SourceService } from "./sources.js";

export class ScanRunner {
  private readonly cancelledMonitors = new Set<number>();

  /** 预过滤层的关键词密度阈值 - 从配置读取，默认 0.2 */
  private get preFilterThreshold(): number {
    return this.config.thresholds?.preFilter ?? 0.2;
  }

  constructor(
    private readonly repository: Repository,
    private readonly sourceService: SourceService,
    private readonly aiService: AiService,
    private readonly notificationService: NotificationService,
    private readonly bus: LiveEventBus,
    private readonly config: { thresholds?: { preFilter?: number; relevance?: number; authenticity?: number } },
  ) {}

  cancel(monitorId: number): void {
    this.cancelledMonitors.add(monitorId);
  }

  private isCancelled(monitorId: number): boolean {
    return this.cancelledMonitors.has(monitorId);
  }

  private withinCooldown(monitor: MonitorRecord, publishedAt: string | null): boolean {
    if (!publishedAt) {
      return false;
    }
    const published = new Date(publishedAt).getTime();
    const threshold = Date.now() - monitor.cooldownMinutes * 60 * 1000;
    return published < threshold;
  }

  /**
   * 从多个来源聚合互动数据
   */
  private aggregateEngagement(candidates: SourceItem[]): HotspotEngagementAggregates | null {
    if (candidates.length === 0) return null;

    const aggregates: HotspotEngagementAggregates = {};
    let maxLikes = 0;
    let maxRetweets = 0;
    let maxViews = 0;
    let maxComments = 0;

    for (const candidate of candidates) {
      const details = candidate.engagementDetails;
      if (!details) continue;

      // 累加各类指标
      if (details.likes !== undefined) {
        aggregates.totalLikes = (aggregates.totalLikes ?? 0) + details.likes;
        if (details.likes > maxLikes) maxLikes = details.likes;
      }
      if (details.retweets !== undefined) {
        aggregates.totalRetweets = (aggregates.totalRetweets ?? 0) + details.retweets;
        if (details.retweets > maxRetweets) maxRetweets = details.retweets;
      }
      if (details.replies !== undefined) {
        aggregates.totalReplies = (aggregates.totalReplies ?? 0) + details.replies;
      }
      if (details.views !== undefined) {
        aggregates.totalViews = (aggregates.totalViews ?? 0) + details.views;
        if (details.views > maxViews) maxViews = details.views;
      }
      if (details.points !== undefined) {
        aggregates.totalPoints = (aggregates.totalPoints ?? 0) + details.points;
      }
      if (details.upvotes !== undefined) {
        aggregates.totalUpvotes = (aggregates.totalUpvotes ?? 0) + details.upvotes;
      }
      if (details.downvotes !== undefined) {
        aggregates.totalDownvotes = (aggregates.totalDownvotes ?? 0) + details.downvotes;
      }
      if (details.score !== undefined) {
        aggregates.totalScore = (aggregates.totalScore ?? 0) + details.score;
      }
      if (details.comments !== undefined) {
        aggregates.totalComments = (aggregates.totalComments ?? 0) + details.comments;
        if (details.comments > maxComments) maxComments = details.comments;
      }
    }

    // 添加最大值
    if (maxLikes > 0) aggregates.maxLikes = maxLikes;
    if (maxRetweets > 0) aggregates.maxRetweets = maxRetweets;
    if (maxViews > 0) aggregates.maxViews = maxViews;
    if (maxComments > 0) aggregates.maxComments = maxComments;

    return Object.keys(aggregates).length > 0 ? aggregates : null;
  }

  /**
   * 获取热点支持的所有来源中最早和最新的发布时间
   */
  private getPublishedTimeRange(
    candidates: SourceItem[],
    supportingUrls: string[],
  ): { earliest: string | null; latest: string | null } {
    const normalizedUrls = new Set(supportingUrls.map(normalizeUrl));
    const publishedDates: string[] = [];

    for (const candidate of candidates) {
      if (normalizedUrls.has(normalizeUrl(candidate.url)) && candidate.publishedAt) {
        publishedDates.push(candidate.publishedAt);
      }
    }

    if (publishedDates.length === 0) {
      return { earliest: null, latest: null };
    }

    publishedDates.sort();
    return {
      earliest: publishedDates[0],
      latest: publishedDates[publishedDates.length - 1],
    };
  }

  async runMonitor(monitor: MonitorRecord): Promise<ScanSummary> {
    if (this.isCancelled(monitor.id)) {
      throw new Error("Scan cancelled");
    }

    const candidates = (await this.sourceService.collect(monitor, () => this.isCancelled(monitor.id)))
      .sort((left, right) => scoreCandidateForMonitor(monitor, right) - scoreCandidateForMonitor(monitor, left))
      .slice(0, 50);

    if (this.isCancelled(monitor.id)) {
      throw new Error("Scan cancelled");
    }

    // ============================================================
    // 预过滤层：使用 Query Expansion 计算关键词密度，过滤明显不相关的内容
    // ============================================================
    const expandedTerms = expandQuery(monitor.query);
    const preFiltered = candidates.filter((candidate) => {
      const text = `${candidate.title} ${candidate.excerpt} ${candidate.content}`.toLowerCase();
      const density = keywordDensityWithExpansion(expandedTerms, text);
      return density >= this.preFilterThreshold;
    });

    const filteredCount = candidates.length - preFiltered.length;
    if (filteredCount > 0) {
      console.info(
        `[scan] 预过滤: ${candidates.length} → ${preFiltered.length} (过滤 ${filteredCount} 条, 阈值=${this.preFilterThreshold})`,
      );
    }

    console.info(
      `[scan] monitor ${monitor.id} (${monitor.query}) entered clustering with ${preFiltered.length} candidates after pre-filter`,
    );

    const acceptedEvents: VerifiedEvent[] = [];
    const hotspots: HotspotCluster[] = [];

    if (monitor.mode === "keyword") {
      for (const candidate of preFiltered) {
        if (this.isCancelled(monitor.id)) {
          throw new Error("Scan cancelled");
        }
        if (this.withinCooldown(monitor, candidate.publishedAt)) {
          continue;
        }

        const existing = await this.repository.getExistingEvent(monitor.id, candidate.url);
        if (existing) {
          candidate.existingEvent = existing;
          continue;
        }

        const verdict = await this.aiService.verifyKeywordCandidate(monitor, candidate);
        if (!verdict.isMatch) {
          console.info(
            `[scan] rejected: "${candidate.title.slice(0, 60)}" | relevance=${verdict.relevanceScore} auth=${verdict.authenticityScore} reason=${verdict.reason.slice(0, 80)}`,
          );
          continue;
        }

        console.info(
          `[scan] accepted: "${candidate.title.slice(0, 60)}" | relevance=${verdict.relevanceScore} auth=${verdict.authenticityScore}`,
        );

        const created = await this.repository.createEvent({
          monitorId: monitor.id,
          title: candidate.title,
          summary: verdict.summary,
          originalExcerpt: candidate.excerpt,
          sourceUrl: candidate.url,
          sourceType: candidate.sourceKind,
          sourceLabel: candidate.sourceLabel,
          author: candidate.author,
          publishedAt: candidate.publishedAt,
          authenticityScore: verdict.authenticityScore,
          relevanceScore: verdict.relevanceScore,
          evidence: verdict.evidence,
          clusterId: null,
          status: "accepted",
          reason: verdict.reason,
          engagementDetails: candidate.engagementDetails ?? null,
          isRead: false,
        });

        acceptedEvents.push(created);
        candidate.existingEvent = created;
        this.bus.publish({
          type: "event.created",
          createdAt: nowIso(),
          payload: created,
        });

        await this.notificationService.notifyEvent(created, monitor.notifyChannels);
      }
    }

    if (monitor.mode === "topic" && preFiltered.length > 0) {
      // Step 1: 对每个候选进行 AI 验证，创建 individual events
      for (const candidate of preFiltered) {
        if (this.isCancelled(monitor.id)) {
          throw new Error("Scan cancelled");
        }
        if (this.withinCooldown(monitor, candidate.publishedAt)) {
          continue;
        }

        const existing = await this.repository.getExistingEvent(monitor.id, candidate.url);
        if (existing) {
          candidate.existingEvent = existing;
          continue;
        }

        const verdict = await this.aiService.verifyKeywordCandidate(monitor, candidate);
        if (!verdict.isMatch) {
          console.info(
            `[scan] rejected: "${candidate.title.slice(0, 60)}" | relevance=${verdict.relevanceScore} auth=${verdict.authenticityScore} reason=${verdict.reason.slice(0, 80)}`,
          );
          continue;
        }

        console.info(
          `[scan] accepted: "${candidate.title.slice(0, 60)}" | relevance=${verdict.relevanceScore} auth=${verdict.authenticityScore}`,
        );

        const created = await this.repository.createEvent({
          monitorId: monitor.id,
          title: candidate.title,
          summary: verdict.summary,
          originalExcerpt: candidate.excerpt,
          sourceUrl: candidate.url,
          sourceType: candidate.sourceKind,
          sourceLabel: candidate.sourceLabel,
          author: candidate.author,
          publishedAt: candidate.publishedAt,
          authenticityScore: verdict.authenticityScore,
          relevanceScore: verdict.relevanceScore,
          evidence: verdict.evidence,
          clusterId: null,
          status: "accepted",
          reason: verdict.reason,
          engagementDetails: candidate.engagementDetails ?? null,
          isRead: false,
        });

        acceptedEvents.push(created);
        candidate.existingEvent = created;
        this.bus.publish({
          type: "event.created",
          createdAt: nowIso(),
          payload: created,
        });

        await this.notificationService.notifyEvent(created, monitor.notifyChannels);
      }

      // Step 2: AI 热点聚类（不创建重复 events）
      if (this.isCancelled(monitor.id)) {
        throw new Error("Scan cancelled");
      }

      const discovered = await this.aiService.discoverHotspots(monitor, preFiltered);
      for (const cluster of discovered.filter((item) => item.shouldNotify || item.score >= 0.3).slice(0, 10)) {
        const normalizedUrls = cluster.supportingUrls.map((url) => {
          const normalized = normalizeUrl(url);
          if (normalized !== url) {
            console.info(`[scan] normalized URL: ${url} -> ${normalized}`);
          }
          return normalized;
        });

        // 找出属于这个热点的候选来源
        const clusterCandidates = preFiltered.filter((c) =>
          normalizedUrls.includes(normalizeUrl(c.url)),
        );

        // 聚合互动数据
        const engagementAggregates = this.aggregateEngagement(clusterCandidates);

        // 获取发布时间范围
        const timeRange = this.getPublishedTimeRange(clusterCandidates, normalizedUrls);

        const created = await this.repository.createHotspot({
          monitorId: monitor.id,
          label: cluster.label,
          summary: cluster.summary,
          score: cluster.score,
          diversityScore: cluster.diversityScore,
          freshnessScore: cluster.freshnessScore,
          engagementScore: cluster.engagementScore,
          status: cluster.shouldNotify ? "notified" : "candidate",
          supportingUrls: normalizedUrls,
          reason: cluster.reason,
          engagementAggregates,
          earliestPublishedAt: timeRange.earliest,
          latestPublishedAt: timeRange.latest,
          createdAt: nowIso(),
        });

        // 更新关联事件的 clusterId
        const eventIds = clusterCandidates
          .map((c) => c.existingEvent?.id)
          .filter((id): id is number => id !== undefined);
        if (eventIds.length > 0) {
          await this.repository.updateEventsClusterId(eventIds, created.id);
        }

        hotspots.push(created);
        this.bus.publish({
          type: "hotspot.created",
          createdAt: nowIso(),
          payload: created,
        });

        await this.notificationService.notifyHotspot(created, {
          name: monitor.name,
          notifyChannels: monitor.notifyChannels,
        });
      }
    }

    await this.repository.markMonitorRun(monitor.id);

    console.info(
      `[scan] monitor ${monitor.id} completed with ${acceptedEvents.length} events and ${hotspots.length} hotspots`,
    );

    return {
      monitorId: monitor.id,
      candidates: candidates.length,
      preFilteredCount: preFiltered.length,
      filteredCount: candidates.length - preFiltered.length,
      acceptedEvents,
      hotspots,
    };
  }
}
