import type { MonitorRecord } from "@hot-monitor/shared";
import { eq } from "drizzle-orm";

import { nowIso } from "../lib/utils.js";
import { Repository } from "./repositories.js";
import { ScanJobService } from "./scan-jobs.js";
import { NotificationService } from "./notification-service.js";
import { hotspotsTable } from "../db/schema.js";

const SERVER_START_TIME = Date.now();

export class MonitorScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = new Set<number>();
  private lastDispatchedMinute = ""; // 用于防止在一分钟内因 30s 轮询导致定时简报重复触发发送

  constructor(
    private readonly repository: Repository,
    private readonly scanJobs: ScanJobService,
    private readonly notificationService: NotificationService,
  ) {}

  private isDue(monitor: MonitorRecord): boolean {
    if (!monitor.enabled) {
      return false;
    }
    if (!monitor.lastRunAt) {
      return false;
    }

    const lastRunAt = new Date(monitor.lastRunAt).getTime();
    const intervalMs = monitor.intervalMinutes * 60 * 1000;

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
    // 1. 保留原本的监控扫描任务到期检查
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

    // 2. 调度智能订阅通知系统
    void this.subscriptionTick().catch((err) => {
      console.error(`[scheduler] 周期订阅发送任务异常:`, err);
    });
  }

  // =========================================================================
  // 订阅规则定时简报与静默队列释放调度算法
  // =========================================================================

  private async subscriptionTick(): Promise<void> {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentMinuteStr = `${hh}:${mm}`;

    // 防重锁拦截
    if (this.lastDispatchedMinute === currentMinuteStr) {
      return;
    }
    this.lastDispatchedMinute = currentMinuteStr;

    console.info(`[订阅调度] 当前时刻 ${currentMinuteStr}，开始评估定时简报与静默期释放逻辑...`);

    const settings = await this.repository.getSettings();
    const rules = await this.repository.listSubscriptionRules();
    const activeRules = rules.filter((r) => r.enabled);

    // -------------------------------------------------------------------------
    // 流程 A: 订阅定时汇总简报 (Daily/Weekly Digest)
    // -------------------------------------------------------------------------
    for (const rule of activeRules) {
      if (rule.deliveryFrequency === "instant" || !rule.deliveryTime) {
        continue;
      }

      // 拆分支持多时点投递，如 "09:00,18:00"
      const deliveryTimes = rule.deliveryTime.split(",").map((t) => t.trim());
      if (!deliveryTimes.includes(currentMinuteStr)) {
        continue;
      }

      // 防止同一天或同一个简报周期内发生重发（以防极端的时间重设）
      const todayStr = now.toISOString().substring(0, 10);
      const lastDispatchedDay = rule.lastDispatchedAt ? rule.lastDispatchedAt.substring(0, 10) : "";
      if (rule.deliveryFrequency === "daily" && lastDispatchedDay === todayStr) {
        console.info(`[简报拦截] 规则 ${rule.name} (daily) 今天已经投递过简报，不再重复。`);
        continue;
      }

      console.info(`[定时触发] 订阅规则 ${rule.name} 定时发送已就绪 (${rule.deliveryFrequency})，正在抽取增量数据...`);

      try {
        // 计算数据提取起止时间
        const intervalHours = rule.deliveryFrequency === "weekly" ? 7 * 24 : 24;
        const timeFromDate = new Date(Date.now() - intervalHours * 60 * 60 * 1000);

        // 调用 Repository 查询指定时间段内产生的所有热点
        const { hotspots } = await this.repository.listHotspots(100, undefined, {
          timeRange: "custom",
          timeFrom: timeFromDate.toISOString(),
        });

        // 匹配过滤热点列表，保留满足该规则全部过滤条件的热点
        const matchedHotspots = [];
        for (const h of hotspots) {
          const isMatch = await this.notificationService.matchSubscriptionRule(h, rule);
          if (isMatch) {
            // 获取每个热点的事件摘要进行丰富
            const events = await this.repository.getEventsByClusterId(h.id);
            matchedHotspots.push({ ...h, events });
          }
        }

        const subject = rule.deliveryFrequency === "weekly"
          ? `[📅 每周简报] Hot Monitor 情报周报: ${rule.name}`
          : `[📅 每日简报] Hot Monitor 情报日报: ${rule.name}`;

        if (matchedHotspots.length === 0) {
          // 枯竭容错降级：不发垃圾空信，但发极简“零警报安全信”，让用户知情
          console.info(`[简报枯竭] 规则 ${rule.name} 在过去 ${intervalHours} 小时内无新增匹配热点，进行降级报信。`);
          const silentSubject = `[📅 周期报告] Hot Monitor: ${rule.name} (今日平稳)`;
          const silentHtml = `
            <div style="padding:30px; font-family:-apple-system,BlinkMacSystemFont; max-width:600px; margin:auto; background-color:#ffffff; border-radius:16px; border:1px solid rgba(8,17,31,0.06); box-shadow:0 8px 30px rgba(0,0,0,0.02);">
              <span style="font-size:24px;">🛡️</span>
              <h2 style="font-size:18px; font-weight:700; color:#08111f; margin-top:16px;">昨日运行平稳，无新增动态</h2>
              <p style="font-size:14px; color:#475569; line-height:1.6; margin-top:8px;">
                本监测周期内，未发现高于指定阈值（热度 $\\ge$ ${Math.round(rule.minScore * 100)}%）的重大 AI 热点信号。监控系统运行状态健康，我们将持续为您追踪。
              </p>
              <hr style="border:none; border-top:1px solid rgba(8,17,31,0.06); margin:20px 0;">
              <span style="font-size:11px; color:#94a3b8;">本报告由 Hot-Monitor 定时调度发出，您随时可前往后台微调订阅阈值。</span>
            </div>
          `;
          await this.notificationService.sendCustomEmail(rule.recipients, silentSubject, silentHtml, settings, {
            kind: "subscription_digest_empty",
            ruleId: rule.id,
          });
        } else {
          // 正常发信，渲染多卡流简报
          const htmlContent = this.notificationService.renderPeriodicDigestEmail(matchedHotspots, rule, false);
          await this.notificationService.sendCustomEmail(rule.recipients, subject, htmlContent, settings, {
            kind: "subscription_digest",
            ruleId: rule.id,
            count: matchedHotspots.length,
          });
        }

        // 更新投递时间戳
        await this.repository.updateSubscriptionRule(rule.id, { lastDispatchedAt: nowIso() });
      } catch (err) {
        console.error(`[定时简报发送失败] 规则 ${rule.name}:`, err);
      }
    }

    // -------------------------------------------------------------------------
    // 流程 B: 早上 08:00 唤醒清空释放静默期积压队列
    // -------------------------------------------------------------------------
    if (currentMinuteStr === "08:00") {
      console.info(`[静默释放] 早上 08:00 免打扰静默期结束，开始装箱归档发信...`);
      try {
        const silentItems = await this.repository.listSilentQueue();
        if (silentItems.length === 0) {
          return;
        }

        // 按 ruleId 分组装箱
        const grouped = new Map<number, number[]>();
        for (const item of silentItems) {
          const list = grouped.get(item.ruleId) ?? [];
          list.push(item.hotspotId);
          grouped.set(item.ruleId, list);
        }

        for (const [ruleId, hotspotIds] of grouped.entries()) {
          const rule = activeRules.find((r) => r.id === ruleId);
          if (!rule) {
            // 规则已被停用或删除，直接清空对应的队列
            await this.repository.clearSilentQueue(ruleId);
            continue;
          }

          // 提取热点数据
          const hotspots = [];
          for (const hid of hotspotIds) {
            // 从数据库拉取具体热点
            const hotspotObj = await this.repository.getHotspot(hid);
            if (hotspotObj) {
              const events = await this.repository.getEventsByClusterId(hid);
              hotspots.push({ ...hotspotObj, events });
            }
          }

          if (hotspots.length > 0) {
            const subject = `[🌅 早报汇总] Hot Monitor 夜间重大预警合并: ${rule.name}`;
            const htmlContent = this.notificationService.renderPeriodicDigestEmail(hotspots, rule, true);
            await this.notificationService.sendCustomEmail(rule.recipients, subject, htmlContent, settings, {
              kind: "subscription_silent_release",
              ruleId: rule.id,
              count: hotspots.length,
            });
          }

          // 发送完毕，清空对应的静默记录
          await this.repository.clearSilentQueue(ruleId);
        }
      } catch (err) {
        console.error(`[静默释放失败] 发生异常:`, err);
      }
    }
  }

  // =========================================================================

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
