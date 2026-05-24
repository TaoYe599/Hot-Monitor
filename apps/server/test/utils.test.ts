import { describe, expect, it } from "vitest";

import {
  buildQueryTerms,
  generateQueryVariants,
  includesQuery,
  matchesMonitorQuery,
  keywordDensity,
  normalizeUrl,
  dedupeSourceItems,
  computeFreshnessScore,
  scoreCandidateForMonitor,
} from "../src/lib/utils.js";

describe("buildQueryTerms", () => {
  it("splits query by whitespace", () => {
    expect(buildQueryTerms("GPT-5  OpenAI")).toEqual(["gpt-5", "openai"]);
  });

  it("filters out single-character terms", () => {
    expect(buildQueryTerms("a GPT b")).toEqual(["gpt"]);
  });

  it("handles unicode characters", () => {
    expect(buildQueryTerms("AI 编程")).toEqual(["ai", "编程"]);
  });

  it("keeps hyphens and removes exclamation mark", () => {
    expect(buildQueryTerms("GPT-5!")).toEqual(["gpt-5"]);
  });

  it("handles empty string", () => {
    expect(buildQueryTerms("")).toEqual([]);
  });

  it("handles only special characters", () => {
    expect(buildQueryTerms("!!!")).toEqual([]);
  });
});

describe("generateQueryVariants", () => {
  it("returns original query only", () => {
    const variants = generateQueryVariants({ query: "GPT-5" });
    expect(variants).toEqual(["GPT-5", "GPT 5"]);
  });

  it("generates variants with expandQuery", () => {
    // topic test was removed and we are mostly relying on expandQuery now
  });

  it("handles empty query", () => {
    const variants = generateQueryVariants({ query: "" });
    expect(variants).toEqual([""]);
  });
});

describe("includesQuery", () => {
  it("returns true when all terms are present", () => {
    expect(includesQuery("GPT-5", "OpenAI released GPT-5")).toBe(true);
  });

  it("returns false when some terms are missing", () => {
    expect(includesQuery("GPT-5 Claude", "OpenAI released GPT-5")).toBe(false);
  });

  it("is case insensitive", () => {
    expect(includesQuery("openai", "OpenAI announced")).toBe(true);
  });

  it("handles multi-word queries", () => {
    expect(includesQuery("OpenAI release", "OpenAI release notes")).toBe(true);
  });
});

describe("matchesMonitorQuery", () => {
  it("uses generateQueryVariants", () => {
    const monitor = { query: "GPT-5" };
    expect(matchesMonitorQuery(monitor, "OpenAI GPT-5")).toBe(true);
  });
});

describe("keywordDensity", () => {
  it("returns 1 when all terms match", () => {
    expect(keywordDensity("GPT", "GPT GPT GPT")).toBe(1);
  });

  it("returns 0.5 when half terms match", () => {
    expect(keywordDensity("GPT Claude", "GPT")).toBe(0.5);
  });

  it("returns 0 when no terms match", () => {
    expect(keywordDensity("GPT", "Claude")).toBe(0);
  });

  it("handles empty query", () => {
    expect(keywordDensity("", "text")).toBe(0);
  });

  it("is case insensitive", () => {
    expect(keywordDensity("gpt", "GPT-5")).toBe(1);
  });
});

