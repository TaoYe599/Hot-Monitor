import type { MonitorRecord } from "@hot-monitor/shared";

import { nowIso } from "../lib/utils.js";
import { Repository } from "./repositories.js";
import { ScanJobService } from "./scan-jobs.js";

export class MonitorScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = new Set<number>();

  constructor(
    private readonly repository: Repository,
    private readonly scanJobs: ScanJobService,
  ) {}

  private isDue(monitor: MonitorRecord): boolean {
    if (!monitor.enabled) {
      return false;
    }
    if (!monitor.lastRunAt) {
      return true;
    }

    const lastRunAt = new Date(monitor.lastRunAt).getTime();
    const nextRunAt = lastRunAt + monitor.intervalMinutes * 60 * 1000;
    return Date.now() >= nextRunAt;
  }

  private async tick(): Promise<void> {
    const monitors = await this.repository.listMonitors();
    for (const monitor of monitors) {
      if (!this.isDue(monitor) || this.running.has(monitor.id)) {
        continue;
      }

      this.running.add(monitor.id);
      void Promise.resolve()
        .then(() => this.scanJobs.enqueue(monitor, "scheduler"))
        .catch((error) => {
          console.error(`[${nowIso()}] Failed to run monitor ${monitor.id}:`, error);
        })
        .finally(() => {
          this.running.delete(monitor.id);
        });
    }
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
