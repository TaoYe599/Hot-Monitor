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

/**
 * 带有最大并发限制的异步任务处理器（零第三方包依赖，保序且高健壮）
 * 
 * 使用 Worker 协程池思想在内存中保序流转，能优雅防范外部请求超限 429 错误
 * 
 * @param items 输入的任务源数组
 * @param limit 最大并发数限制
 * @param fn 每个项的具体处理函数（返回 Promise）
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        results[currentIndex] = await fn(item);
      } catch (err) {
        // 捕获任务中的错误，避免中断其他正在并发的任务管道
        console.error(`[scan] [ERROR] 并发研判任务处理失败 (索引: ${currentIndex}):`, err);
        throw err;
      }
    }
  }

  // 启动并发 Worker 协程
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

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

    // ============================================================
    // 时效性滑动时间窗过滤层：剔除发布时间早于 2 天前的陈旧数据，确保生成的全部热点均为近期高新鲜度情报（配合日报高时效性要求）
    // ============================================================
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const freshCandidates = candidates.filter((candidate) => {
      if (!candidate.publishedAt) {
        return true; // 缺失发布时间时做宽松容错保留，防止关键源漏掉
      }
      try {
        const publishedTime = new Date(candidate.publishedAt).getTime();
        return publishedTime >= twoDaysAgo;
      } catch {
        return true; // 时间解析异常时做容错保留
      }
    });

    if (this.isCancelled(monitor.id)) {
      throw new Error("Scan cancelled");
    }

    // ============================================================
    // 预过滤层：使用 Query Expansion 计算关键词密度，过滤明显不相关的内容
    // ============================================================
    const expandedTerms = expandQuery(monitor.query);
    const preFiltered = freshCandidates.filter((candidate) => {
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

    if (preFiltered.length > 0) {
      // Step 1: 异步并发 AI 验证。为了彻底解决串行研判导致的时间堆积，我们在此将管线重构为两阶段并发流：
      
      // ==========================================
      // 阶段 A：过滤识别出真正需要进行物理 AI 接口研判的候选
      // ==========================================
      const candidatesToProcess: SourceItem[] = [];
      for (const candidate of preFiltered) {
        if (this.isCancelled(monitor.id)) {
          throw new Error("Scan cancelled");
        }

        const existing = await this.repository.getExistingEvent(monitor.id, candidate.url);
        if (existing) {
          // 已存在事件时强力回填绑定 ID，确保历史数据再次参与聚类时仍能正确关联
          candidate.existingEvent = { id: existing.id };
          continue;
        }
        candidatesToProcess.push(candidate);
      }

      // ==========================================
      // 阶段 B：启动并发限流研判（将最大并发路数严格锁定为 3，确保速度的同时绝对不触及 API 429 频控限制）
      // ==========================================
      await runWithConcurrencyLimit(candidatesToProcess, 3, async (candidate) => {
        if (this.isCancelled(monitor.id)) {
          throw new Error("Scan cancelled");
        }

        const verdict = await this.aiService.verifyKeywordCandidate(monitor, candidate);
        if (!verdict.isMatch) {
          console.info(
            `[scan] rejected: "${candidate.title.slice(0, 60)}" | relevance=${verdict.relevanceScore} auth=${verdict.authenticityScore} reason=${verdict.reason.slice(0, 80)}`,
          );
          return;
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

        // 强力回填挂载新生成的事件物理主键，打通与热点聚类 cluster_id 的关联通道，修复断联 Bug
        candidate.existingEvent = { id: created.id };

        acceptedEvents.push(created);
        this.bus.publish({
          type: "event.created",
          createdAt: nowIso(),
          payload: created,
        });
      });

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
          isHeuristic: cluster.isHeuristic ?? false,
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

        if (cluster.shouldNotify) {
          await this.notificationService.notifyHotspot(created, {
            name: monitor.name,
          });
        }
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
