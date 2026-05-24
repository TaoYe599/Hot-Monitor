import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { DEFAULT_NOTIFICATION_CHANNELS, DEFAULT_SOURCE_CONFIG, } from "@hot-monitor/shared";
import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, } from "react";
import { NavLink, Route, Routes } from "react-router";
import { EventsFilterBar, HotspotsFilterBar, useEventsPrefs, useHotspotsPrefs, } from "./components/FilterBar";
import { EventsPanel } from "./components/EventsPanel";
import { HotspotPanel } from "./components/HotspotPanel";
import { HotspotPagination } from "./components/HotspotPagination";
import { api, splitLines } from "./lib/api";
const defaultMonitorForm = {
    name: "",
    mode: "keyword",
    query: "",
    description: "",
    intervalMinutes: 15,
    cooldownMinutes: 60,
    enabled: true,
    sources: DEFAULT_SOURCE_CONFIG,
    notifyChannels: DEFAULT_NOTIFICATION_CHANNELS,
};
function toSettingsForm(settings) {
    return {
        emailTo: settings.emailTo,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpPassword: settings.smtpPassword,
        smtpFrom: settings.smtpFrom,
    };
}
function modeLabel(mode) {
    return mode === "keyword" ? "关键词监控" : "主题热点";
}
function queryLabel(mode) {
    return mode === "keyword" ? "监控关键词" : "监控主题";
}
function queryHint(mode) {
    return mode === "keyword"
        ? "输入你想精准盯住的词，比如 GPT-5.4、Claude Code、DeepSeek-R1。"
        : "输入你想持续观察的方向，比如 OpenAI、AI 编程、多模态模型。";
}
function queryPrefix(mode) {
    return mode === "keyword" ? "关键词" : "主题";
}
function jobSummary(job) {
    if (job.status === "queued")
        return `任务已提交，正在排队：${job.monitorName}`;
    if (job.status === "running")
        return `正在后台扫描：${job.monitorName}`;
    if (job.status === "cancelled")
        return `已取消：${job.monitorName}`;
    if (job.status === "failed") {
        return `扫描失败：${job.monitorName}${job.error ? `，${job.error}` : ""}`;
    }
    const candidates = job.summary?.candidates ?? 0;
    const accepted = job.summary?.acceptedEvents.length ?? 0;
    const hotspots = job.summary?.hotspots.length ?? 0;
    return candidates > 0 || accepted > 0 || hotspots > 0
        ? `扫描完成：${job.monitorName} 发现 ${candidates} 个候选内容，生成 ${accepted} 条命中、${hotspots} 个热点。`
        : `扫描完成：${job.monitorName} 本次没有发现可用候选内容。`;
}
function Panel(props) {
    return (_jsxs("section", { className: "panel-card rounded-[1.9rem] p-6", children: [_jsx("h2", { className: "text-2xl font-semibold", children: props.title }), props.body ? (_jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--ink-soft)]", children: props.body })) : null, _jsx("div", { className: "mt-5", children: props.children })] }));
}
function Field(props) {
    return (_jsxs("label", { className: "grid gap-2 text-sm", children: [_jsx("span", { className: "font-semibold", children: props.label }), props.description ? (_jsx("span", { className: "text-xs leading-5 text-[var(--ink-soft)]", children: props.description })) : null, props.children] }));
}
function Empty({ text }) {
    return (_jsx("div", { className: "rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]", children: text }));
}
function formatSourceHost(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    catch {
        return url;
    }
}
function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function EventList({ events }) {
    if (events.length === 0) {
        return _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u547D\u4E2D\u4E8B\u4EF6\u3002\u521B\u5EFA\u4E00\u4E2A\u5173\u952E\u8BCD\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" });
    }
    return (_jsx(_Fragment, { children: events.map((event) => (_jsxs("article", { className: "mb-4 rounded-[1.4rem] bg-white/70 p-5", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("strong", { children: event.title }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: ["\u771F\u5B9E\u6027 ", Math.round(event.authenticityScore * 100), "%"] }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: ["\u76F8\u5173\u6027 ", Math.round(event.relevanceScore * 100), "%"] })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--ink-soft)]", children: event.summary })] }, event.id))) }));
}
function HotspotList({ hotspots }) {
    if (hotspots.length === 0) {
        return _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" });
    }
    return (_jsx(_Fragment, { children: hotspots.map((hotspot) => (_jsxs("article", { className: "mb-4 rounded-[1.5rem] bg-white/70 p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("strong", { children: hotspot.label }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "mono text-xs text-[var(--ink-soft)]", title: hotspot.createdAt, children: formatRelativeTime(hotspot.createdAt) }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: [Math.round(hotspot.score * 100), "%"] })] })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--ink-soft)]", children: hotspot.summary }), hotspot.supportingUrls?.length ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: hotspot.supportingUrls.slice(0, 3).map((url) => (_jsx("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "mono rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-soft)] hover:border-[var(--ember)] hover:text-[var(--ember)] max-w-[12rem] truncate", title: url, children: formatSourceHost(url) }, url))) })) : null] }, hotspot.id))) }));
}
export default function App() {
    const [snapshot, setSnapshot] = useState(null);
    const [jobs, setJobs] = useState([]);
    const [pendingJobIds, setPendingJobIds] = useState([]);
    const [monitorForm, setMonitorForm] = useState(defaultMonitorForm);
    const [settingsForm, setSettingsForm] = useState(null);
    const [settingsDirty, setSettingsDirty] = useState(false);
    const [status, setStatus] = useState("booting");
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    // 排序和筛选状态
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [filteredHotspots, setFilteredHotspots] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [hotspotsLoading, setHotspotsLoading] = useState(false);
    const [hotspotsTotal, setHotspotsTotal] = useState(0);
    const [hotspotsPage, setHotspotsPage] = useState(1);
    const [hotspotsPageSize, setHotspotsPageSize] = useState(10);
    // 选择状态
    const [selectedEventIds, setSelectedEventIds] = useState(new Set());
    const [expandedReasons, setExpandedReasons] = useState(new Set());
    // 热点选择状态
    const [selectedHotspotIds, setSelectedHotspotIds] = useState(new Set());
    const [expandedHotspotReasons, setExpandedHotspotReasons] = useState(new Set());
    // 排序和筛选 hooks
    const eventsPrefs = useEventsPrefs(snapshot?.monitors ?? []);
    const hotspotsPrefs = useHotspotsPrefs(snapshot?.monitors ?? []);
    // 加载筛选后的 events
    const loadFilteredEvents = useCallback(async (sort, filter) => {
        setEventsLoading(true);
        try {
            const events = await api.listEvents({ sort, filter, limit: 100 });
            setFilteredEvents(events);
        }
        catch (err) {
            console.warn("[loadFilteredEvents] failed:", err);
        }
        finally {
            setEventsLoading(false);
        }
    }, []);
    // 加载筛选后的 hotspots
    const loadFilteredHotspots = useCallback(async (sort, filter, page = 1, pageSize = 10) => {
        setHotspotsLoading(true);
        setHotspotsPage(page);
        setHotspotsPageSize(pageSize);
        try {
            const offset = (page - 1) * pageSize;
            const result = await api.listHotspots({ sort, filter, limit: pageSize, offset });
            setFilteredHotspots(result.hotspots);
            setHotspotsTotal(result.total);
        }
        catch (err) {
            console.warn("[loadFilteredHotspots] failed:", err);
        }
        finally {
            setHotspotsLoading(false);
        }
    }, []);
    // 当排序/筛选改变时，重新加载 events
    useEffect(() => {
        loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
    }, [eventsPrefs.prefs.sort, eventsPrefs.prefs.filter, loadFilteredEvents]);
    // 当排序/筛选改变时，重新加载 hotspots
    useEffect(() => {
        loadFilteredHotspots(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, hotspotsPage, hotspotsPageSize);
    }, [hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, hotspotsPage, hotspotsPageSize, loadFilteredHotspots]);
    const jobsByMonitorId = useMemo(() => new Map(jobs.map((job) => [job.monitorId, job])), [jobs]);
    const mergeJob = useEffectEvent((job) => {
        setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)].slice(0, 12));
        if (job.status === "queued" || job.status === "running") {
            setPendingJobIds((current) => (current.includes(job.id) ? current : [...current, job.id]));
            return;
        }
        setPendingJobIds((current) => current.filter((id) => id !== job.id));
        setNotice(jobSummary(job));
    });
    const refresh = useEffectEvent(async () => {
        try {
            const [dashboard, scanJobs] = await Promise.all([
                api.getDashboard(),
                api.listScanJobs(),
            ]);
            startTransition(() => {
                setSnapshot(dashboard);
                setJobs(scanJobs);
                setPendingJobIds(scanJobs.filter((job) => job.status === "queued" || job.status === "running").map((job) => job.id));
                setSettingsForm((current) => {
                    if (!dashboard.settings)
                        return current;
                    return settingsDirty && current ? current : toSettingsForm(dashboard.settings);
                });
                setStatus("live");
                setError(null);
            });
        }
        catch (reason) {
            console.warn("[refresh] failed:", reason);
            setStatus("degraded");
        }
    });
    // Retry logic for initial load with exponential backoff
    const hasLoadedRef = useRef(false);
    useEffect(() => {
        if (hasLoadedRef.current)
            return;
        hasLoadedRef.current = true;
        let retries = 0;
        const maxRetries = 5;
        const baseDelay = 1000;
        function attemptRefresh() {
            refresh()
                .then(() => {
                retries = 0; // Reset retries on success
            })
                .catch(() => {
                if (retries < maxRetries) {
                    retries++;
                    const delay = baseDelay * Math.pow(2, retries - 1);
                    console.warn(`[init] refresh failed, retry ${retries}/${maxRetries} in ${delay}ms`);
                    setTimeout(attemptRefresh, delay);
                }
                else {
                    console.warn("[init] max retries reached, giving up");
                }
            });
        }
        attemptRefresh();
    }, [refresh]);
    // Track SSE reconnection state to avoid duplicate reconnection attempts
    const sseConnectedRef = useRef(false);
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;
    const loadFilteredEventsRef = useRef(loadFilteredEvents);
    loadFilteredEventsRef.current = loadFilteredEvents;
    const loadFilteredHotspotsRef = useRef(loadFilteredHotspots);
    loadFilteredHotspotsRef.current = loadFilteredHotspots;
    useEffect(() => {
        let stream;
        let reconnectTimer = null;
        let destroyed = false;
        function connect() {
            if (destroyed)
                return;
            stream = new EventSource("/api/stream");
            stream.onopen = () => {
                sseConnectedRef.current = true;
                setStatus("live");
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
            };
            stream.onerror = () => {
                sseConnectedRef.current = false;
                setStatus("reconnecting");
                stream.close();
                // Attempt to reconnect after 3 seconds if not destroyed
                if (!destroyed && !reconnectTimer) {
                    reconnectTimer = setTimeout(() => {
                        reconnectTimer = null;
                        connect();
                    }, 3000);
                }
            };
            const refreshHandler = () => void refreshRef.current();
            const loadFilteredHandler = () => {
                // 获取当前排序和筛选状态
                void loadFilteredEventsRef.current(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
                void loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, hotspotsPage, hotspotsPageSize);
            };
            stream.addEventListener("event.created", loadFilteredHandler);
            stream.addEventListener("hotspot.created", loadFilteredHandler);
            stream.addEventListener("notification.sent", refreshHandler);
            stream.addEventListener("scan.job.updated", (event) => {
                try {
                    const parsed = JSON.parse(event.data);
                    mergeJob(parsed.payload);
                }
                catch {
                    void refreshRef.current();
                }
            });
        }
        connect();
        return () => {
            destroyed = true;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
            }
            stream?.close();
        };
    }, [mergeJob, eventsPrefs.prefs, hotspotsPrefs.prefs]);
    useEffect(() => {
        if (pendingJobIds.length === 0)
            return;
        const timer = setInterval(() => {
            pendingJobIds.forEach((jobId) => {
                void api.getScanJob(jobId)
                    .then((job) => {
                    mergeJob(job);
                    if (job.status === "succeeded" || job.status === "failed") {
                        void refresh();
                    }
                })
                    .catch((reason) => {
                    console.warn("[poll] getScanJob failed:", reason);
                });
            });
        }, 2500);
        return () => clearInterval(timer);
    }, [mergeJob, pendingJobIds, refresh]);
    const summary = useMemo(() => busy ?? error ?? notice ?? `当前已加载 ${snapshot?.monitors.length ?? 0} 个任务`, [busy, error, notice, snapshot]);
    function updateSettingsField(updater) {
        setSettingsDirty(true);
        setSettingsForm((current) => (current ? updater(current) : current));
    }
    async function createMonitor(event) {
        event.preventDefault();
        setBusy("正在创建任务…");
        setError(null);
        setNotice(null);
        try {
            await api.createMonitor(monitorForm);
            setMonitorForm(defaultMonitorForm);
            setNotice("任务已创建，可以点击“扫描”提交后台任务。");
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function runMonitor(id) {
        setBusy("正在提交后台扫描任务…");
        setError(null);
        setNotice(null);
        try {
            const job = await api.runMonitor(id);
            mergeJob(job);
            setNotice(jobSummary(job));
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function patchMonitor(monitor, patch) {
        setBusy(`正在更新 ${monitor.name}…`);
        setError(null);
        setNotice(null);
        try {
            await api.updateMonitor(monitor.id, patch);
            setNotice(`${monitor.name} 已更新。`);
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function deleteMonitor(monitor) {
        setBusy(`正在删除 ${monitor.name}…`);
        setError(null);
        setNotice(null);
        try {
            await api.deleteMonitor(monitor.id);
            setNotice(`${monitor.name} 已删除。`);
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function cancelScanJob(jobId) {
        setError(null);
        setNotice(null);
        try {
            await api.cancelScanJob(jobId);
            setNotice("扫描任务已取消。");
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
    }
    async function saveSettings(event) {
        event.preventDefault();
        if (!settingsForm)
            return;
        setBusy("正在保存通知配置…");
        setError(null);
        setNotice(null);
        try {
            const saved = await api.updateSettings(settingsForm);
            setSettingsForm(toSettingsForm(saved));
            setSettingsDirty(false);
            setNotice("通知配置已保存。");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function sendTestNotification() {
        setBusy("正在发送测试邮件…");
        setError(null);
        setNotice(null);
        try {
            await api.testNotification(["email"]);
            setNotice("测试邮件已发送，请检查收件箱。");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    // 批量选择处理
    function handleSelectAll(select) {
        if (select) {
            setSelectedEventIds(new Set(filteredEvents.map((e) => e.id)));
        }
        else {
            setSelectedEventIds(new Set());
        }
    }
    function handleSelectEvent(id, selected) {
        setSelectedEventIds((prev) => {
            const next = new Set(prev);
            if (selected) {
                next.add(id);
            }
            else {
                next.delete(id);
            }
            return next;
        });
    }
    // 全部展开/折叠
    function handleExpandAll() {
        setExpandedReasons(new Set(filteredEvents.map((e) => e.id)));
    }
    function handleCollapseAll() {
        setExpandedReasons(new Set());
    }
    function handleToggleReason(id) {
        setExpandedReasons((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            }
            else {
                next.add(id);
            }
            return next;
        });
    }
    // 批量标记已读
    async function handleBatchMarkRead() {
        if (selectedEventIds.size === 0)
            return;
        setBusy("正在标记已读…");
        setError(null);
        setNotice(null);
        try {
            await api.batchMarkEventsRead(Array.from(selectedEventIds));
            setSelectedEventIds(new Set());
            setNotice(`已将 ${selectedEventIds.size} 条事件标记为已读。`);
            await loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    // 批量删除
    async function handleBatchDelete() {
        if (selectedEventIds.size === 0)
            return;
        if (!window.confirm(`确定要删除选中的 ${selectedEventIds.size} 条事件吗？此操作不可恢复。`)) {
            return;
        }
        setBusy("正在删除…");
        setError(null);
        setNotice(null);
        try {
            await api.batchDeleteEvents(Array.from(selectedEventIds));
            setSelectedEventIds(new Set());
            setNotice(`已删除 ${selectedEventIds.size} 条事件。`);
            await loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    // 热点卡片批量选择处理
    function handleSelectHotspotAll(select) {
        if (select) {
            setSelectedHotspotIds(new Set(filteredHotspots.map((h) => h.id)));
        }
        else {
            setSelectedHotspotIds(new Set());
        }
    }
    function handleSelectHotspot(id, selected) {
        setSelectedHotspotIds((prev) => {
            const next = new Set(prev);
            if (selected) {
                next.add(id);
            }
            else {
                next.delete(id);
            }
            return next;
        });
    }
    // 热点卡片全部展开/折叠
    function handleExpandHotspotAll() {
        setExpandedHotspotReasons(new Set(filteredHotspots.map((h) => h.id)));
    }
    function handleCollapseHotspotAll() {
        setExpandedHotspotReasons(new Set());
    }
    function handleToggleHotspotReason(id) {
        setExpandedHotspotReasons((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            }
            else {
                next.add(id);
            }
            return next;
        });
    }
    return (_jsx("div", { className: "min-h-screen px-4 py-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-7xl space-y-5", children: [_jsx("header", { className: "panel-card radar-panel rounded-[2rem] p-6", children: _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:justify-between", children: [_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[rgba(8,17,31,0.08)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-[var(--signal)]" }), "AI Hot Signal Radar"] }), _jsx("h1", { className: "mt-4 text-4xl font-bold tracking-tight sm:text-5xl", children: "Hot Monitor \u60C5\u62A5\u96F7\u8FBE\u53F0" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base", children: "\u81EA\u52A8\u6293\u53D6\u591A\u6E90\u70ED\u70B9\uFF0C\u501F\u52A9 OpenRouter \u505A\u771F\u5047\u5224\u5B9A\u4E0E\u805A\u7C7B\uFF0C\u518D\u901A\u8FC7\u90AE\u4EF6\u53D1\u51FA\u63D0\u9192\u3002" })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                                    ["运行监控", String(snapshot?.stats.activeMonitors ?? 0)],
                                    ["有效命中", String(snapshot?.stats.acceptedEvents ?? 0)],
                                    ["热点簇", String(snapshot?.stats.hotspots ?? 0)],
                                    ["状态", status],
                                ].map(([label, value]) => (_jsxs("div", { className: "panel-card rounded-[1.4rem] p-4", children: [_jsx("div", { className: "mono text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]", children: label }), _jsx("div", { className: "mt-3 text-3xl font-semibold", children: value })] }, label))) })] }) }), status === "degraded" && !snapshot && (_jsxs("div", { className: "rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800", children: [_jsx("strong", { children: "\u540E\u7AEF\u670D\u52A1\u672A\u8FDE\u63A5\u3002" }), " \u8BF7\u786E\u4FDD\u540E\u7AEF\u670D\u52A1\u6B63\u5728\u8FD0\u884C\uFF1A", _jsx("code", { className: "rounded bg-amber-100 px-1", children: "pnpm dev" }), "\u3002\u5982\u679C\u95EE\u9898\u6301\u7EED\uFF0C\u8BF7\u68C0\u67E5\u7AEF\u53E3 8787 \u662F\u5426\u88AB\u5360\u7528\uFF1A", _jsx("code", { className: "rounded bg-amber-100 px-1", children: "netstat -ano | findstr :8787" })] })), _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row", children: [_jsx("aside", { className: "panel-card rounded-[2rem] p-3 lg:w-72", children: _jsx("nav", { className: "grid gap-2", children: [["/", "总览"], ["/monitors", "任务管理"], ["/hotspots", "热点发现"], ["/settings", "通知设置"]].map(([to, label]) => (_jsx(NavLink, { to: to, end: to === "/", className: ({ isActive }) => `rounded-[1.3rem] px-4 py-3 text-sm font-semibold ${isActive ? "bg-[var(--ember-soft)] text-[var(--ember)]" : "bg-white/60 text-[var(--ink-soft)]"}`, children: label }, to))) }) }), _jsx("main", { className: "min-w-0 flex-1", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[1.08fr_0.92fr]", children: [_jsxs("div", { children: [_jsx(EventsFilterBar, { monitors: snapshot?.monitors ?? [], prefs: eventsPrefs.prefs, onSortChange: eventsPrefs.setSort, onFilterChange: eventsPrefs.setFilter, onClearFilter: eventsPrefs.clearFilter, onQuickFilterChange: eventsPrefs.setQuickFilter }), _jsx(Panel, { title: "\u5B9E\u65F6\u547D\u4E2D", body: "\u8FD9\u91CC\u5C55\u793A\u5173\u952E\u8BCD\u76D1\u63A7\u547D\u4E2D\u7684\u7ED3\u679C\u3002", children: _jsx(EventsPanel, { events: filteredEvents, loading: eventsLoading, monitors: snapshot?.monitors ?? [], selectedIds: selectedEventIds, expandedReasons: expandedReasons, onSelectAll: handleSelectAll, onSelectEvent: handleSelectEvent, onExpandAll: handleExpandAll, onCollapseAll: handleCollapseAll, onToggleReason: handleToggleReason, onMarkRead: handleBatchMarkRead, onDelete: handleBatchDelete }) })] }), _jsxs("div", { className: "grid gap-5", children: [_jsx(Panel, { title: "\u70ED\u70B9\u5FEB\u7167", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: snapshot?.hotspots?.length ? _jsx(HotspotList, { hotspots: snapshot.hotspots.slice(0, 3) }) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" }) }), _jsx(Panel, { title: "\u626B\u63CF\u4EFB\u52A1", body: "\u626B\u63CF\u63D0\u4EA4\u540E\u4F1A\u5728\u540E\u53F0\u6267\u884C\uFF0C\u5E76\u5728\u8FD9\u91CC\u66F4\u65B0\u72B6\u6001\u3002", children: jobs.length ? jobs.slice(0, 6).map((job) => _jsxs("article", { className: "mb-3 rounded-[1.4rem] bg-white/70 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("strong", { children: job.monitorName }), _jsx("span", { className: "mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]", children: job.status }), (job.status === "queued" || job.status === "running") ? _jsx("button", { type: "button", className: "rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]", onClick: () => void cancelScanJob(job.id), children: "\u53D6\u6D88" }) : null] }), _jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--ink-soft)]", children: jobSummary(job) })] }, job.id)) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u626B\u63CF\u4EFB\u52A1\u8BB0\u5F55\u3002" }) })] })] }) }), _jsx(Route, { path: "/monitors", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[1fr_0.78fr]", children: [_jsx("form", { className: "panel-card rounded-[2rem] p-6", onSubmit: createMonitor, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u4EFB\u52A1\u540D\u79F0", description: "\u53EA\u7528\u4E8E\u5361\u7247\u6807\u9898\u548C\u4EFB\u52A1\u533A\u5206\uFF0C\u4E0D\u53C2\u4E0E\u641C\u7D22\u3002", children: _jsx("input", { value: monitorForm.name, onChange: (event) => setMonitorForm((current) => ({ ...current, name: event.target.value })) }) }), _jsx(Field, { label: "\u76D1\u63A7\u6A21\u5F0F", description: "\u5173\u952E\u8BCD\u76D1\u63A7\u7528\u4E8E\u7CBE\u51C6\u547D\u4E2D\uFF0C\u4E3B\u9898\u70ED\u70B9\u7528\u4E8E\u5468\u671F\u6027\u53D1\u73B0\u3002", children: _jsxs("select", { value: monitorForm.mode, onChange: (event) => setMonitorForm((current) => ({ ...current, mode: event.target.value })), children: [_jsx("option", { value: "keyword", children: "\u5173\u952E\u8BCD\u76D1\u63A7" }), _jsx("option", { value: "topic", children: "\u4E3B\u9898\u70ED\u70B9" })] }) }), _jsx(Field, { label: queryLabel(monitorForm.mode), description: queryHint(monitorForm.mode), children: _jsx("input", { placeholder: monitorForm.mode === "keyword" ? "例如：GPT-5.4" : "例如：OpenAI", value: monitorForm.query, onChange: (event) => setMonitorForm((current) => ({ ...current, query: event.target.value })) }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "\u8F6E\u8BE2\u95F4\u9694", description: "\u7CFB\u7EDF\u591A\u4E45\u81EA\u52A8\u68C0\u67E5\u4E00\u6B21\u3002", children: _jsx("input", { type: "number", value: monitorForm.intervalMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) })) }) }), _jsx(Field, { label: "\u51B7\u5374\u65F6\u95F4", description: "\u4E24\u6B21\u76F8\u4F3C\u63D0\u9192\u4E4B\u95F4\u81F3\u5C11\u95F4\u9694\u591A\u4E45\u3002", children: _jsx("input", { type: "number", value: monitorForm.cooldownMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) })) }) })] }), _jsx(Field, { label: "\u6570\u636E\u6E90", description: "\u52FE\u9009\u8981\u542F\u7528\u7684\u4FE1\u606F\u6E90\u3002", children: _jsx("div", { className: "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3", children: [
                                                                        ["twitter", "Twitter/X"],
                                                                        ["search", "DuckDuckGo"],
                                                                        ["rss", "官方博客"],
                                                                        ["github", "GitHub"],
                                                                        ["hackernews", "Hacker News"],
                                                                        ["weibo", "微博"],
                                                                        ["zhihu", "知乎"],
                                                                        ["baidu", "百度"],
                                                                        ["reddit", "Reddit"],
                                                                    ].map(([key, label]) => (_jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: monitorForm.sources[key], onChange: (e) => setMonitorForm((c) => ({
                                                                                    ...c,
                                                                                    sources: { ...c.sources, [key]: e.target.checked },
                                                                                })), className: "w-4 h-4 rounded border-[rgba(8,17,31,0.15)] text-[var(--ember)] focus:ring-[var(--ember)] focus:ring-offset-0 cursor-pointer" }), _jsx("span", { className: "text-[var(--ink)]", children: label })] }, key))) }) }), _jsx("button", { type: "submit", className: "rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white", children: "\u521B\u5EFA\u4EFB\u52A1" })] }) }), _jsx("div", { className: "grid gap-4", children: (snapshot?.monitors ?? []).map((monitor) => { const job = jobsByMonitorId.get(monitor.id); const isRunning = job?.status === "queued" || job?.status === "running"; return _jsx("article", { className: "panel-card rounded-[1.6rem] p-5", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-[var(--ember-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember)]", children: modeLabel(monitor.mode) }), _jsxs("span", { className: "mono rounded-full border border-[rgba(8,17,31,0.08)] px-3 py-1 text-xs text-[var(--ink-soft)]", children: [monitor.intervalMinutes, " min"] }), job ? _jsx("span", { className: "mono rounded-full border border-[rgba(19,138,123,0.16)] bg-[var(--signal-soft)] px-3 py-1 text-xs text-[var(--signal)]", children: job.status }) : null] }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold", children: monitor.name }), _jsxs("p", { className: "mt-1 text-sm text-[var(--ink-soft)]", children: [queryPrefix(monitor.mode), "\uFF1A", monitor.query] })] }), job ? _jsx("p", { className: "text-sm text-[var(--ink-soft)]", children: jobSummary(job) }) : null] }), _jsxs("div", { className: "flex flex-wrap gap-2 md:max-w-[20rem] md:justify-end", children: [_jsx("button", { type: "button", className: "rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60", disabled: isRunning, onClick: () => void runMonitor(monitor.id), children: isRunning ? "扫描中…" : "扫描" }), (job?.status === "queued" || job?.status === "running") ? _jsx("button", { type: "button", className: "rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]", onClick: () => void cancelScanJob(job.id), children: "\u53D6\u6D88" }) : null, _jsx("button", { type: "button", className: "rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]", onClick: () => void patchMonitor(monitor, { enabled: !monitor.enabled }), children: monitor.enabled ? "停用" : "启用" }), _jsx("button", { type: "button", className: "rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]", onClick: () => void deleteMonitor(monitor), children: "\u5220\u9664" })] })] }) }, monitor.id); }) })] }) }), _jsx(Route, { path: "/hotspots", element: _jsxs("div", { children: [_jsx(HotspotsFilterBar, { monitors: snapshot?.monitors ?? [], prefs: hotspotsPrefs.prefs, onSortChange: (field, order) => { hotspotsPrefs.setSort(field, order); loadFilteredHotspotsRef.current({ field, order }, hotspotsPrefs.prefs.filter, 1, hotspotsPageSize); }, onFilterChange: (filter) => { hotspotsPrefs.setFilter(filter); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, filter, 1, hotspotsPageSize); }, onClearFilter: () => { hotspotsPrefs.setFilter({}); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, {}, 1, hotspotsPageSize); }, onQuickFilterChange: (quick) => { hotspotsPrefs.setQuickFilter(quick); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, { ...hotspotsPrefs.prefs.filter, timeRange: quick || undefined }, 1, hotspotsPageSize); } }), _jsx(Panel, { title: "\u70ED\u70B9\u53D1\u73B0", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: _jsx(HotspotPanel, { hotspots: filteredHotspots, loading: hotspotsLoading, selectedIds: selectedHotspotIds, expandedReasons: expandedHotspotReasons, onSelectAll: handleSelectHotspotAll, onSelectHotspot: handleSelectHotspot, onExpandAll: handleExpandHotspotAll, onCollapseAll: handleCollapseHotspotAll, onToggleReason: handleToggleHotspotReason }) }), _jsx(HotspotPagination, { page: hotspotsPage, pageSize: hotspotsPageSize, total: hotspotsTotal, onPageChange: (page) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, page, hotspotsPageSize), onPageSizeChange: (size) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, 1, size) })] }) }), _jsx(Route, { path: "/settings", element: settingsForm ? _jsx(Panel, { title: "\u901A\u77E5\u8BBE\u7F6E", body: "\u914D\u7F6E\u90AE\u4EF6\u901A\u77E5\u7684 SMTP \u670D\u52A1\u5668\u548C\u6536\u4EF6\u4EBA\u3002", children: _jsxs("form", { className: "grid gap-5", onSubmit: saveSettings, children: [_jsx(Field, { label: "\u901A\u77E5\u90AE\u7BB1", children: _jsx("textarea", { rows: 2, placeholder: "\u6BCF\u884C\u4E00\u4E2A\u90AE\u7BB1", value: settingsForm.emailTo.join("\n"), onChange: (event) => updateSettingsField((current) => ({ ...current, emailTo: splitLines(event.target.value) })) }) }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsx(Field, { label: "SMTP \u670D\u52A1\u5668", children: _jsx("input", { placeholder: "smtp.example.com", value: settingsForm.smtpHost ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null })) }) }), _jsx(Field, { label: "\u7AEF\u53E3", children: _jsx("input", { type: "number", placeholder: "587", value: settingsForm.smtpPort ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null })) }) }), _jsx(Field, { label: "\u53D1\u4EF6\u4EBA", children: _jsx("input", { placeholder: "noreply@example.com", value: settingsForm.smtpFrom ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null })) }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(Field, { label: "\u7528\u6237\u540D", children: _jsx("input", { value: settingsForm.smtpUser ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null })) }) }), _jsx(Field, { label: "\u5BC6\u7801", children: _jsx("input", { type: "password", value: settingsForm.smtpPassword ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null })) }) })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "submit", className: "rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white", children: "\u4FDD\u5B58" }), _jsx("button", { type: "button", className: "rounded-full bg-[var(--ember)] px-5 py-2 text-sm font-semibold text-white", onClick: () => void sendTestNotification(), children: "\u6D4B\u8BD5" })] })] }) }) : _jsx(Empty, { text: "\u6B63\u5728\u52A0\u8F7D..." }) })] }) })] })] }) }));
}
