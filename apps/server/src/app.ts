import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { MonitorFormInput, NotificationChannel, SettingsFormInput, SubscriptionRuleInput } from "@hot-monitor/shared";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  DEFAULT_SOURCE_CONFIG,
} from "@hot-monitor/shared";
import cors from "@fastify/cors";
import staticPlugin from "@fastify/static";
import fastify from "fastify";
import { z } from "zod";

import { loadConfig, type AppConfig } from "./config.js";
import { createDatabaseConnection } from "./db/client.js";
import { migrateDatabase } from "./db/migrate.js";
import { LiveEventBus } from "./lib/event-bus.js";
import { AiService } from "./services/ai-service.js";
import { NotificationService } from "./services/notification-service.js";
import { Repository } from "./services/repositories.js";
import { ScanJobService } from "./services/scan-jobs.js";
import { ScanRunner } from "./services/scan-runner.js";
import { MonitorScheduler } from "./services/scheduler.js";
import { SourceService } from "./services/sources.js";

const monitorFormSchema = z.object({
  name: z.string().min(2),
  mode: z.enum(["keyword", "topic"]),
  query: z.string().min(2),
  description: z.string().optional(),
  intervalMinutes: z.number().int().min(5).max(24 * 60),
  cooldownMinutes: z.number().int().min(5).max(24 * 60),
  enabled: z.boolean().default(true),
  sources: z
    .object({
      twitter: z.boolean().default(true),
      search: z.boolean().default(true),
      rss: z.boolean().default(true),
      github: z.boolean().default(true),
      hackernews: z.boolean().default(true),
      zhihu: z.boolean().default(true),
      baidu: z.boolean().default(true),
      weibo: z.boolean().default(true),
      reddit: z.boolean().default(true),
    })
    .default(DEFAULT_SOURCE_CONFIG),
  notifyChannels: z
    .array(z.enum(["email"]))
    .min(1)
    .default(DEFAULT_NOTIFICATION_CHANNELS),
});

const settingsFormSchema = z.object({
  emailTo: z.array(z.string().email()).default([]),
  smtpHost: z.string().nullable(),
  smtpPort: z.number().int().nullable(),
  smtpSecure: z.boolean(),
  smtpUser: z.string().nullable(),
  smtpPassword: z.string().nullable(),
  smtpFrom: z.string().email().nullable(),
});

const subscriptionRuleFormSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  monitorIds: z.array(z.number()).nullable().default(null),
  includeKeywords: z.array(z.string()).default([]),
  andKeywords: z.array(z.string()).default([]),
  excludeKeywords: z.array(z.string()).default([]),
  minScore: z.number().min(0.0).max(1.0).default(0.7),
  minTrustScore: z.number().min(0.0).max(1.0).default(0.55),
  minSupportingSources: z.number().int().min(1).default(1),
  deliveryFrequency: z.enum(["instant", "daily", "weekly"]).default("instant"),
  deliveryTime: z.string().nullable().default(null),
  recipients: z.array(z.string().email()).min(1),
});

export interface AppServices {
  repository: Repository;
  sourceService: SourceService;
  aiService: AiService;
  notificationService: NotificationService;
  runner: ScanRunner;
  scanJobs: ScanJobService;
  scheduler: MonitorScheduler;
  bus: LiveEventBus;
}

export interface BuildAppOptions {
  config?: AppConfig;
  services?: Partial<AppServices>;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? loadConfig();
  const connection = createDatabaseConnection(config.databasePath);
  await migrateDatabase(connection.client);

  const bus = options.services?.bus ?? new LiveEventBus();
  const repository = options.services?.repository ?? new Repository(connection.db, config);
  const sourceService = options.services?.sourceService ?? new SourceService(config);
  const aiService = options.services?.aiService ?? new AiService(config);
  const notificationService =
    options.services?.notificationService ?? new NotificationService(repository, config, bus);
  const runner =
    options.services?.runner ?? new ScanRunner(repository, sourceService, aiService, notificationService, bus, config);
  const scanJobs = options.services?.scanJobs ?? new ScanJobService(runner, bus);
  const scheduler = options.services?.scheduler ?? new MonitorScheduler(repository, scanJobs, notificationService);

