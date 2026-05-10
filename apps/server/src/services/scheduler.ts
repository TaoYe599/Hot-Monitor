import type { MonitorRecord } from "@hot-monitor/shared";

import { nowIso } from "../lib/utils.js";
import { Repository } from "./repositories.js";
import { ScanJobService } from "./scan-jobs.js";

const SERVER_START_TIME = Date.now();

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
    // Never auto-run a monitor that has never been run before.
    // This prevents automatic scanning on startup for newly created monitors.
    if (!monitor.lastRunAt) {
      return false;
    }

    const lastRunAt = new Date(monitor.lastRunAt).getTime();
    const intervalMs = monitor.intervalMinutes * 60 * 1000;

    // If the monitor was last run before this server started,
    // reset the timer so it will run after one interval from server start.
    // This ensures all monitors start their timers fresh when server restarts.
    if (lastRunAt < SERVER_START_TIME) {
      const timeSinceServerStart = Date.now() - SERVER_START_TIME;
      const isDue = timeSinceServerStart >= intervalMs;
      console.info(`[scheduler] monitor ${monitor.id} (${monitor.query}): lastRunAt=${monitor.lastRunAt}, serverStart=${new Date(SERVER_START_TIME).toISOString()}, timeSinceStart=${Math.round(timeSinceServerStart / 1000)}s, interval=${monitor.intervalMinutes}min, isDue=${isDue}`);
      return isDue;
    }

    const nextRunAt = lastRunAt + intervalMs;
    const isDue = Date.now() >= nextRunAt;
    console.info(`[scheduler] monitor ${monitor.id} (${monitor.query}): lastRunAt=${monitor.lastRunAt}, nextRunAt=${new Date(nextRunAt).toISOString()}, isDue=${isDue}`);
    return isDue;
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
