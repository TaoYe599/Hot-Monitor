import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { MonitorRecord, SourceItem } from "@hot-monitor/shared";

import { buildApp } from "../apps/server/src/app.ts";

function createTestConfig() {
  return {
    openRouterModel: "deepseek/deepseek-v3.2",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Smoke Test",
    webhookUrls: [],
    emailTo: [],
    smtp: { secure: false },
    vapid: { subject: "mailto:test@example.com" },
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:",
  };
}

function fakeCandidate(monitor: Pick<MonitorRecord, "query">): SourceItem {
  return {
    sourceKind: "rss",
    sourceLabel: "Smoke Test Feed",
    title: `Signal for ${monitor.query}`,
    url: `https://example.com/${encodeURIComponent(monitor.query)}`,
    publishedAt: new Date().toISOString(),
    author: "Smoke Tester",
    excerpt: `Fresh update about ${monitor.query}`,
    content: `A verified update about ${monitor.query} that should be accepted by the smoke test.`,
    engagementScore: 0.7,
    trustScore: 0.95,
    tags: [],
    raw: {},
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(label: string, task: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.warn(`${label} attempt ${attempt} failed, retrying...`);
        await delay(500 * attempt);
      }
    }
  }
  throw lastError;
}

function parseEnvFile(filepath: string): Record<string, string> {
  const text = readFileSync(filepath, "utf8");
  const env: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    env[key] = value;
  }
  return env;
}