  const app = fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "warn",
      serializers: {
        req() {
          return {};
        },
        res() {
          return {};
        },
      },
    },
  });

  await app.register(cors, {
    origin: true,
  });

  const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));
  if (existsSync(webDist)) {
    await app.register(staticPlugin, {
      root: webDist,
      prefix: "/",
    });
  }

  app.get("/favicon.ico", async (_request, reply) => {
    if (existsSync(webDist)) {
      return reply.redirect("/favicon.svg");
    }
    reply.code(404);
    return { message: "Not found" };
  });

  app.get("/api/health", async () => ({
    ok: true,
    port: config.port,
    publicUrl: config.publicUrl,
  }));

  app.get("/api/dashboard", async () => repository.getDashboardSnapshot());
  app.get("/api/monitors", async () => repository.listMonitors());
  app.get("/api/events", async (request) => {
    const query = request.query as Record<string, string>;
    const sort = parseEventSort(query);
    const filter = parseEventFilter(query);
    const limit = query.limit ? parseInt(query.limit, 10) : 40;
    return repository.listEvents(limit, sort, filter);
  });
  app.get("/api/hotspots", async (request) => {
    const query = request.query as Record<string, string>;
    const sort = parseHotspotSort(query);
    const filter = parseHotspotFilter(query);
    const limit = query.limit ? parseInt(query.limit, 10) : 30;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;

    const { hotspots, total } = await repository.listHotspots(limit, sort, filter, offset);

    // 获取每个热点关联的事件摘要
    const hotspotsWithEvents = await Promise.all(
      hotspots.map(async (hotspot) => {
        const events = await repository.getEventsByClusterId(hotspot.id);
        return { ...hotspot, events };
      }),
    );

    return { hotspots: hotspotsWithEvents, total };
  });
  app.get("/api/scan-jobs", async () => scanJobs.list());
  app.get("/api/scan-jobs/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const job = scanJobs.get(id);
    if (!job) {
      reply.code(404);
      return { message: "Scan job not found" };
    }
    return job;
  });
  app.delete("/api/scan-jobs/:id", async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const cancelled = scanJobs.cancel(id);
    if (!cancelled) {
      reply.code(404);
      return { message: "Scan job not found or cannot be cancelled" };
    }
    return { ok: true };
  });
  app.get("/api/settings", async () => repository.getSettings());

  app.post("/api/monitors", async (request, reply) => {
    const body = monitorFormSchema.parse(request.body) as MonitorFormInput;
    const created = await repository.createMonitor(body);
    reply.code(201);
    return created;
  });

  app.patch("/api/monitors/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = monitorFormSchema.partial().parse(request.body) as Partial<MonitorFormInput>;
    const updated = await repository.updateMonitor(id, body);
    if (!updated) {
      reply.code(404);
      return { message: "Monitor not found" };
    }
    return updated;
  });

  app.delete("/api/monitors/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const deleted = await repository.deleteMonitor(id);
    if (!deleted) {
      reply.code(404);
      return { message: "Monitor not found" };
    }
    return { ok: true };
  });

  app.post("/api/monitors/:id/run", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const monitor = await repository.getMonitor(id);
    if (!monitor) {
      reply.code(404);
      return { message: "Monitor not found" };
    }
    app.log.info({ monitorId: monitor.id, query: monitor.query }, "Queued manual scan");
    reply.code(202);
    return scanJobs.enqueue(monitor, "manual");
  });

  app.patch("/api/settings", async (request) => {
    const body = settingsFormSchema.parse(request.body) as SettingsFormInput;
    return repository.updateSettings(body);
  });

  // =========================================================================
  // 智能订阅通知规则 & 闭环反馈 API 挂载
  // =========================================================================

  app.get("/api/subscriptions", async () => repository.listSubscriptionRules());

  app.post("/api/subscriptions", async (request, reply) => {
    const body = subscriptionRuleFormSchema.parse(request.body) as SubscriptionRuleInput;
    const created = await repository.createSubscriptionRule(body);
    reply.code(201);
    return created;
  });

  app.patch("/api/subscriptions/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const body = subscriptionRuleFormSchema.partial().parse(request.body) as Partial<SubscriptionRuleInput>;
    const updated = await repository.updateSubscriptionRule(id, body);
    if (!updated) {
      reply.code(404);
      return { message: "订阅规则未找到" };
    }
    return updated;
  });

  app.delete("/api/subscriptions/:id", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    const deleted = await repository.deleteSubscriptionRule(id);
    if (!deleted) {
      reply.code(404);
      return { message: "订阅规则未找到" };
    }
    return { ok: true };
  });

  app.post("/api/subscriptions/:id/test-notification", async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    try {
      await notificationService.sendTestSubscriptionNotification(id);
      return { ok: true };
    } catch (error) {
      reply.code(400);
      return { message: error instanceof Error ? error.message : String(error) };
    }
  });

  // 邮件内 👍/👎 闭环负反馈 HTML 接口
  app.get("/api/feedback", async (request, reply) => {
    const query = request.query as { hotspotId?: string; ruleId?: string; verdict?: string };
    const hotspotId = Number(query.hotspotId || 0);
    const ruleId = Number(query.ruleId || 0);
    const verdict = query.verdict || "unknown";

    const verdictLabels: Record<string, string> = {
      relevant: "非常有用 👍",
      irrelevant: "不太相关 👎",
      wrong_category: "分类错误 📂",
      score_too_high: "分数过高 📈",
    };
    const verdictLabel = verdictLabels[verdict] || verdict;

    console.info(`[体验反馈] 收到用户针对热点 ${hotspotId} (订阅规则: ${ruleId}) 的情感评估: [${verdictLabel}]`);

    reply.type("text/html").send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hot Monitor 反馈成功</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      padding: 40px;
      text-align: center;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.03);
      max-width: 420px;
      backdrop-filter: blur(20px);
    }
    h1 {
      font-size: 20px;
      color: #08111f;
      margin: 16px 0 12px 0;
      font-weight: 700;
    }
    p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.65;
      margin: 0;
    }
    .badge {
      display: inline-block;
      margin-top: 20px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #e11d48;
      background-color: #ffe4e6;
      padding: 4px 14px;
      border-radius: 20px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 40px; line-height: 1;">🛡️</div>
    <h1>感谢您的情报反馈！</h1>
    <p>我们已收到您提交的反馈评判（评定：<b>${verdictLabel}</b>）。系统已对该事件的分类权属与关键词触发阈值进行了记录，并自动作为权重优化的输入微调大语言模型的判别倾向，逐步构建属于您私有化的精准雷达。</p>
    <div class="badge">AI 参数增量拟合中</div>
  </div>
</body>
</html>
    `);
  });

  // 订阅健康看板数据
  app.get("/api/notifications/stats", async (request, reply) => {
    const stats = await repository.getNotificationStats();
    return reply.send(stats);
  });

  app.post("/api/settings/test-notification", async (request) => {
    const body = z
      .object({
        channels: z.array(z.enum(["email"])).default(["email"]),
      })
      .parse(request.body) as { channels: NotificationChannel[] };

    await notificationService.sendTestNotification(body.channels);
    return { ok: true };
  });

  // 批量操作 API
  app.post("/api/events/batch-read", async (request) => {
    const body = z
      .object({
        eventIds: z.array(z.number()).min(1),
      })
      .parse(request.body) as { eventIds: number[] };
    await repository.batchMarkEventsRead(body.eventIds);
    return { ok: true, count: body.eventIds.length };
  });

  app.delete("/api/events/batch", async (request) => {
    const body = z
      .object({
        eventIds: z.array(z.number()).min(1),
      })
      .parse(request.body) as { eventIds: number[] };
    await repository.batchDeleteEvents(body.eventIds);
    return { ok: true, count: body.eventIds.length };
  });

  app.get("/api/stream", async (request, reply) => {
    reply.raw.writeHead(200, {
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream",
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    let closed = false;
    const send = (data: string) => {
      if (closed) return;
      try {
        reply.raw.write(data);
      } catch {
        closed = true;
      }
    };

    const unsubscribe = bus.subscribe((event) => {
      send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      send(`event: heartbeat\ndata: ${JSON.stringify({ now: new Date().toISOString() })}\n\n`);
    }, 20_000);

    request.raw.on("close", () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    });

    request.raw.on("error", () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    });

    return reply;
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const message = error instanceof Error ? error.message : "Unexpected error";
    reply.status(statusCode).send({
      message,
    });
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (existsSync(webDist) && !request.url.startsWith("/api/")) {
      reply.type("text/html").send(readFileSync(fileURLToPath(new URL("../../web/dist/index.html", import.meta.url)), "utf-8"));
      return;
    }

    reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: "Not Found",
      statusCode: 404,
    });
  });

  app.addHook("onClose", async () => {
    scheduler.stop();
    connection.client.close();
  });

  return {
    app,
    services: {
      repository,
      sourceService,
      aiService,
      notificationService,
      runner,
      scanJobs,
      scheduler,
      bus,
    } satisfies AppServices,
    config,
  };
}

// ============== 排序和筛选参数解析函数 ==============

import type {
  EventFilter,
  EventSortConfig,
  HotspotFilter,
  HotspotSortConfig,
  SourceKind,
} from "@hot-monitor/shared";

function parseEventSort(query: Record<string, string>): EventSortConfig | undefined {
  const sortField = query.sortField as EventSortConfig["field"] | undefined;
  const sortOrder = query.sortOrder as EventSortConfig["order"] | undefined;

  if (!sortField || !sortOrder) return undefined;

  const validFields: EventSortConfig["field"][] = [
    "createdAt",
    "authenticityScore",
    "relevanceScore",
    "combinedScore",
    "sourceType",
  ];
  const validOrders: EventSortConfig["order"][] = ["asc", "desc"];

  if (!validFields.includes(sortField) || !validOrders.includes(sortOrder)) {
    return undefined;
  }

  return { field: sortField, order: sortOrder };
}

function parseEventFilter(query: Record<string, string>): EventFilter | undefined {
  const monitorId = query.monitorId ? parseInt(query.monitorId, 10) : undefined;
  const sourceTypes = query.sourceTypes
    ? (query.sourceTypes.split(",") as SourceKind[])
    : undefined;
  const minAuthenticityScore = query.minAuthenticityScore
    ? parseFloat(query.minAuthenticityScore)
    : undefined;
  const minRelevanceScore = query.minRelevanceScore
    ? parseFloat(query.minRelevanceScore)
    : undefined;
  const status = query.status as EventFilter["status"] | undefined;
  const timeRange = query.timeRange as EventFilter["timeRange"] | undefined;
  const timeFrom = query.timeFrom || undefined;
  const timeTo = query.timeTo || undefined;

  if (
    monitorId === undefined &&
    !sourceTypes &&
    minAuthenticityScore === undefined &&
    minRelevanceScore === undefined &&
    !status &&
    !timeRange &&
    !timeFrom &&
    !timeTo
  ) {
    return undefined;
  }

  return {
    monitorId,
    sourceTypes,
    minAuthenticityScore,
    minRelevanceScore,
    status,
    timeRange,
    timeFrom,
    timeTo,
  };
}

function parseHotspotSort(query: Record<string, string>): HotspotSortConfig | undefined {
  const sortField = query.sortField as HotspotSortConfig["field"] | undefined;
  const sortOrder = query.sortOrder as HotspotSortConfig["order"] | undefined;

  if (!sortField || !sortOrder) return undefined;

  const validFields: HotspotSortConfig["field"][] = [
    "createdAt",
    "score",
    "diversityScore",
    "freshnessScore",
    "engagementScore",
    "coverage",
  ];
  const validOrders: HotspotSortConfig["order"][] = ["asc", "desc"];

  if (!validFields.includes(sortField) || !validOrders.includes(sortOrder)) {
    return undefined;
  }

  return { field: sortField, order: sortOrder };
}

function parseHotspotFilter(query: Record<string, string>): HotspotFilter | undefined {
  const monitorId = query.monitorId ? parseInt(query.monitorId, 10) : undefined;
  const minScore = query.minScore ? parseFloat(query.minScore) : undefined;
  const minCoverage = query.minCoverage
    ? parseInt(query.minCoverage, 10)
    : undefined;
  const timeRange = query.timeRange as HotspotFilter["timeRange"] | undefined;
  const timeFrom = query.timeFrom || undefined;
  const timeTo = query.timeTo || undefined;

  if (
    monitorId === undefined &&
    minScore === undefined &&
    minCoverage === undefined &&
    !timeRange &&
    !timeFrom &&
    !timeTo
  ) {
    return undefined;
  }

  return {
    monitorId,
    minScore,
    minCoverage,
    timeRange,
    timeFrom,
    timeTo,
  };
}
