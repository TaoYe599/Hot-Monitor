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

/**
 * Query Expansion - 关键词拓展策略
 *
 * 将单个关键词拆分为多个变体，用于提高检索召回率：
 * - 核心词拆分："Claude Opus 4" → ["Claude", "Opus", "4", "claude opus 4"]
 * - 版本号变体："v1.2.3" → ["v1.2.3", "1.2.3", "v1.2", "1.2"]
 * - 常见变体："OpenAI" → ["OpenAI", "Open AI"]
 * - 去重和清理
 */
export function expandQuery(query: string): string[] {
  const variants = new Set<string>();

  // 规范化：去除多余空格，转小写
  const normalized = query.trim().toLowerCase();
  if (normalized) {
    variants.add(normalized);
  }

  // 拆分词组，每个词都作为独立变体
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  // 添加每个独立词作为变体（用于预过滤）
  for (const word of words) {
    if (word.length > 1) {
      variants.add(word);
    }
  }

  // 处理版本号变体：v1.2.3, 1.2.3, v1.2, 1.2
  const versionPattern = /v?(\d+[\d.-]*)/gi;
  let match;
  while ((match = versionPattern.exec(normalized)) !== null) {
    const version = match[1];
    // 添加带v和不带v的完整版本号
    if (version.includes(".")) {
      variants.add(`v${version}`);
      variants.add(version);
      // 添加主版本号
      const parts = version.split(".");
      if (parts.length >= 2) {
        variants.add(`v${parts[0]}.${parts[1]}`);
        variants.add(`${parts[0]}.${parts[1]}`);
      }
    }
  }

  // 常见品牌/公司名称变体
  const knownVariants: Record<string, string[]> = {
    openai: ["openai", "open ai", "open-ai"],
    anthropic: ["anthropic"],
    claude: ["claude"],
    chatgpt: ["chatgpt", "chat gpt", "gpt", "gpt-4", "gpt4"],
    "gpt-4": ["gpt-4", "gpt4", "gpt 4"],
    "gpt5": ["gpt-5", "gpt5", "gpt 5"],
    gemini: ["gemini", "google gemini"],
    llama: ["llama", "meta llama", "llama2", "llama-2", "llama3", "llama-3"],
    mistral: ["mistral", "mistral ai"],
    deepseek: ["deepseek", "deep seek"],
    qwen: ["qwen", "qwen-turbo"],
    stable_diffusion: ["stable diffusion", "stability ai", "sdxl"],
    dalle: ["dall-e", "dalle", "dall e"],
  };

  for (const [key, values] of Object.entries(knownVariants)) {
    if (normalized.includes(key.replace(/_/g, " "))) {
      values.forEach((v) => variants.add(v));
    }
  }

  // 常见连字符/空格变体
  for (const word of words) {
    if (word.includes("-")) {
      variants.add(word.replace(/-/g, " "));
    } else if (word.includes(" ")) {
      variants.add(word.replace(/ /g, "-"));
    }
  }

  // 过滤：只保留有意义的变体（长度>=2，或者完整的原始查询）
  return Array.from(variants).filter(
    (v) => v.length >= 2 || v === normalized,
  );
}

/**
 * 使用扩展词列表计算关键词密度
 * 与 keywordDensity 不同，这里接收预先生成的扩展词列表
 */
export function keywordDensityWithExpansion(
  expandedTerms: string[],
  text: string,
): number {
  if (expandedTerms.length === 0) {
    return 0;
  }

  const haystack = text.toLowerCase();
  let hits = 0;

  for (const term of expandedTerms) {
    if (haystack.includes(term)) {
      hits++;
    }
  }

  return hits / expandedTerms.length;
}

export function generateQueryVariants(
  monitor: Pick<MonitorRecord, "query">,
): string[] {
  const original = monitor.query.trim();
  const variants = new Set<string>([original]);

  if (!original) {
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
  monitor: Pick<MonitorRecord, "query">,
  text: string,
): boolean {
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
  monitor: Pick<MonitorRecord, "query">,
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
