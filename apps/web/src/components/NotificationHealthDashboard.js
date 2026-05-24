import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
export function NotificationHealthDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(true);
        api.getNotificationStats()
            .then(setStats)
            .catch(console.warn)
            .finally(() => setLoading(false));
    }, []);
    const deliveryPct = stats ? Math.round(stats.deliveryRate * 100) : 100;
    const noisePct = stats ? Math.round(stats.noiseRatio * 100) : 0;
    if (loading) {
        return (_jsxs("div", { className: "flex items-center justify-center py-6", children: [_jsxs("svg", { className: "animate-spin h-6 w-6 text-[var(--ember)]", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" })] }), _jsx("span", { className: "ml-3 text-sm text-[var(--ink-soft)]", children: "\u52A0\u8F7D\u5065\u5EB7\u6570\u636E..." })] }));
    }
    if (!stats) {
        return (_jsx("div", { className: "text-center py-6 text-sm text-[var(--ink-soft)]", children: "\u6682\u65E0\u6295\u9012\u6570\u636E" }));
    }
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: "panel-card rounded-[1.4rem] p-4 text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-[#10b981]", children: [deliveryPct, "%"] }), _jsx("div", { className: "text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide", children: "\u9001\u8FBE\u7387" })] }), _jsxs("div", { className: "panel-card rounded-[1.4rem] p-4 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-[#0284c7]", children: stats.total }), _jsx("div", { className: "text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide", children: "\u603B\u6295\u9012" })] }), _jsxs("div", { className: "panel-card rounded-[1.4rem] p-4 text-center", children: [_jsxs("div", { className: "text-2xl font-bold text-[#f59e0b]", children: [noisePct, "%"] }), _jsx("div", { className: "text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide", children: "\u566A\u97F3\u6BD4" })] }), _jsxs("div", { className: "panel-card rounded-[1.4rem] p-4 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-red-500", children: stats.failed }), _jsx("div", { className: "text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide", children: "\u5931\u8D25\u6570" })] })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs text-[var(--ink-soft)] mb-1.5", children: [_jsx("span", { children: "\u9001\u8FBE\u6210\u529F\u7387" }), _jsxs("span", { className: deliveryPct >= 95 ? "text-[#10b981]" : deliveryPct >= 80 ? "text-[#f59e0b]" : "text-red-500", children: [deliveryPct, "%"] })] }), _jsx("div", { className: "h-2.5 rounded-full bg-[rgba(8,17,31,0.06)] overflow-hidden", children: _jsx("div", { className: "h-full rounded-full transition-all duration-500", style: {
                                width: `${deliveryPct}%`,
                                backgroundColor: deliveryPct >= 95 ? "#10b981" : deliveryPct >= 80 ? "#f59e0b" : "#ef4444",
                            } }) }), deliveryPct < 95 && (_jsx("p", { className: "text-xs text-[#f59e0b] mt-1.5", children: "\u90E8\u5206\u90AE\u4EF6\u6295\u9012\u5931\u8D25\uFF0C\u53EF\u80FD\u662F\u76EE\u6807\u90AE\u7BB1\u6EE1\u5458\u6216\u88AB\u5224\u5B9A\u4E3A\u5783\u573E\u90AE\u4EF6\u3002" }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-xs text-[var(--ink-soft)] mb-1.5", children: [_jsx("span", { children: "\u566A\u97F3\u6BD4\uFF08\u4E0D\u76F8\u5173\u53CD\u9988\u7387\uFF09" }), _jsxs("span", { children: [stats.irrelevantCount, " \u6761\u6807\u8BB0 / ", stats.relevantCount + stats.irrelevantCount, " \u6761\u53CD\u9988"] })] }), _jsx("div", { className: "h-2.5 rounded-full bg-[rgba(8,17,31,0.06)] overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-[#f59e0b] transition-all duration-500", style: { width: `${Math.min(noisePct * 2, 100)}%` } }) }), stats.noiseRatio > 0.3 && (_jsx("p", { className: "text-xs text-[#f59e0b] mt-1.5", children: "\u566A\u97F3\u6BD4\u8F83\u9AD8\uFF0C\u5EFA\u8BAE\u8C03\u6574\u89C4\u5219\u7684\u8FC7\u6EE4\u9608\u503C\u6216\u5173\u952E\u8BCD\u914D\u7F6E\u3002" }))] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs text-[var(--ink-soft)] mb-3 uppercase tracking-wide", children: "\u8FD1 7 \u5929\u6295\u9012\u8D8B\u52BF" }), _jsx("div", { className: "grid grid-cols-7 gap-2", children: stats.dailyStats.map((day) => {
                            const date = new Date(day.date);
                            const dayName = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
                            const maxBar = Math.max(...stats.dailyStats.map((d) => d.sent), 1);
                            return (_jsxs("div", { className: "flex flex-col items-center gap-1.5", children: [_jsx("div", { className: "w-full h-12 flex items-end justify-center", children: _jsx("div", { className: "w-6 rounded-sm bg-[#10b981]/70 transition-all duration-300", style: { height: `${Math.max((day.sent / maxBar) * 100, 4)}%` } }) }), _jsx("span", { className: "text-[10px] text-[var(--ink-soft)]", children: dayName }), _jsx("span", { className: "text-[10px] font-semibold text-[var(--ink)]", children: day.sent })] }, day.date));
                        }) })] }), _jsxs("p", { className: "text-[10px] text-[var(--ink-soft)] text-center", children: ["\u6570\u636E\u57FA\u4E8E\u6700\u8FD1 30 \u5929 ", stats.total, " \u6761\u901A\u77E5\u65E5\u5FD7\u7EDF\u8BA1"] })] }));
}
