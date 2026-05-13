import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
export const EVENT_SORT_OPTIONS = [
    { value: "createdAt-desc", label: "最新优先" },
    { value: "createdAt-asc", label: "最早优先" },
    { value: "authenticityScore-desc", label: "真实性 高→低" },
    { value: "relevanceScore-desc", label: "相关性 高→低" },
    { value: "combinedScore-desc", label: "综合评分 高→低" },
    { value: "sourceType-asc", label: "来源类型" },
];
export const HOTSPOT_SORT_OPTIONS = [
    { value: "createdAt-desc", label: "最新优先" },
    { value: "createdAt-asc", label: "最早优先" },
    { value: "score-desc", label: "热点评分 高→低" },
    { value: "diversityScore-desc", label: "多样性评分 高→低" },
    { value: "freshnessScore-desc", label: "新鲜度评分 高→低" },
    { value: "engagementScore-desc", label: "互动热度 高→低" },
    { value: "coverage-desc", label: "覆盖规模 高→低" },
];
export const TIME_RANGE_OPTIONS = [
    { value: "", label: "全部时间" },
    { value: "today", label: "今日" },
    { value: "week", label: "本周" },
    { value: "month", label: "本月" },
];
export const SOURCE_TYPE_OPTIONS = [
    { value: "twitter", label: "Twitter" },
    { value: "search", label: "DuckDuckGo" },
    { value: "google", label: "Google" },
    { value: "rss", label: "官方博客" },
    { value: "github", label: "GitHub" },
    { value: "hackernews", label: "Hacker News" },
    { value: "zhihu", label: "知乎" },
    { value: "weibo", label: "微博" },
    { value: "baidu", label: "百度" },
    { value: "reddit", label: "Reddit" },
];
export const EVENT_STATUS_OPTIONS = [
    { value: "", label: "全部状态" },
    { value: "accepted", label: "已接受" },
    { value: "rejected", label: "已过滤" },
];
// ============== localStorage 偏好保存 ==============
const STORAGE_KEY_EVENTS = "hot-monitor-events-prefs";
const STORAGE_KEY_HOTSPOTS = "hot-monitor-hotspots-prefs";
function loadPrefs(key, defaults) {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    }
    catch {
        // ignore parse errors
    }
    return defaults;
}
function savePrefs(key, prefs) {
    try {
        localStorage.setItem(key, JSON.stringify(prefs));
    }
    catch {
        // ignore storage errors
    }
}
// ============== Events Filter & Sort Hook ==============
export function useEventsPrefs(monitors) {
    const defaults = {
        sort: { field: "createdAt", order: "desc" },
        filter: {},
        quickFilter: "",
    };
    const [prefs, setPrefs] = useState(() => loadPrefs(STORAGE_KEY_EVENTS, defaults));
    useEffect(() => {
        savePrefs(STORAGE_KEY_EVENTS, prefs);
    }, [prefs]);
    const setSort = useCallback((field, order) => {
        setPrefs((p) => ({ ...p, sort: { field, order }, quickFilter: "" }));
    }, []);
    const setFilter = useCallback((filter) => {
        setPrefs((p) => ({ ...p, filter: { ...p.filter, ...filter } }));
    }, []);
    const clearFilter = useCallback(() => {
        setPrefs((p) => ({ ...p, filter: {} }));
    }, []);
    const setQuickFilter = useCallback((quick) => {
        setPrefs((p) => ({
            ...p,
            quickFilter: quick,
            filter: { ...p.filter, timeRange: quick || undefined },
        }));
    }, []);
    const hasActiveFilter = prefs.filter.monitorId !== undefined ||
        (prefs.filter.sourceTypes && prefs.filter.sourceTypes.length > 0) ||
        prefs.filter.minAuthenticityScore !== undefined ||
        prefs.filter.minRelevanceScore !== undefined ||
        prefs.filter.status !== undefined ||
        prefs.filter.timeRange !== undefined;
    return {
        prefs,
        setSort,
        setFilter,
        clearFilter,
        setQuickFilter,
        hasActiveFilter,
    };
}
// ============== Hotspots Filter & Sort Hook ==============
export function useHotspotsPrefs(monitors) {
    const defaults = {
        sort: { field: "createdAt", order: "desc" },
        filter: {},
        quickFilter: "",
    };
    const [prefs, setPrefs] = useState(() => loadPrefs(STORAGE_KEY_HOTSPOTS, defaults));
    useEffect(() => {
        savePrefs(STORAGE_KEY_HOTSPOTS, prefs);
    }, [prefs]);
    const setSort = useCallback((field, order) => {
        setPrefs((p) => ({ ...p, sort: { field, order }, quickFilter: "" }));
    }, []);
    const setFilter = useCallback((filter) => {
        setPrefs((p) => ({ ...p, filter: { ...p.filter, ...filter } }));
    }, []);
    const clearFilter = useCallback(() => {
        setPrefs((p) => ({ ...p, filter: {} }));
    }, []);
    const setQuickFilter = useCallback((quick) => {
        setPrefs((p) => ({
            ...p,
            quickFilter: quick,
            filter: { ...p.filter, timeRange: quick || undefined },
        }));
    }, []);
    const hasActiveFilter = prefs.filter.monitorId !== undefined ||
        prefs.filter.minScore !== undefined ||
        prefs.filter.minCoverage !== undefined ||
        prefs.filter.timeRange !== undefined;
    return {
        prefs,
        setSort,
        setFilter,
        clearFilter,
        setQuickFilter,
        hasActiveFilter,
    };
}
export function EventsFilterBar({ monitors, prefs, onSortChange, onFilterChange, onClearFilter, onQuickFilterChange, }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs("div", { className: "mb-4 rounded-[1.4rem] bg-white/70 p-4", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u5FEB\u6377:" }), [
                        { value: "", label: "全部" },
                        { value: "today", label: "今日最新" },
                        { value: "week", label: "本周热门" },
                    ].map((opt) => (_jsx("button", { type: "button", onClick: () => onQuickFilterChange(opt.value), className: `rounded-full px-3 py-1 text-xs font-semibold transition-colors ${prefs.quickFilter === opt.value
                            ? "bg-[var(--ember)] text-white"
                            : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)]"}`, children: opt.label }, opt.value)))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("span", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6392\u5E8F:" }), _jsx("select", { value: `${prefs.sort.field}-${prefs.sort.order}`, onChange: (e) => {
                            const [field, order] = e.target.value.split("-");
                            onSortChange(field, order);
                        }, className: "rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: EVENT_SORT_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), _jsx("button", { type: "button", onClick: () => setExpanded(!expanded), className: `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${prefs.filter.monitorId !== undefined ||
                            prefs.filter.sourceTypes?.length ||
                            prefs.filter.minAuthenticityScore !== undefined ||
                            prefs.filter.minRelevanceScore !== undefined ||
                            prefs.filter.status
                            ? "bg-[var(--ember)] text-white"
                            : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"}`, children: expanded ? "收起筛选" : "更多筛选" }), (prefs.filter.monitorId !== undefined ||
                        prefs.filter.sourceTypes?.length ||
                        prefs.filter.minAuthenticityScore !== undefined ||
                        prefs.filter.minRelevanceScore !== undefined ||
                        prefs.filter.status) && (_jsx("button", { type: "button", onClick: onClearFilter, className: "rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600", children: "\u6E05\u9664\u7B5B\u9009" }))] }), expanded && (_jsxs("div", { className: "mt-4 grid gap-4 border-t border-[rgba(8,17,31,0.08)] pt-4 md:grid-cols-2 lg:grid-cols-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u76D1\u63A7\u4EFB\u52A1" }), _jsxs("select", { value: prefs.filter.monitorId ?? "", onChange: (e) => onFilterChange({
                                    monitorId: e.target.value ? Number(e.target.value) : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u4EFB\u52A1" }), monitors.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6570\u636E\u6E90" }), _jsx("div", { className: "flex flex-wrap gap-1", children: SOURCE_TYPE_OPTIONS.map((opt) => {
                                    const selected = prefs.filter.sourceTypes?.includes(opt.value) ?? false;
                                    return (_jsx("button", { type: "button", onClick: () => {
                                            const current = prefs.filter.sourceTypes ?? [];
                                            const updated = selected
                                                ? current.filter((s) => s !== opt.value)
                                                : [...current, opt.value];
                                            onFilterChange({
                                                sourceTypes: updated.length > 0 ? updated : undefined,
                                            });
                                        }, className: `rounded-full px-2 py-0.5 text-xs transition-colors ${selected
                                            ? "bg-[var(--ember)] text-white"
                                            : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"}`, children: opt.label }, opt.value));
                                }) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6700\u4F4E\u771F\u5B9E\u6027" }), _jsxs("select", { value: prefs.filter.minAuthenticityScore ?? "", onChange: (e) => onFilterChange({
                                    minAuthenticityScore: e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u4E0D\u9650" }), _jsx("option", { value: "0.9", children: "90%+" }), _jsx("option", { value: "0.8", children: "80%+" }), _jsx("option", { value: "0.7", children: "70%+" }), _jsx("option", { value: "0.6", children: "60%+" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6700\u4F4E\u76F8\u5173\u6027" }), _jsxs("select", { value: prefs.filter.minRelevanceScore ?? "", onChange: (e) => onFilterChange({
                                    minRelevanceScore: e.target.value
                                        ? Number(e.target.value)
                                        : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u4E0D\u9650" }), _jsx("option", { value: "0.9", children: "90%+" }), _jsx("option", { value: "0.8", children: "80%+" }), _jsx("option", { value: "0.7", children: "70%+" }), _jsx("option", { value: "0.6", children: "60%+" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u72B6\u6001" }), _jsx("select", { value: prefs.filter.status ?? "", onChange: (e) => onFilterChange({
                                    status: e.target.value || undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: EVENT_STATUS_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) })] })] }))] }));
}
export function HotspotsFilterBar({ monitors, prefs, onSortChange, onFilterChange, onClearFilter, onQuickFilterChange, }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs("div", { className: "mb-4 rounded-[1.4rem] bg-white/70 p-4", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u5FEB\u6377:" }), [
                        { value: "", label: "全部" },
                        { value: "today", label: "今日最新" },
                        { value: "week", label: "本周热门" },
                    ].map((opt) => (_jsx("button", { type: "button", onClick: () => onQuickFilterChange(opt.value), className: `rounded-full px-3 py-1 text-xs font-semibold transition-colors ${prefs.quickFilter === opt.value
                            ? "bg-[var(--ember)] text-white"
                            : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)]"}`, children: opt.label }, opt.value)))] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("span", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6392\u5E8F:" }), _jsx("select", { value: `${prefs.sort.field}-${prefs.sort.order}`, onChange: (e) => {
                            const [field, order] = e.target.value.split("-");
                            onSortChange(field, order);
                        }, className: "rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: HOTSPOT_SORT_OPTIONS.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), _jsx("button", { type: "button", onClick: () => setExpanded(!expanded), className: `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${prefs.filter.monitorId !== undefined ||
                            prefs.filter.minScore !== undefined ||
                            prefs.filter.minCoverage !== undefined
                            ? "bg-[var(--ember)] text-white"
                            : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"}`, children: expanded ? "收起筛选" : "更多筛选" }), (prefs.filter.monitorId !== undefined ||
                        prefs.filter.minScore !== undefined ||
                        prefs.filter.minCoverage !== undefined) && (_jsx("button", { type: "button", onClick: onClearFilter, className: "rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600", children: "\u6E05\u9664\u7B5B\u9009" }))] }), expanded && (_jsxs("div", { className: "mt-4 grid gap-4 border-t border-[rgba(8,17,31,0.08)] pt-4 md:grid-cols-2 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u76D1\u63A7\u4EFB\u52A1" }), _jsxs("select", { value: prefs.filter.monitorId ?? "", onChange: (e) => onFilterChange({
                                    monitorId: e.target.value ? Number(e.target.value) : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u5168\u90E8\u4EFB\u52A1" }), monitors.map((m) => (_jsx("option", { value: m.id, children: m.name }, m.id)))] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6700\u4F4E\u70ED\u70B9\u8BC4\u5206" }), _jsxs("select", { value: prefs.filter.minScore ?? "", onChange: (e) => onFilterChange({
                                    minScore: e.target.value ? Number(e.target.value) : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u4E0D\u9650" }), _jsx("option", { value: "0.9", children: "90%+" }), _jsx("option", { value: "0.8", children: "80%+" }), _jsx("option", { value: "0.7", children: "70%+" }), _jsx("option", { value: "0.6", children: "60%+" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-[var(--ink-soft)]", children: "\u6700\u4F4E\u6765\u6E90\u6570" }), _jsxs("select", { value: prefs.filter.minCoverage ?? "", onChange: (e) => onFilterChange({
                                    minCoverage: e.target.value ? Number(e.target.value) : undefined,
                                }), className: "w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs", children: [_jsx("option", { value: "", children: "\u4E0D\u9650" }), _jsx("option", { value: "3", children: "3+ \u4E2A\u6765\u6E90" }), _jsx("option", { value: "5", children: "5+ \u4E2A\u6765\u6E90" }), _jsx("option", { value: "10", children: "10+ \u4E2A\u6765\u6E90" })] })] })] }))] }));
}
