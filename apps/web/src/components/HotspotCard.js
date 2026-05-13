import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
// 来源映射
const SOURCE_LABELS = {
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
function parseSourceFromUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes("twitter.com") || hostname.includes("x.com"))
            return "twitter";
        if (hostname.includes("news.ycombinator.com"))
            return "hackernews";
        if (hostname.includes("reddit.com"))
            return "reddit";
        if (hostname.includes("zhihu.com"))
            return "zhihu";
        if (hostname.includes("baidu.com"))
            return "baidu";
        if (hostname.includes("weibo.com"))
            return "weibo";
        if (hostname.includes("github.com"))
            return "github";
        if (hostname.includes("google.com"))
            return "google";
        return "search";
    }
    catch {
        return "search";
    }
}
// 获取来源显示名称
function getSourceDisplay(url) {
    const kind = parseSourceFromUrl(url);
    return SOURCE_LABELS[kind] || kind;
}
// 获取来源唯一标识（用于显示多个来源）
function getSourceKey(url) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return hostname;
    }
    catch {
        return url.slice(0, 20);
    }
}
// 格式化相对时间
function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1)
        return "刚刚";
    if (diffMins < 60)
        return `${diffMins}分钟前`;
    if (diffHours < 24)
        return `${diffHours}小时前`;
    if (diffDays < 7)
        return `${diffDays}天前`;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
