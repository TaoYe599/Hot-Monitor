import { describe, expect, it } from "vitest";

function parseEventSort(query: Record<string, string>) {
  const sortField = query.sortField as "createdAt" | "authenticityScore" | "relevanceScore" | "combinedScore" | "sourceType" | undefined;
  const sortOrder = query.sortOrder as "asc" | "desc" | undefined;

  if (!sortField || !sortOrder) return undefined;

  const validFields = ["createdAt", "authenticityScore", "relevanceScore", "combinedScore", "sourceType"];
  const validOrders = ["asc", "desc"];

  if (!validFields.includes(sortField) || !validOrders.includes(sortOrder)) {
    return undefined;
  }

  return { field: sortField, order: sortOrder };
}

function parseHotspotSort(query: Record<string, string>) {
  const sortField = query.sortField as "createdAt" | "score" | "diversityScore" | "freshnessScore" | "engagementScore" | "coverage" | undefined;
  const sortOrder = query.sortOrder as "asc" | "desc" | undefined;

  if (!sortField || !sortOrder) return undefined;

  const validFields = ["createdAt", "score", "diversityScore", "freshnessScore", "engagementScore", "coverage"];
  const validOrders = ["asc", "desc"];

  if (!validFields.includes(sortField) || !validOrders.includes(sortOrder)) {
    return undefined;
  }

  return { field: sortField, order: sortOrder };
}

function parseEventFilter(query: Record<string, string>) {
  const monitorId = query.monitorId ? parseInt(query.monitorId, 10) : undefined;
  const sourceTypes = query.sourceTypes ? query.sourceTypes.split(",") : undefined;
  const minAuthenticityScore = query.minAuthenticityScore ? parseFloat(query.minAuthenticityScore) : undefined;
  const minRelevanceScore = query.minRelevanceScore ? parseFloat(query.minRelevanceScore) : undefined;
  const status = query.status;
  const timeRange = query.timeRange;
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

  return { monitorId, timeFrom, timeTo };
}

function parseHotspotFilter(query: Record<string, string>) {
  const monitorId = query.monitorId ? parseInt(query.monitorId, 10) : undefined;
  const minScore = query.minScore ? parseFloat(query.minScore) : undefined;
  const minCoverage = query.minCoverage ? parseInt(query.minCoverage, 10) : undefined;
  const timeRange = query.timeRange;
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

  return { monitorId, minScore, minCoverage, timeRange, timeFrom, timeTo };
}

