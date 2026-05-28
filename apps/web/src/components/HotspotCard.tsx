import type { HotspotCluster, HotspotEngagementAggregates, SourceKind, HotspotEventSummary } from "@hot-monitor/shared";
import React, { useState } from "react";

interface HotspotCardProps {
  hotspot: HotspotCluster & { events?: HotspotEventSummary[] };
}

// 来源映射
const SOURCE_LABELS: Record<SourceKind, string> = {
  twitter: "Twitter",
  search: "搜索",
  google: "Google",
  rss: "官方博客",
  github: "GitHub",
  hackernews: "Hacker News",
  zhihu: "知乎",
  baidu: "百度",
  weibo: "微博",
  reddit: "Reddit",
  manual: "手动",
  bing: "必应",
};

// 来源图标（低饱和度单色 Unicode/svg）
const SOURCE_ICONS: Record<SourceKind, string> = {
  twitter: "𝕏",
  github: "🐙",
  hackernews: "HN",
  zhihu: "知",
  weibo: "微",
  reddit: "R",
  baidu: "百",
  google: "G",
  rss: "📰",
  search: "🔍",
  manual: "✎",
  bing: "必",
};

// 从 URL 解析来源类型
function parseSourceFromUrl(url: string): SourceKind {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "twitter";
    if (hostname.includes("news.ycombinator.com")) return "hackernews";
    if (hostname.includes("reddit.com")) return "reddit";
    if (hostname.includes("zhihu.com")) return "zhihu";
    if (hostname.includes("baidu.com")) return "baidu";
    if (hostname.includes("weibo.com")) return "weibo";
    if (hostname.includes("github.com")) return "github";
    if (hostname.includes("google.com")) return "google";
    return "search";
  } catch {
    return "search";
  }
}

// 格式化相对时间
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 格式化百分比
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

// 获取来源类型统计
function getSourceTypes(urls: string[]): { kind: SourceKind; label: string; count: number }[] {
  const typeMap = new Map<SourceKind, number>();
  for (const url of urls) {
    const kind = parseSourceFromUrl(url);
    typeMap.set(kind, (typeMap.get(kind) || 0) + 1);
  }
  return Array.from(typeMap.entries()).map(([kind, count]) => ({
    kind,
    label: SOURCE_LABELS[kind] || kind,
    count,
  }));
}

// 渲染互动数据聚合
function renderEngagementAggregates(
  aggregates: HotspotEngagementAggregates | null | undefined,
  sourceTypes: { kind: SourceKind; label: string; count: number }[],
): React.ReactNode {
  if (!aggregates) return null;

  const items: React.ReactNode[] = [];
  const hasTwitter = sourceTypes.some((s) => s.kind === "twitter");
  const hasHackerNews = sourceTypes.some((s) => s.kind === "hackernews");

  if (hasTwitter) {
    if (aggregates.totalLikes) items.push(`${formatNumber(aggregates.totalLikes)} 赞`);
    if (aggregates.totalRetweets) items.push(`${formatNumber(aggregates.totalRetweets)} 转发`);
    if (aggregates.totalViews) items.push(`${formatNumber(aggregates.totalViews)} 浏览`);
  }
  if (hasHackerNews) {
    if (aggregates.totalPoints) items.push(`${formatNumber(aggregates.totalPoints)} 票`);
    if (aggregates.totalComments) items.push(`${formatNumber(aggregates.totalComments)} 评论`);
  }
  if (aggregates.totalUpvotes && !hasTwitter) items.push(`${formatNumber(aggregates.totalUpvotes)} 赞`);

  return items.join(" · ");
}

