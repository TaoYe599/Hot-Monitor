import type {
  HotspotCluster,
  MonitorRecord,
  ScanSummary,
  VerifiedEvent,
} from "@hot-monitor/shared";

import type { LiveEventBus } from "../lib/event-bus.js";
import { nowIso, scoreCandidateForMonitor } from "../lib/utils.js";
import { AiService } from "./ai-service.js";
import { NotificationService } from "./notification-service.js";
import { Repository } from "./repositories.js";
import { SourceService } from "./sources.js";

export class ScanRunner {
  constructor(
    private readonly repository: Repository,
    private readonly sourceService: SourceService,
    private readonly aiService: AiService,
    private readonly notificationService: NotificationService,
    private readonly bus: LiveEventBus,
  ) {}

  private withinCooldown(monitor: MonitorRecord, publishedAt: string | null): boolean {
    if (!publishedAt) {
      return false;
    }
    const published = new Date(publishedAt).getTime();
    const threshold = Date.now() - monitor.cooldownMinutes * 60 * 1000;
    return published < threshold;
  }

  async runMonitor(monitor: MonitorRecord): Promise<ScanSummary> {
    const candidates = (await this.sourceService.collect(monitor))
      .sort((left, right) => scoreCandidateForMonitor(monitor, right) - scoreCandidateForMonitor(monitor, left))
      .slice(0, 16);

    console.info(
      `[scan] monitor ${monitor.id} (${monitor.query}) entered clustering with ${candidates.length} candidates`,
    );

    const acceptedEvents: VerifiedEvent[] = [];
    const hotspots: HotspotCluster[] = [];

    if (monitor.mode === "keyword") {
      for (const candidate of candidates) {
        if (this.withinCooldown(monitor, candidate.publishedAt)) {
          continue;
        }

        const existing = await this.repository.getExistingEvent(monitor.id, candidate.url);
        if (existing) {
          continue;
        }

        const verdict = await this.aiService.verifyKeywordCandidate(monitor, candidate);
        if (!verdict.isMatch) {
          continue;
        }

        const created = await this.repository.createEvent({
          monitorId: monitor.id,
          title: candidate.title,
          summary: verdict.summary,
          sourceUrl: candidate.url,
          sourceType: candidate.sourceKind,
          sourceLabel: candidate.sourceLabel,
          publishedAt: candidate.publishedAt,
          authenticityScore: verdict.authenticityScore,
          relevanceScore: verdict.relevanceScore,
          evidence: verdict.evidence,
          clusterId: null,
          status: "accepted",
          reason: verdict.reason,
        });

        acceptedEvents.push(created);
        this.bus.publish({
          type: "event.created",
          createdAt: nowIso(),
          payload: created,
        });

        await this.notificationService.notifyEvent(created, monitor.notifyChannels);
      }
    }

    if (monitor.mode === "topic" && candidates.length > 0) {
      const discovered = await this.aiService.discoverHotspots(monitor, candidates);
      for (const cluster of discovered.filter((item) => item.shouldNotify || item.score >= 0.5).slice(0, 6)) {
        const created = await this.repository.createHotspot({
          monitorId: monitor.id,
          label: cluster.label,
          summary: cluster.summary,
          score: cluster.score,
          diversityScore: cluster.diversityScore,
          freshnessScore: cluster.freshnessScore,
          engagementScore: cluster.engagementScore,
          status: cluster.shouldNotify ? "notified" : "candidate",
          supportingUrls: cluster.supportingUrls,
          createdAt: nowIso(),
        });

        hotspots.push(created);
        this.bus.publish({
          type: "hotspot.created",
          createdAt: nowIso(),
          payload: created,
        });

        if (cluster.shouldNotify) {
          await this.notificationService.notifyHotspot(created, {
            name: monitor.name,
            notifyChannels: monitor.notifyChannels,
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
      acceptedEvents,
      hotspots,
    };
  }
}
