import type { MonitorRecord, SourceItem } from "@hot-monitor/shared";

export function nowIso(): string {
  return new Date().toISOString();
}

export function buildQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
}

export function generateQueryVariants(
  monitor: Pick<MonitorRecord, "query" | "mode">,
): string[] {
  const original = monitor.query.trim();
  const variants = new Set<string>([original]);

  if (monitor.mode === "keyword" || !original) {
    return Array.from(variants);
  }

  const collapsed = original.replace(/\s+/g, " ");
  variants.add(collapsed);

  const hyphenatedVersion = collapsed.replace(/\s+v(\d[\w.-]*)/gi, "-v$1");
  variants.add(hyphenatedVersion);

  const compactVersion = collapsed.replace(/\s+v(\d[\w.-]*)/gi, "V$1");
  variants.add(compactVersion);

  const baseTopic = collapsed.replace(/\bv\d[\w.-]*\b/gi, "").replace(/\s+/g, " ").trim();
  if (baseTopic.length >= 2) {
    variants.add(baseTopic);
  }

  const unhyphenated = collapsed.replace(/-/g, " ");
  variants.add(unhyphenated);

  return Array.from(variants).filter(Boolean);
}

export function includesQuery(query: string, text: string): boolean {
  const terms = buildQueryTerms(query);
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function matchesMonitorQuery(
  monitor: Pick<MonitorRecord, "query" | "mode">,
  text: string,
): boolean {
  if (monitor.mode === "keyword") {
    return includesQuery(monitor.query, text);
  }

  return generateQueryVariants(monitor).some(
    (variant) => keywordDensity(variant, text) >= 0.25,
  );
}

export function keywordDensity(query: string, text: string): number {
  const terms = buildQueryTerms(query);
  if (terms.length === 0) {
    return 0;
  }

  const haystack = text.toLowerCase();
  const hits = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);

  return hits / terms.length;
}

export function normalizeUrl(input: string): string {
  try {
    let urlString = input;

    if (urlString.includes("duckduckgo.com") && urlString.includes("uddg=")) {
      try {
        const parsed = new URL(urlString);
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) {
          urlString = decodeURIComponent(uddg);
        }
      } catch {
        // Fall through to normal parsing
      }
    }

    const url = new URL(urlString);
    url.hash = "";
    const trackingKeys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
    ];
    trackingKeys.forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch {
    return input;
  }
}

export function dedupeSourceItems(items: SourceItem[]): SourceItem[] {
  const seen = new Map<string, SourceItem>();

  for (const item of items) {
    const key = normalizeUrl(item.url);
    const existing = seen.get(key);
    if (!existing || existing.trustScore + existing.engagementScore < item.trustScore + item.engagementScore) {
      seen.set(key, { ...item, url: key });
    }
  }

  return Array.from(seen.values());
}

export function computeFreshnessScore(publishedAt: string | null): number {
  if (!publishedAt) {
    return 0.4;
  }

  const diffHours = Math.max(
    0,
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60),
  );

  if (diffHours <= 3) return 1;
  if (diffHours <= 12) return 0.82;
  if (diffHours <= 24) return 0.64;
  if (diffHours <= 72) return 0.48;
  return 0.24;
}

export function scoreCandidateForMonitor(
  monitor: Pick<MonitorRecord, "query" | "mode">,
  item: SourceItem,
): number {
  const density = keywordDensity(monitor.query, `${item.title}\n${item.excerpt}\n${item.content}`);
  const freshness = computeFreshnessScore(item.publishedAt);
  return Number(((density * 0.45) + (item.trustScore * 0.25) + (freshness * 0.2) + (item.engagementScore * 0.1)).toFixed(3));
}

export function compactText(text: string, maxLength = 2400): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function promiseTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
