import { randomUUID } from "node:crypto";

import type { MonitorRecord, ScanJobRecord, ScanJobTrigger } from "@hot-monitor/shared";

import type { LiveEventBus } from "../lib/event-bus.js";
import { nowIso } from "../lib/utils.js";
import { ScanRunner } from "./scan-runner.js";

export class ScanJobService {
  private readonly jobs = new Map<string, ScanJobRecord>();
  private readonly activeByMonitorId = new Map<number, string>();
  private readonly jobOrder: string[] = [];

  constructor(
    private readonly runner: ScanRunner,
    private readonly bus: LiveEventBus,
  ) {}

  enqueue(monitor: MonitorRecord, trigger: ScanJobTrigger): ScanJobRecord {
    const activeJobId = this.activeByMonitorId.get(monitor.id);
    if (activeJobId) {
      const existing = this.jobs.get(activeJobId);
      if (existing && (existing.status === "queued" || existing.status === "running")) {
        return existing;
      }
    }

    const job: ScanJobRecord = {
      id: randomUUID(),
      monitorId: monitor.id,
      monitorName: monitor.name,
      trigger,
      status: "queued",
      createdAt: nowIso(),
      startedAt: null,
      finishedAt: null,
      summary: null,
      error: null,
    };

    this.jobs.set(job.id, job);
    this.jobOrder.unshift(job.id);
    this.activeByMonitorId.set(monitor.id, job.id);
    this.trimHistory();
    this.publish(job);

    console.info(
      `[scan-job] queued ${job.id} for monitor ${monitor.id} (${monitor.query}) via ${trigger}`,
    );

    queueMicrotask(() => {
      void this.runJob(job.id, monitor);
    });

    return job;
  }

  list(limit = 20): ScanJobRecord[] {
    return this.jobOrder
      .slice(0, limit)
      .map((jobId) => this.jobs.get(jobId))
      .filter((job): job is ScanJobRecord => Boolean(job));
  }

  get(jobId: string): ScanJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  private publish(job: ScanJobRecord): void {
    this.bus.publish({
      type: "scan.job.updated",
      createdAt: nowIso(),
      payload: job,
    });
  }

  private trimHistory(): void {
    const maxJobs = 60;
    while (this.jobOrder.length > maxJobs) {
      const removedId = this.jobOrder.pop();
      if (removedId) {
        this.jobs.delete(removedId);
      }
    }
  }

  private async runJob(jobId: string, monitor: MonitorRecord): Promise<void> {
    const queued = this.jobs.get(jobId);
    if (!queued) {
      return;
    }

    queued.status = "running";
    queued.startedAt = nowIso();
    this.publish(queued);
    console.info(`[scan-job] running ${queued.id} for monitor ${monitor.id}`);

    try {
      const summary = await this.runner.runMonitor(monitor);
      queued.status = "succeeded";
      queued.finishedAt = nowIso();
      queued.summary = summary;
      this.publish(queued);
      console.info(
        `[scan-job] succeeded ${queued.id} with ${summary.candidates} candidates, ${summary.acceptedEvents.length} events, ${summary.hotspots.length} hotspots`,
      );
    } catch (error) {
      queued.status = "failed";
      queued.finishedAt = nowIso();
      queued.error = error instanceof Error ? error.message : String(error);
      this.publish(queued);
      console.error(`[scan-job] failed ${queued.id}: ${queued.error}`);
    } finally {
      this.activeByMonitorId.delete(monitor.id);
    }
  }
}