// 获取时间颜色类名
function getTimeColorClass(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 1)
        return "text-red-500 font-semibold";
    if (diffHours < 6)
        return "text-orange-500 font-medium";
    if (diffHours < 24)
        return "text-yellow-600";
    return "text-[var(--ink-soft)]";
}
// 格式化百分比
function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}
// 获取评分颜色
function getScoreColorClass(score) {
    if (score >= 0.8)
        return "bg-[var(--ember-soft)] text-[var(--ember)]";
    if (score >= 0.6)
        return "bg-yellow-100 text-yellow-700";
    if (score >= 0.4)
        return "bg-orange-100 text-orange-700";
    return "bg-[rgba(8,17,31,0.06)] text-[var(--ink-soft)]";
}
// 渲染事件互动数据（用于摘要列表）
function renderEngagementDetailsForSummary(details, sourceType) {
    if (!details)
        return null;
    const items = [];
    switch (sourceType) {
        case "twitter":
            if (details.likes)
                items.push(_jsxs("span", { children: ["\u8D5E ", formatNumber(details.likes)] }, "likes"));
            if (details.retweets)
                items.push(_jsxs("span", { children: ["\u8F6C ", formatNumber(details.retweets)] }, "retweets"));
            if (details.views)
                items.push(_jsxs("span", { className: "text-[var(--ink-soft)]", children: ["\u6D4F\u89C8 ", formatNumber(details.views)] }, "views"));
            break;
        case "hackernews":
            if (details.points)
                items.push(_jsxs("span", { children: ["\u7968 ", formatNumber(details.points)] }, "points"));
            if (details.comments)
                items.push(_jsxs("span", { children: ["\u8BC4 ", formatNumber(details.comments)] }, "comments"));
            break;
        case "zhihu":
            if (details.likes)
                items.push(_jsxs("span", { children: ["\u8D5E ", formatNumber(details.likes)] }, "likes"));
            if (details.comments)
                items.push(_jsxs("span", { children: ["\u8BC4 ", formatNumber(details.comments)] }, "comments"));
            break;
        case "reddit":
            if (details.score !== undefined)
                items.push(_jsxs("span", { children: ["\u8D5E ", formatNumber(details.score)] }, "score"));
            if (details.comments)
                items.push(_jsxs("span", { children: ["\u8BC4 ", formatNumber(details.comments)] }, "comments"));
            break;
    }
    if (items.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-2 text-xs text-[var(--ink-soft)]", children: items.map((item, i) => (_jsx("span", { className: "flex items-center gap-0.5", children: item }, i))) }));
}
// 单个事件摘要行
function EventSummaryItem({ event }) {
    return (_jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-[rgba(8,17,31,0.02)] p-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [_jsx("span", { className: "rounded-full bg-[var(--ember-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ember)]", children: SOURCE_LABELS[event.sourceType] || event.sourceLabel }), event.author && (_jsxs("span", { className: "text-[var(--ink-soft)]", children: ["@", event.author] })), event.publishedAt && (_jsx("span", { className: getTimeColorClass(event.publishedAt), title: `发布时间: ${event.publishedAt}`, children: formatRelativeTime(event.publishedAt) })), _jsxs("div", { className: "ml-auto flex items-center gap-1.5", children: [_jsxs("span", { className: "rounded-full bg-[var(--signal-soft)] px-1.5 py-0.5 text-[10px] text-[var(--signal)]", children: ["\u771F\u5B9E ", Math.round(event.authenticityScore * 100), "%"] }), _jsxs("span", { className: "rounded-full bg-[var(--ember-soft)] px-1.5 py-0.5 text-[10px] text-[var(--ember)]", children: ["\u76F8\u5173 ", Math.round(event.relevanceScore * 100), "%"] })] })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "flex-1 text-sm font-medium hover:text-[var(--ember)] transition-colors truncate", title: event.title, children: event.title }), _jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 rounded-full bg-[rgba(8,17,31,0.06)] p-1 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] transition-colors", title: "\u5FEB\u901F\u8DF3\u8F6C", children: _jsx("svg", { className: "w-3 h-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }) })] }), event.engagementDetails && (renderEngagementDetailsForSummary(event.engagementDetails, event.sourceType))] }));
}
// 事件摘要列表
function EventSummaryList({ events }) {
    const [showAll, setShowAll] = useState(false);
    const displayEvents = showAll ? events : events.slice(0, 3);
    const hasMore = events.length > 3;
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("span", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: ["\u5173\u8054\u4E8B\u4EF6 (", events.length, ")"] }), hasMore && (_jsx("button", { type: "button", onClick: () => setShowAll(!showAll), className: "text-xs text-[var(--ember)] hover:underline", children: showAll ? "收起" : `查看全部 ${events.length} 个` }))] }), _jsx("div", { className: "flex flex-col gap-2", children: displayEvents.map((event) => (_jsx(EventSummaryItem, { event: event }, event.id))) })] }));
}
// 获取来源来源类型标签（去重）
function getSourceTypes(urls) {
    const typeMap = new Map();
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
function formatNumber(num) {
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return String(num);
}
// 渲染互动数据聚合
function renderEngagementAggregates(aggregates, sourceTypes) {
    if (!aggregates)
        return null;
    const items = [];
    // 根据来源类型决定显示哪些指标
    const hasTwitter = sourceTypes.some((s) => s.kind === "twitter");
    const hasHackerNews = sourceTypes.some((s) => s.kind === "hackernews");
    const hasReddit = sourceTypes.some((s) => s.kind === "reddit");
    const hasZhihu = sourceTypes.some((s) => s.kind === "zhihu");
    if (hasTwitter) {
        if (aggregates.totalLikes) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalLikes) })] }, "likes"));
        }
        if (aggregates.totalRetweets) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8F6C" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalRetweets) })] }, "retweets"));
        }
        if (aggregates.totalViews) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u6D4F\u89C8" }), _jsx("span", { children: formatNumber(aggregates.totalViews) })] }, "views"));
        }
    }
    if (hasHackerNews) {
        if (aggregates.totalPoints) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u7968" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalPoints) })] }, "points"));
        }
        if (aggregates.totalComments) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalComments) })] }, "hn-comments"));
        }
    }
    if (hasReddit) {
        if (aggregates.totalScore) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalScore) })] }, "score"));
        }
    }
    if (hasZhihu) {
        if (aggregates.totalUpvotes) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalUpvotes) })] }, "upvotes"));
        }
    }
    // 通用评论数（如果没有特定来源的评论）
    if (aggregates.totalComments && !hasHackerNews) {
        const hasOtherComments = items.some((item) => {
            const key = item?.key;
            return key === "hn-comments";
        });
        if (!hasOtherComments) {
            items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[var(--ink-soft)]", children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(aggregates.totalComments) })] }, "comments"));
        }
    }
    if (items.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-3 text-xs", children: items }));
}
export function HotspotCard({ hotspot, selected = false, onSelect, expandedReasons, onToggleReason, }) {
    const [showSources, setShowSources] = useState(true);
    const [showEvents, setShowEvents] = useState(true);
    const [showReasonLocal, setShowReasonLocal] = useState(true);
    const sourceTypes = getSourceTypes(hotspot.supportingUrls);
    // 理由展开：优先使用外部状态，否则使用本地状态
    const isReasonExpanded = expandedReasons?.has(hotspot.id) ?? showReasonLocal;
    const uniqueSourceCount = new Set(hotspot.supportingUrls.map(getSourceKey)).size;
    return (_jsxs("article", { className: `mb-4 rounded-[1.4rem] bg-white/70 p-5 transition-opacity ${selected ? "ring-2 ring-[var(--ember)]" : ""}`, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [onSelect && (_jsx("input", { type: "checkbox", checked: selected, onChange: (e) => onSelect(hotspot.id, e.target.checked), className: "w-4 h-4 rounded border-[rgba(8,17,31,0.15)] text-[var(--ember)] focus:ring-[var(--ember)] focus:ring-offset-0 cursor-pointer" })), _jsxs("div", { className: "flex items-center gap-1", children: [sourceTypes.slice(0, 3).map(({ kind, label, count }) => (_jsxs("span", { className: "rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ember)]", title: `${label}: ${count} 条来源`, children: [label, count > 1 && _jsxs("span", { className: "ml-0.5 opacity-70", children: ["\u00D7", count] })] }, kind))), sourceTypes.length > 3 && (_jsxs("span", { className: "rounded-full bg-[rgba(8,17,31,0.06)] px-2 py-0.5 text-xs text-[var(--ink-soft)]", children: ["+", sourceTypes.length - 3] }))] }), _jsxs("span", { className: `mono rounded-full px-2 py-0.5 font-semibold ${getScoreColorClass(hotspot.score)}`, children: ["\u70ED\u70B9 ", formatPercent(hotspot.score)] }), hotspot.latestPublishedAt && (_jsx("span", { className: `mono ${getTimeColorClass(hotspot.latestPublishedAt)}`, title: `最新发布时间: ${hotspot.latestPublishedAt}`, children: formatRelativeTime(hotspot.latestPublishedAt) }))] }), _jsxs("div", { className: "mt-3 flex items-start justify-between gap-3", children: [_jsx("div", { className: "flex-1 min-w-0", children: _jsx("h3", { className: "font-semibold text-[var(--ink)] leading-snug", children: hotspot.label }) }), _jsxs("div", { className: "flex flex-shrink-0 items-center gap-1.5", title: "\u65B0=\u65B0\u9C9C\u5EA6 \u591A=\u591A\u6837\u6027 \u70ED=\u4E92\u52A8\u5EA6", children: [_jsxs("span", { className: "mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]", title: "\u65B0\u9C9C\u5EA6\uFF1A\u5185\u5BB9\u662F\u5426\u6700\u65B0\u53D1\u5E03", children: ["\u65B0 ", formatPercent(hotspot.freshnessScore)] }), _jsxs("span", { className: "mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]", title: "\u591A\u6837\u6027\uFF1A\u6765\u6E90\u5E73\u53F0\u662F\u5426\u591A\u6837", children: ["\u591A ", formatPercent(hotspot.diversityScore)] }), _jsxs("span", { className: "mono rounded-full bg-[rgba(8,17,31,0.04)] px-1.5 py-0.5 text-xs text-[var(--ink-soft)]", title: "\u4E92\u52A8\u5EA6\uFF1A\u805A\u5408\u4E92\u52A8\u6570\u636E\u662F\u5426\u6D3B\u8DC3", children: ["\u70ED ", formatPercent(hotspot.engagementScore)] })] })] }), _jsxs("div", { className: "mt-1 text-xs text-[var(--ink-soft)]", children: ["\u6293\u53D6\u4E8E ", formatRelativeTime(hotspot.createdAt)] }), _jsx("div", { className: "mt-3", children: _jsx("p", { className: "text-sm leading-6 text-[var(--ink-soft)]", children: hotspot.summary }) }), (() => {
                const engagement = renderEngagementAggregates(hotspot.engagementAggregates, sourceTypes);
                return engagement ? _jsx("div", { className: "mt-3", children: engagement }) : null;
            })(), _jsxs("div", { className: "mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3", children: [_jsxs("button", { type: "button", onClick: () => setShowSources(!showSources), className: "flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors", children: [_jsx("svg", { className: `w-3.5 h-3.5 transition-transform ${showSources ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), showSources ? "收起" : "查看", "\u6765\u6E90\u94FE\u63A5 (", uniqueSourceCount, " \u4E2A\u6765\u6E90)"] }), showSources && (_jsxs("div", { className: "mt-2 flex flex-wrap gap-2", children: [hotspot.supportingUrls.slice(0, 10).map((url, index) => {
                                const sourceKey = getSourceKey(url);
                                const sourceLabel = getSourceDisplay(url);
                                return (_jsx("div", { className: "group relative", children: _jsxs("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1.5 rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-2.5 py-1 text-xs text-[var(--ink-soft)] hover:border-[var(--ember)] hover:text-[var(--ember)] max-w-[10rem] truncate transition-colors", title: url, children: [_jsx("span", { className: "font-medium", children: sourceLabel }), _jsx("svg", { className: "w-3 h-3 flex-shrink-0 opacity-50", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) })] }) }, `${url}-${index}`));
                            }), hotspot.supportingUrls.length > 10 && (_jsxs("span", { className: "rounded-full bg-[rgba(8,17,31,0.04)] px-2.5 py-1 text-xs text-[var(--ink-soft)]", children: ["+", hotspot.supportingUrls.length - 10, " \u66F4\u591A"] }))] }))] }), hotspot.events && hotspot.events.length > 0 && (_jsxs("div", { className: "mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3", children: [_jsxs("button", { type: "button", onClick: () => setShowEvents(!showEvents), className: "flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors", children: [_jsx("svg", { className: `w-3.5 h-3.5 transition-transform ${showEvents ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), showEvents ? "收起" : "查看", "\u5173\u8054\u4E8B\u4EF6 (", hotspot.events.length, ")"] }), showEvents && _jsx("div", { className: "mt-2", children: _jsx(EventSummaryList, { events: hotspot.events }) })] })), hotspot.reason && (_jsxs("div", { className: "mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3", children: [_jsxs("button", { type: "button", onClick: () => {
                            if (expandedReasons !== undefined) {
                                // 如果使用了外部状态管理
                                onToggleReason?.(hotspot.id);
                            }
                            else {
                                // 使用本地状态
                                setShowReasonLocal(!showReasonLocal);
                            }
                        }, className: "flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors", children: [_jsx("svg", { className: `w-3.5 h-3.5 transition-transform ${isReasonExpanded ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), "AI \u805A\u7C7B\u7406\u7531"] }), isReasonExpanded && (_jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--ink-soft)] bg-[rgba(8,17,31,0.02)] rounded-lg p-3", children: hotspot.reason }))] }))] }));
}
export default HotspotCard;