function redact(value: string | undefined): string {
  if (!value) {
    return "EMPTY";
  }
  if (value.length <= 8) {
    return "SET";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function waitForJob(app: Awaited<ReturnType<typeof buildApp>>["app"], jobId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.inject({
      method: "GET",
      url: `/api/scan-jobs/${jobId}`,
    });
    assert.equal(response.statusCode, 200, "scan job should be readable");
    const job = response.json();
    if (job.status === "succeeded" || job.status === "failed") {
      return job;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for scan job ${jobId}`);
}

async function runLiveKeyChecks(): Promise<void> {
  const env = parseEnvFile(".env");
  const openRouterKey = env.OPENROUTER_API_KEY;
  const openRouterModel = env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const twitterApiKey = env.TWITTERAPI_IO_KEY;

  console.log("Live key checks:");
  console.log(`- OPENROUTER_API_KEY: ${redact(openRouterKey)}`);
  console.log(`- OPENROUTER_MODEL: ${openRouterModel || "EMPTY"}`);
  console.log(`- TWITTERAPI_IO_KEY: ${redact(twitterApiKey)}`);

  if (openRouterKey) {
    const response = await retry("OpenRouter key check", () =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": env.OPENROUTER_SITE_URL || "http://localhost:5173",
          "X-OpenRouter-Title": env.OPENROUTER_APP_NAME || "Hot Monitor Smoke Test",
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: [{ role: "user", content: "Reply with exactly the word OK." }],
          max_tokens: 8,
          temperature: 0,
        }),
      }),
    );

    const payload = await response.json().catch(() => null);
    assert.equal(response.ok, true, `OpenRouter key check failed with status ${response.status}`);
    const content = payload?.choices?.[0]?.message?.content;
    assert.equal(content, "OK", "OpenRouter key check returned an unexpected response");
    console.log("- OpenRouter key check: OK");
  } else {
    console.log("- OpenRouter key check: SKIPPED");
  }

  if (twitterApiKey) {
    const url = new URL("https://api.twitterapi.io/twitter/tweet/advanced_search");
    url.searchParams.set("query", "OpenAI");
    url.searchParams.set("queryType", "Latest");

    const response = await retry("twitterapi.io key check", () =>
      fetch(url, {
        headers: {
          "X-API-Key": twitterApiKey,
          Accept: "application/json",
        },
      }),
    );

    const payload = await response.json().catch(() => null);
    assert.equal(response.ok, true, `twitterapi.io key check failed with status ${response.status}`);
    assert.equal(Array.isArray(payload?.tweets), true, "twitterapi.io key check did not return tweets");
    assert.ok((payload?.tweets?.length ?? 0) > 0, "twitterapi.io key check returned zero tweets");
    console.log(`- twitterapi.io key check: OK (${payload.tweets.length} tweets)`);
  } else {
    console.log("- twitterapi.io key check: SKIPPED");
  }
}

async function main() {
  const notifications: Array<{ kind: string; title?: string; label?: string }> = [];

  const { app } = await buildApp({
    config: createTestConfig(),
    services: {
      sourceService: {
        async collect(monitor: MonitorRecord) {
          return [fakeCandidate(monitor)];
        },
      } as never,
      aiService: {
        async verifyKeywordCandidate(_monitor: MonitorRecord, candidate: SourceItem) {
          return {
            isMatch: true,
            authenticityScore: 0.96,
            relevanceScore: 0.94,
            reason: "Smoke test accepted the candidate.",
            summary: `Accepted candidate for ${candidate.title}`,
            evidence: [
              {
                quote: candidate.title,
                reason: "Synthetic smoke test evidence.",
              },
            ],
          };
        },
        async discoverHotspots(monitor: MonitorRecord, candidates: SourceItem[]) {
          return [
            {
              label: `${monitor.query} hotspot`,
              summary: `Clustered ${candidates.length} smoke test candidates for ${monitor.query}.`,
              score: 0.88,
              diversityScore: 0.72,
              freshnessScore: 0.91,
              engagementScore: 0.64,
              shouldNotify: true,
              reason: "Smoke test hotspot",
              supportingUrls: candidates.map((candidate) => candidate.url),
            },
          ];
        },
      } as never,
      notificationService: {
        async notifyEvent(event: { title: string }) {
          notifications.push({ kind: "event", title: event.title });
        },
        async notifyHotspot(hotspot: { label: string }) {
          notifications.push({ kind: "hotspot", label: hotspot.label });
        },
        async sendTestNotification() {
          notifications.push({ kind: "test" });
        },
      } as never,
    },
  });

  try {
    const health = await app.inject({ method: "GET", url: "/api/health" });
    assert.equal(health.statusCode, 200, "health endpoint should respond");

    const dashboard = await app.inject({ method: "GET", url: "/api/dashboard" });
    assert.equal(dashboard.statusCode, 200, "dashboard endpoint should respond");

    const createKeywordMonitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        name: "Smoke Keyword Task",
        mode: "keyword",
        query: "OpenAI GPT-5.4",
        description: "Keyword smoke test",
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
    assert.equal(createKeywordMonitor.statusCode, 201, "keyword monitor should be created");
    const keywordMonitor = createKeywordMonitor.json() as MonitorRecord;

    const runKeyword = await app.inject({
      method: "POST",
      url: `/api/monitors/${keywordMonitor.id}/run`,
      payload: {},
    });
    assert.equal(runKeyword.statusCode, 202, "manual scan should enqueue a job");
    const keywordJob = await waitForJob(app, runKeyword.json().id);
    assert.equal(keywordJob.status, "succeeded", "keyword job should complete");

    const events = await app.inject({ method: "GET", url: "/api/events" });
    assert.equal(events.statusCode, 200, "events endpoint should respond");
    assert.ok(events.json().length >= 1, "keyword scan should create at least one event");

    const createTopicMonitor = await app.inject({
      method: "POST",
      url: "/api/monitors",
      payload: {
        name: "Smoke Topic Task",
        mode: "topic",
        query: "OpenAI",
        description: "Topic smoke test",
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
    assert.equal(createTopicMonitor.statusCode, 201, "topic monitor should be created");
    const topicMonitor = createTopicMonitor.json() as MonitorRecord;

    const runTopic = await app.inject({
      method: "POST",
      url: `/api/monitors/${topicMonitor.id}/run`,
      payload: {},
    });
    assert.equal(runTopic.statusCode, 202, "topic scan should enqueue a job");
    const topicJob = await waitForJob(app, runTopic.json().id);
    assert.equal(topicJob.status, "succeeded", "topic job should complete");

    const hotspots = await app.inject({ method: "GET", url: "/api/hotspots" });
    assert.equal(hotspots.statusCode, 200, "hotspots endpoint should respond");
    assert.ok(hotspots.json().length >= 1, "topic scan should create at least one hotspot");

    const settings = await app.inject({ method: "GET", url: "/api/settings" });
    assert.equal(settings.statusCode, 200, "settings endpoint should respond");

    const patchSettings = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      payload: {
        webhookUrls: ["https://example.com/webhook"],
        emailTo: ["notify@example.com"],
        smtpHost: "smtp.example.com",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "tester",
        smtpPassword: "secret",
        smtpFrom: "bot@example.com",
        vapidPublicKey: "public",
        vapidPrivateKey: "private",
        vapidSubject: "mailto:test@example.com",
      },
    });
    assert.equal(patchSettings.statusCode, 200, "settings should be patchable");

    const testNotification = await app.inject({
      method: "POST",
      url: "/api/settings/test-notification",
      payload: {
        channels: ["push", "webhook", "email"],
      },
    });
    assert.equal(testNotification.statusCode, 200, "test notification endpoint should respond");

    const listJobs = await app.inject({ method: "GET", url: "/api/scan-jobs" });
    assert.equal(listJobs.statusCode, 200, "scan jobs endpoint should respond");
    assert.ok(listJobs.json().length >= 2, "scan jobs should be recorded");

    const deleteTopic = await app.inject({
      method: "DELETE",
      url: `/api/monitors/${topicMonitor.id}`,
    });
    assert.equal(deleteTopic.statusCode, 200, "topic monitor should be deletable");

    const deleteKeyword = await app.inject({
      method: "DELETE",
      url: `/api/monitors/${keywordMonitor.id}`,
    });
    assert.equal(deleteKeyword.statusCode, 200, "keyword monitor should be deletable");

    console.log("API smoke test passed.");
    console.log(`Notifications captured: ${notifications.length}`);
    console.log(`Last keyword job: ${keywordJob.id}`);
    console.log(`Last topic job: ${topicJob.id}`);
    await runLiveKeyChecks();
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error("API smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
