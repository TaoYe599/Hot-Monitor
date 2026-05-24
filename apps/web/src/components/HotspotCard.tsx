import type { HotspotCluster, HotspotEngagementAggregates, SourceKind, HotspotEventSummary } from "@hot-monitor/shared";
import React, { useState } from "react";

interface HotspotCardProps {
  hotspot: HotspotCluster & { events?: HotspotEventSummary[] };
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  expandedReasons?: Set<number>;
  onToggleReason?: (id: number) => void;
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

// 获取来源显示名称
function getSourceDisplay(url: string): string {
  const kind = parseSourceFromUrl(url);
  return SOURCE_LABELS[kind] || kind;
}

// 获取来源唯一标识（用于显示多个来源）
function getSourceKey(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname;
  } catch {
    return url.slice(0, 20);
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

// 获取时间颜色类名
function getTimeColorClass(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "text-red-500 font-semibold";
  if (diffHours < 6) return "text-orange-500 font-medium";
  if (diffHours < 24) return "text-yellow-600";
  return "text-[var(--ink-soft)]";
}

// 格式化百分比
function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// 获取评分颜色
function getScoreColorClass(score: number): string {
  if (score >= 0.8) return "bg-[var(--ember-soft)] text-[var(--ember)]";
  if (score >= 0.6) return "bg-yellow-100 text-yellow-700";
  if (score >= 0.4) return "bg-orange-100 text-orange-700";
  return "bg-[rgba(8,17,31,0.06)] text-[var(--ink-soft)]";
}

// 渲染事件互动数据（用于摘要列表）
function renderEngagementDetailsForSummary(
  details: HotspotEventSummary["engagementDetails"],
  sourceType: SourceKind,
): React.ReactNode {
  if (!details) return null;

  const items: React.ReactNode[] = [];

  switch (sourceType) {
    case "twitter":
      if (details.likes) items.push(<span key="likes">赞 {formatNumber(details.likes)}</span>);
      if (details.retweets) items.push(<span key="retweets">转 {formatNumber(details.retweets)}</span>);
      if (details.views) items.push(<span key="views" className="text-[var(--ink-soft)]">浏览 {formatNumber(details.views)}</span>);
      break;
    case "hackernews":
      if (details.points) items.push(<span key="points">票 {formatNumber(details.points)}</span>);
      if (details.comments) items.push(<span key="comments">评 {formatNumber(details.comments)}</span>);
      break;
    case "zhihu":
      if (details.likes) items.push(<span key="likes">赞 {formatNumber(details.likes)}</span>);
      if (details.comments) items.push(<span key="comments">评 {formatNumber(details.comments)}</span>);
      break;
    case "reddit":
      if (details.score !== undefined) items.push(<span key="score">赞 {formatNumber(details.score)}</span>);
      if (details.comments) items.push(<span key="comments">评 {formatNumber(details.comments)}</span>);
      break;
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-0.5">{item}</span>
      ))}
    </div>
  );
}

// 单个事件摘要行
function EventSummaryItem({ event }: { event: HotspotEventSummary }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-[rgba(8,17,31,0.02)] p-3">
      {/* 头部：来源、作者、时间、评分 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-[var(--ember-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ember)]">
          {SOURCE_LABELS[event.sourceType] || event.sourceLabel}
        </span>
        {event.author && (
          <span className="text-[var(--ink-soft)]">@{event.author}</span>
        )}
        {event.publishedAt && (
          <span className={getTimeColorClass(event.publishedAt)} title={`发布时间: ${event.publishedAt}`}>
            {formatRelativeTime(event.publishedAt)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full bg-[var(--signal-soft)] px-1.5 py-0.5 text-[10px] text-[var(--signal)]">
            真实 {Math.round(event.authenticityScore * 100)}%
          </span>
          <span className="rounded-full bg-[var(--ember-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ember)]">
            相关 {Math.round(event.relevanceScore * 100)}%
          </span>
        </div>
      </div>
      {/* 标题 */}
      <div className="flex items-center gap-1.5">
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-sm font-medium hover:text-[var(--ember)] transition-colors truncate"
          title={event.title}
        >
          {event.title}
        </a>
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 rounded-full bg-[rgba(8,17,31,0.06)] p-1 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] transition-colors"
          title="快速跳转"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      {/* 互动数据 */}
      {event.engagementDetails && (
        renderEngagementDetailsForSummary(event.engagementDetails, event.sourceType)
      )}
    </div>
  );
}

