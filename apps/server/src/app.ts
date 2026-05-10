import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { MonitorFormInput, NotificationChannel, SettingsFormInput } from "@hot-monitor/shared";
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
      google: z.boolean().default(true),
      rss: z.boolean().default(true),
      github: z.boolean().default(true),
      hackernews: z.boolean().default(true),
      zhihu: z.boolean().default(true),
      baidu: z.boolean().default(true),
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
    options.services?.runner ?? new ScanRunner(repository, sourceService, aiService, notificationService, bus);
  const scanJobs = options.services?.scanJobs ?? new ScanJobService(runner, bus);
  const scheduler = options.services?.scheduler ?? new MonitorScheduler(repository, scanJobs);

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
    return repository.listHotspots(limit, sort, filter);
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

  app.post("/api/settings/test-notification", async (request) => {
    const body = z
      .object({
        channels: z.array(z.enum(["email"])).default(["email"]),
      })
      .parse(request.body) as { channels: NotificationChannel[] };

    await notificationService.sendTestNotification(body.channels);
    return { ok: true };
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
