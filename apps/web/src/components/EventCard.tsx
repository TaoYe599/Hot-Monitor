import type { EngagementDetails, SourceKind, VerifiedEvent } from "@hot-monitor/shared";
import React, { useState } from "react";

interface EventCardProps {
  event: VerifiedEvent;
  selected?: boolean;
  onSelect?: (id: number, selected: boolean) => void;
  expandedReasons?: Set<number>;
  onToggleReason?: (id: number) => void;
}

// 来源标签映射
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

  if (diffHours < 1) return "text-red-500 font-semibold"; // 不到1小时 - 红色
  if (diffHours < 6) return "text-orange-500 font-medium"; // 1-6小时 - 橙色
  if (diffHours < 24) return "text-yellow-600"; // 6-24小时 - 黄色
  return "text-[var(--ink-soft)]"; // 超过24小时 - 灰色
}

// 渲染平台特定互动数据
function renderEngagementDetails(
  details: EngagementDetails | null,
  sourceType: SourceKind,
): React.ReactNode {
  if (!details) return null;

  const items: React.ReactNode[] = [];

  switch (sourceType) {
    case "twitter":
      if (details.likes) items.push(
        <span key="likes" className="flex items-center gap-1">
          <span>赞</span><span className="font-semibold">{formatNumber(details.likes)}</span>
        </span>
      );
      if (details.retweets) items.push(
        <span key="retweets" className="flex items-center gap-1">
          <span>转</span><span className="font-semibold">{formatNumber(details.retweets)}</span>
        </span>
      );
      if (details.replies) items.push(
        <span key="replies" className="flex items-center gap-1">
          <span>评</span><span className="font-semibold">{formatNumber(details.replies)}</span>
        </span>
      );
      if (details.views) items.push(
        <span key="views" className="flex items-center gap-1 text-[var(--ink-soft)]">
          <span>浏览</span><span>{formatNumber(details.views)}</span>
        </span>
      );
      break;
    case "hackernews":
      if (details.points) items.push(
        <span key="points" className="flex items-center gap-1">
          <span>票</span><span className="font-semibold">{formatNumber(details.points)}</span>
        </span>
      );
      if (details.comments) items.push(
        <span key="comments" className="flex items-center gap-1">
          <span>评</span><span className="font-semibold">{formatNumber(details.comments)}</span>
        </span>
      );
      break;
    case "reddit":
      if (details.score !== undefined) items.push(
        <span key="score" className="flex items-center gap-1">
          <span>赞</span><span className="font-semibold">{formatNumber(details.score)}</span>
        </span>
      );
      if (details.comments) items.push(
        <span key="comments" className="flex items-center gap-1">
          <span>评</span><span className="font-semibold">{formatNumber(details.comments)}</span>
        </span>
      );
      break;
    case "zhihu":
      if (details.likes) items.push(
        <span key="likes" className="flex items-center gap-1">
          <span>赞</span><span className="font-semibold">{formatNumber(details.likes)}</span>
        </span>
      );
      if (details.comments) items.push(
        <span key="comments" className="flex items-center gap-1">
          <span>评</span><span className="font-semibold">{formatNumber(details.comments)}</span>
        </span>
      );
      break;
    default:
      // 其他平台不显示详细数据
      break;
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {items}
    </div>
  );
}

export function EventCard({
  event,
  selected = false,
  onSelect,
  expandedReasons,
  onToggleReason,
}: EventCardProps) {
  const [showReason, setShowReason] = useState(false);
  const [showExcerpt, setShowExcerpt] = useState(false);

  const isReasonExpanded = expandedReasons?.has(event.id) ?? showReason;
  const hasOriginalExcerpt = event.originalExcerpt && event.originalExcerpt !== event.summary;

  return (
    <article className={`mb-4 rounded-[1.4rem] bg-white/70 p-5 transition-opacity ${event.isRead ? "opacity-70" : ""} ${selected ? "ring-2 ring-[var(--ember)]" : ""}`}>
      {/* 头部：来源、作者、时间 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* 选择框 */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(event.id, e.target.checked)}
            className="w-4 h-4 rounded border-[rgba(8,17,31,0.15)] text-[var(--ember)] focus:ring-[var(--ember)] focus:ring-offset-0 cursor-pointer"
          />
        )}

        {/* 来源标签 */}
        <span className="rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ember)]">
          {SOURCE_LABELS[event.sourceType] || event.sourceLabel}
        </span>

        {/* 作者 */}
        {event.author && (
          <span className="text-[var(--ink-soft)]">
            @{event.author}
          </span>
        )}

        {/* 发布时间 */}
        {event.publishedAt && (
          <span className={`mono ${getTimeColorClass(event.publishedAt)}`} title={`发布时间: ${event.publishedAt}`}>
            {formatRelativeTime(event.publishedAt)}
          </span>
        )}

        {/* 抓取时间 */}
        <span className="mono text-[var(--ink-soft)]" title={`抓取时间: ${event.createdAt}`}>
          {formatRelativeTime(event.createdAt)}
        </span>
      </div>

      {/* 标题行 */}
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:text-[var(--ember)] transition-colors"
            >
              {event.title}
            </a>
            {/* 快速跳转按钮 */}
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 rounded-full bg-[rgba(8,17,31,0.06)] p-1 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] transition-colors"
              title="快速跳转到原始帖子"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* 评分 */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="mono rounded-full bg-[var(--signal-soft)] px-2 py-0.5 text-xs text-[var(--signal)]">
            真实 {Math.round(event.authenticityScore * 100)}%
          </span>
          <span className="mono rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs text-[var(--ember)]">
            相关 {Math.round(event.relevanceScore * 100)}%
          </span>
        </div>
      </div>

      {/* 互动数据 */}
      {event.engagementDetails && (
        <div className="mt-3">
          {renderEngagementDetails(event.engagementDetails, event.sourceType)}
        </div>
      )}

      {/* AI 摘要 */}
      <div className="mt-3">
        <p className="text-sm leading-6 text-[var(--ink-soft)]">{event.summary}</p>

        {/* 原始摘录 */}
        {hasOriginalExcerpt && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowExcerpt(!showExcerpt)}
              className="flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showExcerpt ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showExcerpt ? "收起" : "查看"}原始摘录
            </button>
            {showExcerpt && (
              <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)] italic border-l-2 border-[rgba(8,17,31,0.1)] pl-2">
                {event.originalExcerpt}
              </p>
            )}
          </div>
        )}
      </div>

      {/* AI 理由 */}
      {event.reason && (
        <div className="mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3">
          <button
            type="button"
            onClick={() => {
              setShowReason(!showReason);
              onToggleReason?.(event.id);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showReason ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            AI 判断理由
          </button>
          {(isReasonExpanded || showReason) && (
            <p className="mt-2 text-xs leading-5 text-[var(--ink-soft)] bg-[rgba(8,17,31,0.02)] rounded-lg p-3">
              {event.reason}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default EventCard;