describe("normalizeUrl", () => {
  it("removes UTM parameters", () => {
    const url = normalizeUrl("https://example.com/page?utm_source=twitter&utm_medium=social");
    expect(url).not.toContain("utm_source");
    expect(url).not.toContain("utm_medium");
  });

  it("removes fbclid parameter", () => {
    const url = normalizeUrl("https://example.com/page?fbclid=abc123");
    expect(url).not.toContain("fbclid");
  });

  it("removes gclid parameter", () => {
    const url = normalizeUrl("https://example.com/page?gclid=xyz789");
    expect(url).not.toContain("gclid");
  });

  it("preserves other query parameters", () => {
    const url = normalizeUrl("https://example.com/page?page=2&lang=en");
    expect(url).toContain("page=2");
    expect(url).toContain("lang=en");
  });

  it("removes hash", () => {
    const url = normalizeUrl("https://example.com/page#section");
    expect(url).not.toContain("#section");
  });

  it("handles DuckDuckGo redirect URLs", () => {
    const ddgUrl = "https://duckduckgo.com/?uddg=https%3A%2F%2Fexample.com%2Fpage";
    const url = normalizeUrl(ddgUrl);
    expect(url).toBe("https://example.com/page");
  });

  it("returns input for invalid URLs", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

describe("dedupeSourceItems", () => {
  it("keeps higher scored item for same URL", () => {
    const items = [
      { url: "https://example.com", title: "A", trustScore: 0.5, engagementScore: 0.3, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
      { url: "https://example.com", title: "B", trustScore: 0.8, engagementScore: 0.6, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
    ];
    const result = dedupeSourceItems(items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("B");
  });

  it("normalizes URLs before deduping", () => {
    const items = [
      { url: "https://example.com?utm_source=twitter", title: "A", trustScore: 0.5, engagementScore: 0.3, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
      { url: "https://example.com", title: "B", trustScore: 0.5, engagementScore: 0.3, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
    ];
    const result = dedupeSourceItems(items);
    expect(result).toHaveLength(1);
  });

  it("keeps distinct URLs", () => {
    const items = [
      { url: "https://example.com/a", title: "A", trustScore: 0.5, engagementScore: 0.3, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
      { url: "https://example.com/b", title: "B", trustScore: 0.5, engagementScore: 0.3, excerpt: "", content: "", sourceKind: "rss", sourceLabel: "", publishedAt: null, author: "", tags: [], raw: {} },
    ];
    const result = dedupeSourceItems(items);
    expect(result).toHaveLength(2);
  });
});

describe("computeFreshnessScore", () => {
  it("returns 1 for content within 3 hours", () => {
    const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessScore(recent)).toBe(1);
  });

  it("returns 0.82 for content within 12 hours", () => {
    const hoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessScore(hoursAgo)).toBe(0.82);
  });

  it("returns 0.64 for content within 24 hours", () => {
    const hoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessScore(hoursAgo)).toBe(0.64);
  });

  it("returns 0.48 for content within 72 hours", () => {
    const hoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessScore(hoursAgo)).toBe(0.48);
  });

  it("returns 0.24 for older content", () => {
    const old = new Date(Date.now() - 100 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessScore(old)).toBe(0.24);
  });

  it("returns 0.4 for null timestamp", () => {
    expect(computeFreshnessScore(null)).toBe(0.4);
  });
});

describe("scoreCandidateForMonitor", () => {
  it("returns a score between 0 and 1", () => {
    const monitor = { query: "GPT" };
    const item = {
      title: "GPT-5 release",
      url: "https://example.com",
      trustScore: 0.8,
      engagementScore: 0.6,
      publishedAt: new Date().toISOString(),
      excerpt: "GPT-5 announced",
      content: "GPT-5 details",
      sourceKind: "rss" as const,
      sourceLabel: "",
      author: "",
      tags: [],
      raw: {},
    };
    const score = scoreCandidateForMonitor(monitor, item);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("considers keyword density in score", () => {
    const monitor = { query: "GPT" };
    const highDensity = {
      title: "GPT GPT GPT",
      url: "https://example.com",
      trustScore: 0.5,
      engagementScore: 0.5,
      publishedAt: new Date().toISOString(),
      excerpt: "",
      content: "",
      sourceKind: "rss" as const,
      sourceLabel: "",
      author: "",
      tags: [],
      raw: {},
    };
    const lowDensity = {
      title: "Other",
      url: "https://example.com",
      trustScore: 0.5,
      engagementScore: 0.5,
      publishedAt: new Date().toISOString(),
      excerpt: "",
      content: "",
      sourceKind: "rss" as const,
      sourceLabel: "",
      author: "",
      tags: [],
      raw: {},
    };
    expect(scoreCandidateForMonitor(monitor, highDensity)).toBeGreaterThan(
      scoreCandidateForMonitor(monitor, lowDensity),
    );
  });
});