// 单个事件摘要行（去色块，纯排版）
function EventSummaryItem({ event }: { event: HotspotEventSummary }) {
  return (
    <div className="pt-3 first:pt-0">
      {/* 来源 · 作者 · 时间 · 评分 */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{SOURCE_ICONS[event.sourceType] || "📌"}</span>
        <span>{SOURCE_LABELS[event.sourceType] || event.sourceLabel}</span>
        {event.author && (
          <>
            <span>·</span>
            <span>@{event.author}</span>
          </>
        )}
        {event.publishedAt && (
          <>
            <span>·</span>
            <span>{formatRelativeTime(event.publishedAt)}</span>
          </>
        )}
        <span>·</span>
        <span>真实 {Math.round(event.authenticityScore * 100)}%</span>
        <span>·</span>
        <span>相关 {Math.round(event.relevanceScore * 100)}%</span>
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity"
          title="查看原文"
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      {/* 标题 */}
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-sm font-medium leading-snug text-[var(--ink)] hover:text-[var(--ember)] transition-colors truncate"
        title={event.title}
      >
        {event.title}
      </a>
      {/* 互动数据 */}
      {event.engagementDetails && (() => {
        const parts: string[] = [];
        if (event.engagementDetails.likes) parts.push(`${formatNumber(event.engagementDetails.likes)} 赞`);
        if (event.engagementDetails.retweets) parts.push(`${formatNumber(event.engagementDetails.retweets)} 转`);
        if (event.engagementDetails.views) parts.push(`${formatNumber(event.engagementDetails.views)} 浏览`);
        if (event.engagementDetails.points) parts.push(`${formatNumber(event.engagementDetails.points)} 票`);
        if (event.engagementDetails.comments) parts.push(`${formatNumber(event.engagementDetails.comments)} 评论`);
        if (event.engagementDetails.score !== undefined) parts.push(`${formatNumber(event.engagementDetails.score)} 赞`);
        return parts.length > 0 ? (
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {parts.join(" · ")}
          </div>
        ) : null;
      })()}
    </div>
  );
}

// 事件摘要列表
function EventSummaryList({ events }: { events: HotspotEventSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayEvents = showAll ? events : events.slice(0, 3);
  const hasMore = events.length > 3;

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(8,17,31,0.06)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>关联事件 ({events.length})</span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-[var(--ember)] hover:underline"
          >
            {showAll ? "收起" : `查看全部 ${events.length} 个`}
          </button>
        )}
      </div>
      <div className="mt-2">
        {displayEvents.map((event) => (
          <EventSummaryItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

export function HotspotCard({
  hotspot,
}: HotspotCardProps) {
  const [showSources, setShowSources] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const sourceTypes = getSourceTypes(hotspot.supportingUrls);
  const totalScore = hotspot.score;

  return (
    <article
      className={`relative mb-4 transition-all duration-300 ease-out`}
      style={{
        background: "var(--card-bg)",
        borderRadius: "var(--card-radius)",
        padding: "24px",
        boxShadow: isHovered ? "var(--card-shadow-hover)" : "var(--card-shadow)",
        transform: isHovered ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 操作按钮 - 右上角，hover 时淡入 */}
      <div
        className="absolute top-4 right-4 flex items-center gap-1 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <button
          type="button"
          className="rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(8,17,31,0.04)] transition-all"
          title="置顶"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(8,17,31,0.04)] transition-all"
          title="停用监控"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button
          type="button"
          className="rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(240,107,56,0.1)] hover:text-[var(--ember)] transition-all"
          title="删除"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 信任锚点线 */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {/* 多来源图标串 */}
        {sourceTypes.slice(0, 2).map(({ kind }) => (
          <span key={kind} className="tracking-tight">{SOURCE_ICONS[kind]}</span>
        ))}
        {sourceTypes.length > 2 && (
          <span>+{sourceTypes.length - 2} 个来源</span>
        )}
        <span>·</span>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>全网热度 {formatPercent(totalScore)}</span>
        <span>·</span>
        {(() => {
          const engagement = hotspot.engagementAggregates;
          if (!engagement) return <span>多源聚合</span>;
          const parts: string[] = [];
          if (engagement.totalLikes) parts.push(`${formatNumber(engagement.totalLikes)} 赞`);
          if (engagement.totalRetweets) parts.push(`${formatNumber(engagement.totalRetweets)} 转发`);
          if (engagement.totalViews) parts.push(`${formatNumber(engagement.totalViews)} 浏览`);
          return parts.length > 0 ? parts.join(" · ") : "多源聚合";
        })()}
        <span>·</span>
        {(() => {
          const pubTime = hotspot.latestPublishedAt || hotspot.earliestPublishedAt;
          return pubTime ? (
            <span title={`原始发布时间: ${new Date(pubTime).toLocaleString()}`}>
              发布于 {formatRelativeTime(pubTime)}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>发布时间未知</span>
          );
        })()}
        <span>·</span>
        <span title={`系统采集时间: ${new Date(hotspot.createdAt).toLocaleString()}`}>
          采集于 {formatRelativeTime(hotspot.createdAt)}
        </span>
      </div>

      {/* 标题 */}
      <h3
        className="mt-3 font-semibold leading-snug"
        style={{ fontSize: 16, color: "#111111", lineHeight: 1.4 }}
      >
        {hotspot.label}
      </h3>

      {/* AI 智能总结 */}
      <p
        className="mt-2"
        style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, fontWeight: 400 }}
      >
        {hotspot.summary}
      </p>

      {/* 原始来源链路（胶囊按钮，常态极弱，hover 加深） */}
      {hotspot.supportingUrls.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hotspot.supportingUrls.slice(0, 3).map((url, i) => {
            const kind = parseSourceFromUrl(url);
            return (
              <a
                key={`${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs transition-colors"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid rgba(8,17,31,0.1)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 11,
                  opacity: 0.6,
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.opacity = "1";
                  (e.target as HTMLElement).style.color = "var(--ember)";
                  (e.target as HTMLElement).style.borderColor = "var(--ember)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.opacity = "0.6";
                  (e.target as HTMLElement).style.color = "var(--text-muted)";
                  (e.target as HTMLElement).style.borderColor = "rgba(8,17,31,0.1)";
                }}
              >
                {SOURCE_ICONS[kind]} {SOURCE_LABELS[kind]}
                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })}
          {hotspot.supportingUrls.length > 3 && (
            <button
              type="button"
              onClick={() => setShowSources(!showSources)}
              className="inline-flex items-center gap-1 text-xs transition-colors"
              style={{ color: "var(--text-muted)", border: "1px solid rgba(8,17,31,0.1)", borderRadius: 999, padding: "2px 8px", fontSize: 11, opacity: 0.6 }}
            >
              +{hotspot.supportingUrls.length - 3} 更多
            </button>
          )}
        </div>
      )}

      {/* 来源链接展开 */}
      {showSources && hotspot.supportingUrls.length > 3 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hotspot.supportingUrls.slice(3).map((url, i) => {
            const kind = parseSourceFromUrl(url);
            return (
              <a
                key={`extra-${url}-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs transition-colors"
                style={{ color: "var(--text-muted)", border: "1px solid rgba(8,17,31,0.1)", borderRadius: 999, padding: "2px 8px", fontSize: 11, opacity: 0.6 }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.opacity = "1";
                  (e.target as HTMLElement).style.color = "var(--ember)";
                  (e.target as HTMLElement).style.borderColor = "var(--ember)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.opacity = "0.6";
                  (e.target as HTMLElement).style.color = "var(--text-muted)";
                  (e.target as HTMLElement).style.borderColor = "rgba(8,17,31,0.1)";
                }}
              >
                {SOURCE_ICONS[kind]} {SOURCE_LABELS[kind]}
              </a>
            );
          })}
        </div>
      )}

      {/* AI 研判理由 - 默认展开 */}
      {hotspot.reason && (
        <p
          className="mt-3 leading-relaxed"
          style={{ fontSize: 12, color: "var(--text-reason)", fontStyle: "italic", lineHeight: 1.7 }}
        >
          <svg className="inline w-3 h-3 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {hotspot.reason}
        </p>
      )}

      {/* 关联事件详情列表 */}
      {hotspot.events && hotspot.events.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEvents(!showEvents)}
            className="flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--ember)]"
            style={{ color: "var(--text-muted)", fontSize: 11 }}
          >
            <svg className={`w-3 h-3 transition-transform ${showEvents ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            关联事件 ({hotspot.events.length})
          </button>
          {showEvents && <EventSummaryList events={hotspot.events} />}
        </div>
      )}
    </article>
  );
}

export default HotspotCard;