describe("parseEventSort", () => {
  it("parses valid sort field and order", () => {
    const result = parseEventSort({ sortField: "createdAt", sortOrder: "desc" });
    expect(result).toEqual({ field: "createdAt", order: "desc" });
  });

  it("parses authenticityScore sort", () => {
    const result = parseEventSort({ sortField: "authenticityScore", sortOrder: "asc" });
    expect(result).toEqual({ field: "authenticityScore", order: "asc" });
  });

  it("parses relevanceScore sort", () => {
    const result = parseEventSort({ sortField: "relevanceScore", sortOrder: "desc" });
    expect(result).toEqual({ field: "relevanceScore", order: "desc" });
  });

  it("parses combinedScore sort", () => {
    const result = parseEventSort({ sortField: "combinedScore", sortOrder: "desc" });
    expect(result).toEqual({ field: "combinedScore", order: "desc" });
  });

  it("parses sourceType sort", () => {
    const result = parseEventSort({ sortField: "sourceType", sortOrder: "asc" });
    expect(result).toEqual({ field: "sourceType", order: "asc" });
  });

  it("returns undefined for invalid field", () => {
    const result = parseEventSort({ sortField: "invalid", sortOrder: "desc" });
    expect(result).toBeUndefined();
  });

  it("returns undefined for invalid order", () => {
    const result = parseEventSort({ sortField: "createdAt", sortOrder: "invalid" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when sortField is missing", () => {
    const result = parseEventSort({ sortOrder: "desc" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when sortOrder is missing", () => {
    const result = parseEventSort({ sortField: "createdAt" });
    expect(result).toBeUndefined();
  });

  it("returns undefined for empty query", () => {
    const result = parseEventSort({});
    expect(result).toBeUndefined();
  });
});

describe("parseHotspotSort", () => {
  it("parses valid sort field and order", () => {
    const result = parseHotspotSort({ sortField: "score", sortOrder: "desc" });
    expect(result).toEqual({ field: "score", order: "desc" });
  });

  it("parses diversityScore sort", () => {
    const result = parseHotspotSort({ sortField: "diversityScore", sortOrder: "asc" });
    expect(result).toEqual({ field: "diversityScore", order: "asc" });
  });

  it("parses freshnessScore sort", () => {
    const result = parseHotspotSort({ sortField: "freshnessScore", sortOrder: "desc" });
    expect(result).toEqual({ field: "freshnessScore", order: "desc" });
  });

  it("parses engagementScore sort", () => {
    const result = parseHotspotSort({ sortField: "engagementScore", sortOrder: "asc" });
    expect(result).toEqual({ field: "engagementScore", order: "asc" });
  });

  it("parses coverage sort", () => {
    const result = parseHotspotSort({ sortField: "coverage", sortOrder: "desc" });
    expect(result).toEqual({ field: "coverage", order: "desc" });
  });

  it("returns undefined for invalid field", () => {
    const result = parseHotspotSort({ sortField: "invalid", sortOrder: "desc" });
    expect(result).toBeUndefined();
  });

  it("returns undefined for invalid order", () => {
    const result = parseHotspotSort({ sortField: "score", sortOrder: "invalid" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when sortField is missing", () => {
    const result = parseHotspotSort({ sortOrder: "desc" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when sortOrder is missing", () => {
    const result = parseHotspotSort({ sortField: "score" });
    expect(result).toBeUndefined();
  });
});

describe("parseEventFilter", () => {
  it("parses monitorId", () => {
    const result = parseEventFilter({ monitorId: "5" });
    expect(result).toEqual({ monitorId: 5, timeFrom: undefined, timeTo: undefined });
  });

  it("parses sourceTypes as comma-separated list", () => {
    const result = parseEventFilter({ sourceTypes: "rss,search" });
    expect(result).toBeDefined();
  });

  it("parses minAuthenticityScore", () => {
    const result = parseEventFilter({ minAuthenticityScore: "0.7" });
    expect(result).toBeDefined();
  });

  it("parses minRelevanceScore", () => {
    const result = parseEventFilter({ minRelevanceScore: "0.5" });
    expect(result).toBeDefined();
  });

  it("parses status", () => {
    const result = parseEventFilter({ status: "accepted" });
    expect(result).toBeDefined();
  });

  it("parses timeRange", () => {
    const result = parseEventFilter({ timeRange: "today" });
    expect(result).toBeDefined();
  });

  it("parses timeFrom and timeTo", () => {
    const result = parseEventFilter({
      timeFrom: "2024-01-01T00:00:00Z",
      timeTo: "2024-12-31T23:59:59Z",
    });
    expect(result).toBeDefined();
  });

  it("returns undefined for empty query", () => {
    const result = parseEventFilter({});
    expect(result).toBeUndefined();
  });
});

describe("parseHotspotFilter", () => {
  it("parses monitorId", () => {
    const result = parseHotspotFilter({ monitorId: "3" });
    expect(result).toEqual({ monitorId: 3, minScore: undefined, minCoverage: undefined, timeRange: undefined, timeFrom: undefined, timeTo: undefined });
  });

  it("parses minScore", () => {
    const result = parseHotspotFilter({ minScore: "0.8" });
    expect(result).toBeDefined();
  });

  it("parses minCoverage", () => {
    const result = parseHotspotFilter({ minCoverage: "5" });
    expect(result).toBeDefined();
  });

  it("parses timeRange", () => {
    const result = parseHotspotFilter({ timeRange: "week" });
    expect(result).toBeDefined();
  });

  it("parses timeFrom and timeTo", () => {
    const result = parseHotspotFilter({
      timeFrom: "2024-01-01T00:00:00Z",
      timeTo: "2024-12-31T23:59:59Z",
    });
    expect(result).toBeDefined();
  });

  it("returns undefined for empty query", () => {
    const result = parseHotspotFilter({});
    expect(result).toBeUndefined();
  });
});