// 事件摘要列表
function EventSummaryList({ events }: { events: HotspotEventSummary[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayEvents = showAll ? events : events.slice(0, 3);
  const hasMore = events.length > 3;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">
          关联事件 ({events.length})
        </span>
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
      <div className="flex flex-col gap-2">
        {displayEvents.map((event) => (
          <EventSummaryItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// 获取来源来源类型标签（去重）
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

// 格式化数字（超过1000显示为K）
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return String(num);
}

// 渲染互动数据聚合
function renderEngagementAggregates(
  aggregates: HotspotEngagementAggregates | null | undefined,
  sourceTypes: { kind: SourceKind; label: string; count: number }[],
): React.ReactNode {
  if (!aggregates) return null;

  const items: React.ReactNode[] = [];

  // 根据来源类型决定显示哪些指标
  const hasTwitter = sourceTypes.some((s) => s.kind === "twitter");
  const hasHackerNews = sourceTypes.some((s) => s.kind === "hackernews");
  const hasReddit = sourceTypes.some((s) => s.kind === "reddit");
  const hasZhihu = sourceTypes.some((s) => s.kind === "zhihu");

  if (hasTwitter) {
    if (aggregates.totalLikes) {
      items.push(
        <span key="likes" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">赞</span>
          <span className="font-semibold">{formatNumber(aggregates.totalLikes)}</span>
        </span>,
      );
    }
    if (aggregates.totalRetweets) {
      items.push(
        <span key="retweets" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">转</span>
          <span className="font-semibold">{formatNumber(aggregates.totalRetweets)}</span>
        </span>,
      );
    }
    if (aggregates.totalViews) {
      items.push(
        <span key="views" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">浏览</span>
          <span>{formatNumber(aggregates.totalViews)}</span>
        </span>,
      );
    }
  }

  if (hasHackerNews) {
    if (aggregates.totalPoints) {
      items.push(
        <span key="points" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">票</span>
          <span className="font-semibold">{formatNumber(aggregates.totalPoints)}</span>
        </span>,
      );
    }
    if (aggregates.totalComments) {
      items.push(
        <span key="hn-comments" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">评</span>
          <span className="font-semibold">{formatNumber(aggregates.totalComments)}</span>
        </span>,
      );
    }
  }

  if (hasReddit) {
    if (aggregates.totalScore) {
      items.push(
        <span key="score" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">赞</span>
          <span className="font-semibold">{formatNumber(aggregates.totalScore)}</span>
        </span>,
      );
    }
  }

  if (hasZhihu) {
    if (aggregates.totalUpvotes) {
      items.push(
        <span key="upvotes" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">赞</span>
          <span className="font-semibold">{formatNumber(aggregates.totalUpvotes)}</span>
        </span>,
      );
    }
  }

  // 通用评论数（如果没有特定来源的评论）
  if (aggregates.totalComments && !hasHackerNews) {
    const hasOtherComments = items.some((item) => {
      const key = (item as React.ReactElement)?.key;
      return key === "hn-comments";
    });
    if (!hasOtherComments) {
      items.push(
        <span key="comments" className="flex items-center gap-1">
          <span className="text-[var(--ink-soft)]">评</span>
          <span className="font-semibold">{formatNumber(aggregates.totalComments)}</span>
        </span>,
      );
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items}
    </div>
  );
}

export function HotspotCard({
  hotspot,
  selected = false,
  onSelect,
  expandedReasons,
  onToggleReason,
}: HotspotCardProps) {
  const [showSources, setShowSources] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showReasonLocal, setShowReasonLocal] = useState(true);

  const sourceTypes = getSourceTypes(hotspot.supportingUrls);
  // 理由展开：优先使用外部状态，否则使用本地状态
  const isReasonExpanded = expandedReasons?.has(hotspot.id) ?? showReasonLocal;
  const uniqueSourceCount = new Set(hotspot.supportingUrls.map(getSourceKey)).size;

  return (
    <article className={`mb-4 rounded-[1.4rem] bg-white/70 p-5 transition-opacity ${selected ? "ring-2 ring-[var(--ember)]" : ""}`}>
      {/* 头部：来源标签、评分、时间 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* 选择框 */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(hotspot.id, e.target.checked)}
            className="w-4 h-4 rounded border-[rgba(8,17,31,0.15)] text-[var(--ember)] focus:ring-[var(--ember)] focus:ring-offset-0 cursor-pointer"
          />
        )}

        {/* 来源类型标签 */}
        <div className="flex items-center gap-1">
          {sourceTypes.slice(0, 3).map(({ kind, label, count }) => (
            <span
              key={kind}
              className="rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ember)]"
              title={`${label}: ${count} 条来源`}
            >
              {label}
              {count > 1 && <span className="ml-0.5 opacity-70">×{count}</span>}
            </span>
          ))}
          {sourceTypes.length > 3 && (
            <span className="rounded-full bg-[rgba(8,17,31,0.06)] px-2 py-0.5 text-xs text-[var(--ink-soft)]">
              +{sourceTypes.length - 3}
            </span>
          )}
        </div>

        {/* 热点评分 */}
        <span className={`mono rounded-full px-2 py-0.5 font-semibold ${getScoreColorClass(hotspot.score)}`}>
          热点 {formatPercent(hotspot.score)}
        </span>

        {/* 发布时间范围 - 使用最新发布时间 */}
        {hotspot.latestPublishedAt && (
          <span className={`mono ${getTimeColorClass(hotspot.latestPublishedAt)}`} title={`最新发布时间: ${hotspot.latestPublishedAt}`}>
            {formatRelativeTime(hotspot.latestPublishedAt)}
          </span>
        )}
      </div>

      {/* 标签行 */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--ink)] leading-snug">
            {hotspot.label}
          </h3>
        </div>

        {/* 多维度评分 */}
        <div className="flex flex-shrink-0 items-center gap-1.5" title="新=新鲜度 多=多样性 热=互动度">
          <span className="mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]" title="新鲜度：内容是否最新发布">
            新 {formatPercent(hotspot.freshnessScore)}
          </span>
          <span className="mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]" title="多样性：来源平台是否多样">
            多 {formatPercent(hotspot.diversityScore)}
          </span>
          <span className="mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]" title="互动度：聚合互动数据是否活跃">
            热 {formatPercent(hotspot.engagementScore)}
          </span>
        </div>
      </div>

      {/* 抓取时间 */}
      <div className="mt-1 text-xs text-[var(--ink-soft)]">
        抓取于 {formatRelativeTime(hotspot.createdAt)}
      </div>

      {/* AI 摘要 */}
      <div className="mt-3">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">{hotspot.summary}</p>
      </div>

      {/* 互动数据聚合 */}
      {(() => {
        const engagement = renderEngagementAggregates(hotspot.engagementAggregates, sourceTypes);
        return engagement ? <div className="mt-3">{engagement}</div> : null;
      })()}

      {/* 来源列表 */}
      <div className="mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3">
        <button
          type="button"
          onClick={() => setShowSources(!showSources)}
          className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${showSources ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showSources ? "收起" : "查看"}来源链接 ({uniqueSourceCount} 个来源)
        </button>

        {showSources && (
          <div className="mt-2 flex flex-wrap gap-2">
            {hotspot.supportingUrls.slice(0, 10).map((url, index) => {
              const sourceKey = getSourceKey(url);
              const sourceLabel = getSourceDisplay(url);
              return (
                <div key={`${url}-${index}`} className="group relative">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-2.5 py-1 text-xs text-[var(--ink-soft)] hover:border-[var(--ember)] hover:text-[var(--ember)] max-w-[10rem] truncate transition-colors"
                    title={url}
                  >
                    <span className="font-medium">{sourceLabel}</span>
                    <svg className="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              );
            })}
            {hotspot.supportingUrls.length > 10 && (
              <span className="rounded-full bg-[rgba(8,17,31,0.04)] px-2.5 py-1 text-xs text-[var(--ink-soft)]">
                +{hotspot.supportingUrls.length - 10} 更多
              </span>
            )}
          </div>
        )}
      </div>

      {/* 关联事件详情列表 */}
      {hotspot.events && hotspot.events.length > 0 && (
        <div className="mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3">
          <button
            type="button"
            onClick={() => setShowEvents(!showEvents)}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showEvents ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showEvents ? "收起" : "查看"}关联事件 ({hotspot.events.length})
          </button>
          {showEvents && <div className="mt-2"><EventSummaryList events={hotspot.events} /></div>}
        </div>
      )}

      {/* AI 判断理由 */}
      {hotspot.reason && (
        <div className="mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3">
          <button
            type="button"
            onClick={() => {
              if (expandedReasons !== undefined) {
                // 如果使用了外部状态管理
                onToggleReason?.(hotspot.id);
              } else {
                // 使用本地状态
                setShowReasonLocal(!showReasonLocal);
              }
            }}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${isReasonExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            AI 聚类理由
          </button>
          {isReasonExpanded && (
            <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)] bg-[rgba(8,17,31,0.02)] rounded-lg p-3">
              {hotspot.reason}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default HotspotCard;
