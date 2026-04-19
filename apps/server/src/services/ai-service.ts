import type {
  HotspotClusterOutput,
  MonitorRecord,
  SourceItem,
  VerifyKeywordOutput,
} from "@hot-monitor/shared";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import {
  buildQueryTerms,
  compactText,
  computeFreshnessScore,
  keywordDensity,
} from "../lib/utils.js";

const verifyKeywordSchema = z.object({
  isMatch: z.boolean(),
  authenticityScore: z.number().min(0).max(1),
  relevanceScore: z.number().min(0).max(1),
  reason: z.string(),
  summary: z.string(),
  evidence: z
    .array(
      z.object({
        quote: z.string(),
        reason: z.string(),
      }),
    )
    .max(3),
});

const discoverHotspotsSchema = z.object({
  clusters: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      score: z.number().min(0).max(1),
      diversityScore: z.number().min(0).max(1),
      freshnessScore: z.number().min(0).max(1),
      engagementScore: z.number().min(0).max(1),
      shouldNotify: z.boolean(),
      reason: z.string(),
      supportingUrls: z.array(z.string()).min(1),
    }),
  ),
});

export class AiService {
  constructor(private readonly config: AppConfig) {}

  private async postStructuredPrompt<TSchema extends z.ZodTypeAny>(
    schemaName: string,
    schema: TSchema,
    messages: Array<{ role: "system" | "user"; content: string }>,
  ): Promise<z.infer<TSchema> | null> {
    if (!this.config.openRouterApiKey) {
      return null;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.config.openRouterSiteUrl,
        "X-OpenRouter-Title": this.config.openRouterAppName,
      },
      body: JSON.stringify({
        model: this.config.openRouterModel,
        messages,
        plugins: [{ id: "response-healing" }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            strict: true,
            schema: z.toJSONSchema(schema),
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenRouter request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    return schema.parse(JSON.parse(content));
  }

  private heuristicVerify(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ): VerifyKeywordOutput {
    const text = `${candidate.title}\n${candidate.excerpt}\n${candidate.content}`.toLowerCase();
    const suspiciousMarkers = ["parody", "concept", "mockup", "fake", "rumor", "unofficial"];
    const suspicion = suspiciousMarkers.some((marker) => text.includes(marker)) ? 0.3 : 0;
    const relevance = Math.min(1, keywordDensity(monitor.query, text) + (candidate.trustScore * 0.15));
    const authenticity = Math.max(
      0,
      Math.min(1, (candidate.trustScore * 0.55) + (computeFreshnessScore(candidate.publishedAt) * 0.2) + 0.25 - suspicion),
    );
    const isMatch = relevance >= 0.55 && authenticity >= 0.45;

    return {
      isMatch,
      authenticityScore: Number(authenticity.toFixed(3)),
      relevanceScore: Number(relevance.toFixed(3)),
      reason: isMatch
        ? "The content aligns with the monitor query and comes from a credible signal."
        : "The content is either weakly related or has low authenticity signals.",
      summary: compactText(candidate.excerpt || candidate.title, 180),
      evidence: [
        {
          quote: compactText(candidate.title, 120),
          reason: "Title overlap with the monitored query.",
        },
        {
          quote: compactText(candidate.excerpt || candidate.content, 180),
          reason: "Body text used for the heuristic relevance check.",
        },
      ],
    };
  }

  async verifyKeywordCandidate(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidate: SourceItem,
  ): Promise<VerifyKeywordOutput> {
    const structured = await this.postStructuredPrompt(
      "verify_keyword_candidate",
      verifyKeywordSchema,
      [
        {
          role: "system",
          content:
            "You validate whether a candidate signal is a real, monitor-worthy update. Reject rumors, concept art, reposts without substance, and tangential mentions. Return concise evidence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            monitor,
            candidate: {
              sourceKind: candidate.sourceKind,
              sourceLabel: candidate.sourceLabel,
              title: candidate.title,
              url: candidate.url,
              publishedAt: candidate.publishedAt,
              author: candidate.author,
              excerpt: candidate.excerpt,
              content: compactText(candidate.content, 2800),
              trustScore: candidate.trustScore,
              engagementScore: candidate.engagementScore,
            },
          }),
        },
      ],
    );

    return structured ?? this.heuristicVerify(monitor, candidate);
  }

  private heuristicDiscover(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidates: SourceItem[],
  ): HotspotClusterOutput[] {
    const terms = buildQueryTerms(monitor.query);
    const shortlisted = candidates
      .filter((candidate) => terms.length === 0 || keywordDensity(monitor.query, `${candidate.title} ${candidate.excerpt}`) > 0.2)
      .sort((left, right) => {
        const leftScore = left.trustScore + left.engagementScore + computeFreshnessScore(left.publishedAt);
        const rightScore = right.trustScore + right.engagementScore + computeFreshnessScore(right.publishedAt);
        return rightScore - leftScore;
      })
      .slice(0, 5);

    return shortlisted.map((candidate) => ({
      label: compactText(candidate.title, 72),
      summary: compactText(candidate.excerpt || candidate.content, 180),
      score: Number(
        Math.min(
          1,
          (candidate.trustScore * 0.45) +
            (candidate.engagementScore * 0.25) +
            (computeFreshnessScore(candidate.publishedAt) * 0.3),
        ).toFixed(3),
      ),
      diversityScore: 0.45,
      freshnessScore: computeFreshnessScore(candidate.publishedAt),
      engagementScore: candidate.engagementScore,
      shouldNotify: candidate.trustScore >= 0.55,
      reason: "Fallback hotspot clustering based on freshness, trust, and engagement.",
      supportingUrls: [candidate.url],
    }));
  }

  async discoverHotspots(
    monitor: Pick<MonitorRecord, "name" | "query">,
    candidates: SourceItem[],
  ): Promise<HotspotClusterOutput[]> {
    const structured = await this.postStructuredPrompt(
      "discover_hotspots",
      discoverHotspotsSchema,
      [
        {
          role: "system",
          content:
            "You are an AI signal curator. Group the candidate items into 4 to 8 distinct high-signal hotspots when enough evidence exists. Separate different announcements even if they come from the same company. Prefer official or corroborated updates. Ignore low-signal duplicates and avoid collapsing unrelated updates into one hotspot.",
        },
        {
          role: "user",
          content: JSON.stringify({
            monitor,
            candidates: candidates.slice(0, 16).map((candidate) => ({
              sourceKind: candidate.sourceKind,
              sourceLabel: candidate.sourceLabel,
              title: candidate.title,
              url: candidate.url,
              publishedAt: candidate.publishedAt,
              excerpt: candidate.excerpt,
              trustScore: candidate.trustScore,
              engagementScore: candidate.engagementScore,
            })),
          }),
        },
      ],
    );

    return structured?.clusters ?? this.heuristicDiscover(monitor, candidates);
  }
}
