import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

function createTestConfig() {
  return {
    openRouterModel: "deepseek/deepseek-v4-flash",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Test",
    webhookUrls: [],
    emailTo: [],
    smtp: { secure: false },
    vapid: { subject: "mailto:test@example.com" },
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:",
    thresholds: {
      preFilter: 0.2,
      relevance: 0.4,
      authenticity: 0.35,
    },
  };
}

// API tests are skipped by default because they may require network access
// depending on whether proxy is enabled.
describe("Hot Monitor API", () => {
  it.skip("creates a monitor and returns it in dashboard data", async () => {
    const { app } = await buildApp({ config: createTestConfig() });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        name: "Monitor GPT",
        mode: "keyword",
        query: "GPT-5.4",
        description: "watch GPT releases",
        intervalMinutes: 15,
        cooldownMinutes: 60,
        enabled: true,
        sources: {
          twitter: true,
          search: true,
          rss: true,
          github: true,
        },
        notifyChannels: ["push", "webhook", "email"],
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/dashboard",
    });

    expect(dashboardResponse.statusCode).toBe(200);
    const payload = dashboardResponse.json();
    expect(payload.monitors).toHaveLength(1);
    expect(payload.settings).toBeTruthy();

    await app.close();
  });

  it.skip("enqueues a background scan job for manual scans", async () => {
    const { app } = await buildApp({ config: createTestConfig() });

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        name: "Async Monitor",
        mode: "keyword",
        query: "OpenAI",
        description: "",
        intervalMinutes: 15,
        cooldownMinutes: 60,
        enabled: true,
        sources: {
          twitter: true,
          search: true,
          rss: true,
          github: true,
        },
        notifyChannels: ["push", "webhook", "email"],
      },
    });

    const monitor = createResponse.json();
    const runResponse = await app.inject({
      method: "POST",
      url: `/api/monitors/${monitor.id}/run`,
      payload: {},
    });

    expect(runResponse.statusCode).toBe(202);
    const job = runResponse.json();
    expect(job.monitorId).toBe(monitor.id);
    expect(["queued", "running"]).toContain(job.status);

    await app.close();
  });
});
