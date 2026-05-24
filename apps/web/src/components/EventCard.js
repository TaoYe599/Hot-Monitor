import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
// 来源标签映射
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
        return "text-red-500 font-semibold"; // 不到1小时 - 红色
    if (diffHours < 6)
        return "text-orange-500 font-medium"; // 1-6小时 - 橙色
    if (diffHours < 24)
        return "text-yellow-600"; // 6-24小时 - 黄色
    return "text-[var(--ink-soft)]"; // 超过24小时 - 灰色
}
// 渲染平台特定互动数据
function renderEngagementDetails(details, sourceType) {
    if (!details)
        return null;
    const items = [];
    switch (sourceType) {
        case "twitter":
            if (details.likes)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.likes) })] }, "likes"));
            if (details.retweets)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8F6C" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.retweets) })] }, "retweets"));
            if (details.replies)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.replies) })] }, "replies"));
            if (details.views)
                items.push(_jsxs("span", { className: "flex items-center gap-1 text-[var(--ink-soft)]", children: [_jsx("span", { children: "\u6D4F\u89C8" }), _jsx("span", { children: formatNumber(details.views) })] }, "views"));
            break;
        case "hackernews":
            if (details.points)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u7968" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.points) })] }, "points"));
            if (details.comments)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.comments) })] }, "comments"));
            break;
        case "reddit":
            if (details.score !== undefined)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.score) })] }, "score"));
            if (details.comments)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.comments) })] }, "comments"));
            break;
        case "zhihu":
            if (details.likes)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8D5E" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.likes) })] }, "likes"));
            if (details.comments)
                items.push(_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { children: "\u8BC4" }), _jsx("span", { className: "font-semibold", children: formatNumber(details.comments) })] }, "comments"));
            break;
        default:
            // 其他平台不显示详细数据
            break;
    }
    if (items.length === 0)
        return null;
    return (_jsx("div", { className: "flex flex-wrap gap-3 text-xs", children: items }));
}
export function EventCard({ event, selected = false, onSelect, expandedReasons, onToggleReason, }) {
    const [showReason, setShowReason] = useState(false);
    const [showExcerpt, setShowExcerpt] = useState(false);
    const isReasonExpanded = expandedReasons?.has(event.id) ?? showReason;
    const hasOriginalExcerpt = event.originalExcerpt && event.originalExcerpt !== event.summary;
    return (_jsxs("article", { className: `mb-4 rounded-[1.4rem] bg-white/70 p-5 transition-opacity ${event.isRead ? "opacity-70" : ""} ${selected ? "ring-2 ring-[var(--ember)]" : ""}`, children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs", children: [onSelect && (_jsx("input", { type: "checkbox", checked: selected, onChange: (e) => onSelect(event.id, e.target.checked), className: "w-4 h-4 rounded border-[rgba(8,17,31,0.15)] text-[var(--ember)] focus:ring-[var(--ember)] focus:ring-offset-0 cursor-pointer" })), _jsx("span", { className: "rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ember)]", children: SOURCE_LABELS[event.sourceType] || event.sourceLabel }), event.author && (_jsxs("span", { className: "text-[var(--ink-soft)]", children: ["@", event.author] })), event.publishedAt && (_jsx("span", { className: `mono ${getTimeColorClass(event.publishedAt)}`, title: `发布时间: ${event.publishedAt}`, children: formatRelativeTime(event.publishedAt) })), _jsx("span", { className: "mono text-[var(--ink-soft)]", title: `抓取时间: ${event.createdAt}`, children: formatRelativeTime(event.createdAt) })] }), _jsxs("div", { className: "mt-3 flex items-start justify-between gap-3", children: [_jsx("div", { className: "flex-1 min-w-0", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "font-semibold hover:text-[var(--ember)] transition-colors", children: event.title }), _jsx("a", { href: event.sourceUrl, target: "_blank", rel: "noopener noreferrer", className: "flex-shrink-0 rounded-full bg-[rgba(8,17,31,0.06)] p-1 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] transition-colors", title: "\u5FEB\u901F\u8DF3\u8F6C\u5230\u539F\u59CB\u5E16\u5B50", children: _jsx("svg", { className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" }) }) })] }) }), _jsxs("div", { className: "flex flex-shrink-0 items-center gap-2", children: [_jsxs("span", { className: "mono rounded-full bg-[var(--signal-soft)] px-2 py-0.5 text-xs text-[var(--signal)]", children: ["\u771F\u5B9E ", Math.round(event.authenticityScore * 100), "%"] }), _jsxs("span", { className: "mono rounded-full bg-[var(--ember-soft)] px-2 py-0.5 text-xs text-[var(--ember)]", children: ["\u76F8\u5173 ", Math.round(event.relevanceScore * 100), "%"] })] })] }), event.engagementDetails && (_jsx("div", { className: "mt-3", children: renderEngagementDetails(event.engagementDetails, event.sourceType) })), _jsxs("div", { className: "mt-3", children: [_jsx("p", { className: "text-sm leading-6 text-[var(--ink-soft)]", children: event.summary }), hasOriginalExcerpt && (_jsxs("div", { className: "mt-2", children: [_jsxs("button", { type: "button", onClick: () => setShowExcerpt(!showExcerpt), className: "flex items-center gap-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors", children: [_jsx("svg", { className: `w-3.5 h-3.5 transition-transform ${showExcerpt ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), showExcerpt ? "收起" : "查看", "\u539F\u59CB\u6458\u5F55"] }), showExcerpt && (_jsx("p", { className: "mt-1 text-xs leading-5 text-[var(--ink-soft)] italic border-l-2 border-[rgba(8,17,31,0.1)] pl-2", children: event.originalExcerpt }))] }))] }), event.reason && (_jsxs("div", { className: "mt-3 border-t border-[rgba(8,17,31,0.08)] pt-3", children: [_jsxs("button", { type: "button", onClick: () => {
                            setShowReason(!showReason);
                            onToggleReason?.(event.id);
                        }, className: "flex items-center gap-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ember)] transition-colors", children: [_jsx("svg", { className: `w-3.5 h-3.5 transition-transform ${showReason ? "rotate-180" : ""}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }), "AI \u5224\u65AD\u7406\u7531"] }), (isReasonExpanded || showReason) && (_jsx("p", { className: "mt-2 text-xs leading-5 text-[var(--ink-soft)] bg-[rgba(8,17,31,0.02)] rounded-lg p-3", children: event.reason }))] }))] }));
}
export default EventCard;
