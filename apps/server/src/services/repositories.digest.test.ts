import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

function createTestConfig() {
  return {
    openRouterModel: "deepseek/deepseek-v4-flash",
    openRouterSiteUrl: "http://localhost:5173",
    openRouterAppName: "Hot Monitor Test",
    mimoBaseUrl: "https://api.xiaomimimo.com/v1",
    mimoModel: "mimo-v2.5-pro",
    webhookUrls: [],
    emailTo: [],
    smtp: { secure: false },
    vapid: { subject: "mailto:test@example.com" },
    port: 8787,
    publicUrl: "http://localhost:8787",
    databasePath: ":memory:",
    thresholds: {
      preFilter: 0.1,
      relevance: 0.3,
      authenticity: 0.3,
    },
  };
}

describe("digest sent source tracking", () => {
  it("deduplicates source URLs before recording digest history", async () => {
    const { app, services } = await buildApp({ config: createTestConfig() });
    const { repository } = services;

    try {
      await repository.recordDigestSentSources(
        7,
        [
          {
            hotspotId: 101,
            sourceUrls: ["https://example.com/a", "https://example.com/a"],
          },
          {
            hotspotId: 102,
            sourceUrls: ["https://example.com/a", "https://example.com/b"],
          },
        ],
        "2026-06-07T09:00:00.000Z",
      );

      const recent = await repository.listRecentDigestSourceUrls(
        7,
        "2026-06-01T00:00:00.000Z",
      );

      expect([...recent].sort()).toEqual([
        "https://example.com/a",
        "https://example.com/b",
      ]);
    } finally {
      await app.close();
    }
  });
});
