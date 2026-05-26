import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
// 来源图标（低饱和度单色 Unicode/svg）
const SOURCE_ICONS = {
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
// 格式化百分比
function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}
// 格式化数字
function formatNumber(num) {
    if (num >= 1_000_000)
        return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)
        return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
}
// 获取来源类型统计
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
// 渲染互动数据聚合
function renderEngagementAggregates(aggregates, sourceTypes) {
    if (!aggregates)
        return null;
    const items = [];
    const hasTwitter = sourceTypes.some((s) => s.kind === "twitter");
    const hasHackerNews = sourceTypes.some((s) => s.kind === "hackernews");
    if (hasTwitter) {
        if (aggregates.totalLikes)
            items.push(`${formatNumber(aggregates.totalLikes)} 赞`);
        if (aggregates.totalRetweets)
            items.push(`${formatNumber(aggregates.totalRetweets)} 转发`);
        if (aggregates.totalViews)
            items.push(`${formatNumber(aggregates.totalViews)} 浏览`);
    }
    if (hasHackerNews) {
        if (aggregates.totalPoints)
            items.push(`${formatNumber(aggregates.totalPoints)} 票`);
        if (aggregates.totalComments)
            items.push(`${formatNumber(aggregates.totalComments)} 评论`);
    }
    if (aggregates.totalUpvotes && !hasTwitter)
        items.push(`${formatNumber(aggregates.totalUpvotes)} 赞`);
    return items.join(" · ");
}
// 单个事件摘要行（去色块，纯排版）
function EventSummaryItem({ event }) {
    return (_jsxs("div", { className: "pt-3 first:pt-0", children: [_jsxs("div", { className: "flex items-center gap-1.5 text-xs", style: { color: "var(--text-muted)" }, children: [_jsx("span", { children: SOURCE_ICONS[event.sourceType] || "📌" }), _jsx("span", { children: SOURCE_LABELS[event.sourceType] || event.sourceLabel }), event.author && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["@", event.author] })] })), event.publishedAt && (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u00B7" }), _jsx("span", { children: formatRelativeTime(event.publishedAt) })] })), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["\u771F\u5B9E ", Math.round(event.authenticityScore * 100), "%"] }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["\u76F8\u5173 ", Math.round(event.relevanceScore * 100), "%"] }), _jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "ml-auto flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity", title: "\u67E5\u770B\u539F\u6587", children: _jsx("svg", { width: "12", height: "12", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }) })] }), _jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "mt-1 block text-sm font-medium leading-snug text-[var(--ink)] hover:text-[var(--ember)] transition-colors truncate", title: event.title, children: event.title }), event.engagementDetails && (() => {
                const parts = [];
                if (event.engagementDetails.likes)
                    parts.push(`${formatNumber(event.engagementDetails.likes)} 赞`);
                if (event.engagementDetails.retweets)
                    parts.push(`${formatNumber(event.engagementDetails.retweets)} 转`);
                if (event.engagementDetails.views)
                    parts.push(`${formatNumber(event.engagementDetails.views)} 浏览`);
                if (event.engagementDetails.points)
                    parts.push(`${formatNumber(event.engagementDetails.points)} 票`);
                if (event.engagementDetails.comments)
                    parts.push(`${formatNumber(event.engagementDetails.comments)} 评论`);
                if (event.engagementDetails.score !== undefined)
                    parts.push(`${formatNumber(event.engagementDetails.score)} 赞`);
                return parts.length > 0 ? (_jsx("div", { className: "mt-1 text-xs", style: { color: "var(--text-muted)" }, children: parts.join(" · ") })) : null;
            })()] }));
}
// 事件摘要列表
function EventSummaryList({ events }) {
    const [showAll, setShowAll] = useState(false);
    const displayEvents = showAll ? events : events.slice(0, 3);
    const hasMore = events.length > 3;
    return (_jsxs("div", { className: "mt-3 pt-3", style: { borderTop: "1px solid rgba(8,17,31,0.06)" }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "text-xs", style: { color: "var(--text-muted)" }, children: ["\u5173\u8054\u4E8B\u4EF6 (", events.length, ")"] }), hasMore && (_jsx("button", { type: "button", onClick: () => setShowAll(!showAll), className: "text-xs text-[var(--ember)] hover:underline", children: showAll ? "收起" : `查看全部 ${events.length} 个` }))] }), _jsx("div", { className: "mt-2", children: displayEvents.map((event) => (_jsx(EventSummaryItem, { event: event }, event.id))) })] }));
}
export function HotspotCard({ hotspot, }) {
    const [showSources, setShowSources] = useState(false);
    const [showEvents, setShowEvents] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const sourceTypes = getSourceTypes(hotspot.supportingUrls);
    const totalScore = hotspot.score;
    return (_jsxs("article", { className: `relative mb-4 transition-all duration-300 ease-out`, style: {
            background: "var(--card-bg)",
            borderRadius: "var(--card-radius)",
            padding: "24px",
            boxShadow: isHovered ? "var(--card-shadow-hover)" : "var(--card-shadow)",
            transform: isHovered ? "translateY(-2px)" : "translateY(0)",
        }, onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), children: [_jsxs("div", { className: "absolute top-4 right-4 flex items-center gap-1 transition-opacity duration-300", style: { opacity: isHovered ? 1 : 0 }, children: [_jsx("button", { type: "button", className: "rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(8,17,31,0.04)] transition-all", title: "\u7F6E\u9876", children: _jsx("svg", { width: "14", height: "14", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 15l7-7 7 7" }) }) }), _jsx("button", { type: "button", className: "rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(8,17,31,0.04)] transition-all", title: "\u505C\u7528\u76D1\u63A7", children: _jsx("svg", { width: "14", height: "14", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsx("button", { type: "button", className: "rounded-full p-1.5 text-xs opacity-40 hover:opacity-80 hover:bg-[rgba(240,107,56,0.1)] hover:text-[var(--ember)] transition-all", title: "\u5220\u9664", children: _jsx("svg", { width: "14", height: "14", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] }), _jsxs("div", { className: "flex items-center gap-1.5 text-xs", style: { color: "var(--text-muted)", fontSize: 12 }, children: [sourceTypes.slice(0, 2).map(({ kind }) => (_jsx("span", { className: "tracking-tight", children: SOURCE_ICONS[kind] }, kind))), sourceTypes.length > 2 && (_jsxs("span", { children: ["+", sourceTypes.length - 2, " \u4E2A\u6765\u6E90"] })), _jsx("span", { children: "\u00B7" }), _jsxs("span", { style: { color: "var(--text-secondary)", fontWeight: 500 }, children: ["\u5168\u7F51\u70ED\u5EA6 ", formatPercent(totalScore)] }), _jsx("span", { children: "\u00B7" }), (() => {
                        const engagement = hotspot.engagementAggregates;
                        if (!engagement)
                            return _jsx("span", { children: "\u591A\u6E90\u805A\u5408" });
                        const parts = [];
                        if (engagement.totalLikes)
                            parts.push(`${formatNumber(engagement.totalLikes)} 赞`);
                        if (engagement.totalRetweets)
                            parts.push(`${formatNumber(engagement.totalRetweets)} 转发`);
                        if (engagement.totalViews)
                            parts.push(`${formatNumber(engagement.totalViews)} 浏览`);
                        return parts.length > 0 ? parts.join(" · ") : "多源聚合";
                    })(), _jsx("span", { children: "·" }), (() => {
                        const pubTime = hotspot.latestPublishedAt || hotspot.earliestPublishedAt;
                        return pubTime ? (_jsx("span", { title: `\u539F\u59CB\u53D1\u5E03\u65F6\u95F4: ${new Date(pubTime).toLocaleString()}`, children: `\u53D1\u5E03\u4E8E ${formatRelativeTime(pubTime)}` })) : (_jsx("span", { style: { color: "var(--text-muted)" }, children: "\u53D1\u5E03\u65F6\u95F4\u672A\u77E5" }));
                    })(), _jsx("span", { children: "·" }), _jsx("span", { title: `\u7CFB\u7EDF\u91C7\u96C6\u65F6\u95F4: ${new Date(hotspot.createdAt).toLocaleString()}`, children: `\u91C7\u96C6\u4E8E ${formatRelativeTime(hotspot.createdAt)}` })] }), _jsx("h3", { className: "mt-3 font-semibold leading-snug", style: { fontSize: 16, color: "#111111", lineHeight: 1.4 }, children: hotspot.label }), _jsx("p", { className: "mt-2", style: { fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, fontWeight: 400 }, children: hotspot.summary }), hotspot.supportingUrls.length > 0 && (_jsxs("div", { className: "mt-3 flex flex-wrap gap-1.5", children: [hotspot.supportingUrls.slice(0, 3).map((url, i) => {
                        const kind = parseSourceFromUrl(url);
                        return (_jsxs("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-xs transition-colors", style: {
                                color: "var(--text-muted)",
                                border: "1px solid rgba(8,17,31,0.1)",
                                borderRadius: 999,
                                padding: "2px 8px",
                                fontSize: 11,
                                opacity: 0.6,
                            }, onMouseEnter: (e) => {
                                e.target.style.opacity = "1";
                                e.target.style.color = "var(--ember)";
                                e.target.style.borderColor = "var(--ember)";
                            }, onMouseLeave: (e) => {
                                e.target.style.opacity = "0.6";
                                e.target.style.color = "var(--text-muted)";
                                e.target.style.borderColor = "rgba(8,17,31,0.1)";
                            }, children: [SOURCE_ICONS[kind], " ", SOURCE_LABELS[kind], _jsx("svg", { width: "10", height: "10", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", style: { opacity: 0.5 }, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) })] }, `${url}-${i}`));
                    }), hotspot.supportingUrls.length > 3 && (_jsxs("button", { type: "button", onClick: () => setShowSources(!showSources), className: "inline-flex items-center gap-1 text-xs transition-colors", style: { color: "var(--text-muted)", border: "1px solid rgba(8,17,31,0.1)", borderRadius: 999, padding: "2px 8px", fontSize: 11, opacity: 0.6 }, children: ["+", hotspot.supportingUrls.length - 3, " \u66F4\u591A"] }))] })), showSources && hotspot.supportingUrls.length > 3 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: hotspot.supportingUrls.slice(3).map((url, i) => {
                    const kind = parseSourceFromUrl(url);
                    return (_jsxs("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 text-xs transition-colors", style: { color: "var(--text-muted)", border: "1px solid rgba(8,17,31,0.1)", borderRadius: 999, padding: "2px 8px", fontSize: 11, opacity: 0.6 }, onMouseEnter: (e) => {
                            e.target.style.opacity = "1";
                            e.target.style.color = "var(--ember)";
                            e.target.style.borderColor = "var(--ember)";
                        }, onMouseLeave: (e) => {
                            e.target.style.opacity = "0.6";
                            e.target.style.color = "var(--text-muted)";
                            e.target.style.borderColor = "rgba(8,17,31,0.1)";
                        }, children: [SOURCE_ICONS[kind], " ", SOURCE_LABELS[kind]] }, `extra-${url}-${i}`));
                }) })), hotspot.reason && (_jsxs("p", { className: "mt-3 leading-relaxed", style: { fontSize: 12, color: "var(--text-reason)", fontStyle: "italic", lineHeight: 1.7 }, children: [_jsx("svg", { className: "inline w-3 h-3 mr-1 -mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }), hotspot.reason] })), hotspot.events && hotspot.events.length > 0 && (_jsxs("div", { children: [_jsxs("button", { type: "button", onClick: () => setShowEvents(!showEvents), className: "flex items-center gap-1.5 text-xs transition-colors hover:text-[var(--ember)]", style: { color: "var(--text-muted)", fontSize: 11 }, children: [_jsx("svg", { className: `w-3 h-3 transition-transform ${showEvents ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), "\u5173\u8054\u4E8B\u4EF6 (", hotspot.events.length, ")"] }), showEvents && _jsx(EventSummaryList, { events: hotspot.events })] }))] }));
}
export default HotspotCard;
