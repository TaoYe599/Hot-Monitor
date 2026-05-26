import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { DEFAULT_SOURCE_CONFIG, } from "@hot-monitor/shared";
import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router";
import { EventsFilterBar, HotspotsFilterBar, useEventsPrefs, useHotspotsPrefs, } from "./components/FilterBar";
import { EventsPanel } from "./components/EventsPanel";
import { HotspotPanel } from "./components/HotspotPanel";
import { HotspotPagination } from "./components/HotspotPagination";
import { NotificationHealthDashboard } from "./components/NotificationHealthDashboard";
import { api } from "./lib/api";
const defaultMonitorForm = {
    name: "",
    query: "",
    description: "",
    intervalMinutes: 15,
    cooldownMinutes: 60,
    enabled: true,
    sources: DEFAULT_SOURCE_CONFIG,
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
        eventRetentionDays: settings.eventRetentionDays,
        hotspotRetentionDays: settings.hotspotRetentionDays,
    };
}
function modeLabel() {
    return "关键词监控";
}
function queryLabel() {
    return "监控关键词";
}
function queryHint() {
    return "输入你想精准盯住的词，比如 GPT-5.4、Claude Code、DeepSeek-R1。";
}
function queryPrefix() {
    return "关键词";
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
    const navigate = useNavigate();
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
    // 监控任务编辑状态
    const [editingMonitorId, setEditingMonitorId] = useState(null);
    // 智能订阅规则列表与编辑表单状态
    const [subRules, setSubRules] = useState([]);
    const [newRuleForm, setNewRuleForm] = useState(null);
    const [editingRuleId, setEditingRuleId] = useState(null);
    const [editingRuleForm, setEditingRuleForm] = useState(null);
    const [smtpNotice, setSmtpNotice] = useState(null);
    const [testingRuleId, setTestingRuleId] = useState(null);
    const [updatingRuleId, setUpdatingRuleId] = useState(null);
    // 本地临时接收邮箱输入字符状态，避免在输入期间即时拆分和反向冲刷覆盖
    const [newRecipientsInput, setNewRecipientsInput] = useState("");
    const [editRecipientsInput, setEditRecipientsInput] = useState("");
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
                setSubRules(dashboard.subscriptionRules ?? []);
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
    // Service Worker 更新通知处理
    useEffect(() => {
        if (!("serviceWorker" in navigator))
            return;
        function handleSWUpdate() {
            setNotice("有新版本可用，正在刷新页面...");
            setTimeout(() => window.location.reload(), 1500);
        }
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data?.type === "SW_UPDATED") {
                handleSWUpdate();
            }
        });
        // 检查是否有正在等待的新 SW
        navigator.serviceWorker.ready.then((registration) => {
            if (registration.waiting) {
                handleSWUpdate();
            }
        });
    }, []);
    const summary = useMemo(() => busy ?? error ?? notice ?? `当前已加载 ${snapshot?.monitors.length ?? 0} 个任务`, [busy, error, notice, snapshot]);
    function updateSettingsField(updater) {
        setSettingsDirty(true);
        setSettingsForm((current) => (current ? updater(current) : current));
    }
    async function saveMonitor(event) {
        event.preventDefault();
        setError(null);
        setNotice(null);
        if (editingMonitorId === null) {
            setBusy("正在创建任务…");
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
        else {
            setBusy("正在保存任务修改…");
            try {
                await api.updateMonitor(editingMonitorId, monitorForm);
                setMonitorForm(defaultMonitorForm);
                setEditingMonitorId(null);
                setNotice("任务修改已成功保存。");
                await refresh();
            }
            catch (reason) {
                setError(reason instanceof Error ? reason.message : String(reason));
            }
            finally {
                setBusy(null);
            }
        }
    }
    function handleStartEdit(monitor) {
        setEditingMonitorId(monitor.id);
        setMonitorForm({
            name: monitor.name,
            query: monitor.query,
            description: monitor.description ?? "",
            intervalMinutes: monitor.intervalMinutes,
            cooldownMinutes: monitor.cooldownMinutes,
            enabled: monitor.enabled,
            sources: monitor.sources,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function handleCancelEdit() {
        setEditingMonitorId(null);
        setMonitorForm(defaultMonitorForm);
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
    // =========================================================================
    // 局部状态解耦与就地 UX 交互状态
    // =========================================================================
    const [formBusy, setFormBusy] = useState(false);
    const [formError, setFormError] = useState(null);
    const [editBusy, setEditBusy] = useState(false);
    const [editError, setEditError] = useState(null);
    const [smtpBusy, setSmtpBusy] = useState(false);
    const [smtpError, setSmtpError] = useState(null);
    const [smtpTestBusy, setSmtpTestBusy] = useState(false);
    const [cleanupBusy, setCleanupBusy] = useState(false);
    const [cleanupNotice, setCleanupNotice] = useState(null);
    async function triggerManualCleanup() {
        if (!window.confirm("确认要立即清理数据库中超过天数策略的历史事件和热点数据吗？此操作将永久删除数据且不可恢复！")) {
            return;
        }
        setCleanupBusy(true);
        setCleanupNotice(null);
        try {
            const data = await api.cleanupSettings({
                eventRetentionDays: settingsForm?.eventRetentionDays,
                hotspotRetentionDays: settingsForm?.hotspotRetentionDays,
            });
            setCleanupNotice(`历史数据清理完成！成功删除了 ${data.deletedEvents} 条过期事件，${data.deletedHotspots} 条过期热点。`);
            await refresh();
        }
        catch (err) {
            alert(`数据清理失败：${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            setCleanupBusy(false);
        }
    }
    // =========================================================================
    // 智能订阅通知规则交互逻辑群
    // =========================================================================
    const defaultNewRuleForm = {
        name: "",
        enabled: true,
        monitorIds: null,
        includeKeywords: [],
        andKeywords: [],
        excludeKeywords: [],
        minScore: 0.7,
        minTrustScore: 0.55,
        minSupportingSources: 1,
        prefetchMinutes: 0,
        deliveryFrequency: "instant",
        deliveryTime: "09:00",
        recipients: [],
    };
    async function createSubRule(event) {
        event.preventDefault();
        if (!newRuleForm)
            return;
        // 将本地临时多邮箱状态解析并装载到表单参数中，支持换行、中英文逗号、分号及空格拆分
        const recipientsArray = newRecipientsInput.split(/[\n,，;\s]+/).map((s) => s.trim()).filter(Boolean);
        // 统一进行关键词的清洗，排除输入过程中的多余空项
        const finalForm = {
            ...newRuleForm,
            recipients: recipientsArray,
            includeKeywords: newRuleForm.includeKeywords.map((s) => s.trim()).filter(Boolean),
            andKeywords: newRuleForm.andKeywords.map((s) => s.trim()).filter(Boolean),
            excludeKeywords: newRuleForm.excludeKeywords.map((s) => s.trim()).filter(Boolean),
        };
        // 前端即时强校验，避免发送垃圾请求
        if (!finalForm.name.trim()) {
            setFormError("订阅规则名称不能为空，请输入具有识别度的规则名称。");
            return;
        }
        if (finalForm.recipients.length === 0) {
            setFormError("目标邮箱不能为空，请至少配置一个有效的接收人邮箱。");
            return;
        }
        setFormBusy(true);
        setFormError(null);
        try {
            await api.createSubscriptionRule(finalForm);
            setNewRuleForm(null);
            setFormError(null);
            setNotice("智能订阅规则已成功创建并开启！");
            await refresh();
        }
        catch (reason) {
            setFormError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setFormBusy(false);
        }
    }
    async function updateSubRule(id, patch) {
        setEditBusy(true);
        setEditError(null);
        try {
            await api.updateSubscriptionRule(id, patch);
            setNotice("订阅规则配置已成功更新！");
            await refresh();
        }
        catch (reason) {
            setEditError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setEditBusy(false);
        }
    }
    async function toggleRuleEnabled(rule) {
        setUpdatingRuleId(rule.id);
        try {
            await api.updateSubscriptionRule(rule.id, { enabled: !rule.enabled });
            setNotice(`已${!rule.enabled ? "启用" : "停用"}订阅规则「${rule.name}」`);
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setUpdatingRuleId(null);
        }
    }
    async function deleteSubRule(id) {
        if (!window.confirm("确定要删除这条订阅分流规则吗？此操作将立即停止向该规则关联的邮箱推送消息。"))
            return;
        setBusy("正在移除订阅规则…");
        setError(null);
        setNotice(null);
        try {
            await api.deleteSubscriptionRule(id);
            setNotice("订阅分流规则已成功移除。");
            await refresh();
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function testSubRule(id) {
        setTestingRuleId(id);
        setError(null);
        setNotice(null);
        try {
            await api.testSubscriptionRuleNotification(id);
            setNotice("测试分流邮件已成功发出，请检查关联目标邮箱的收件箱！");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setTestingRuleId(null);
        }
    }
    return (_jsx("div", { className: "min-h-screen px-4 py-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-7xl space-y-5", children: [_jsx("header", { className: "panel-card radar-panel rounded-[2rem] p-6", children: _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:justify-between", children: [_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[rgba(8,17,31,0.08)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-[var(--signal)]" }), "AI Hot Signal Radar"] }), _jsx("h1", { className: "mt-4 text-4xl font-bold tracking-tight sm:text-5xl", children: "Hot Monitor \u60C5\u62A5\u96F7\u8FBE\u53F0" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base", children: "\u81EA\u52A8\u6293\u53D6\u591A\u6E90\u70ED\u70B9\uFF0C\u501F\u52A9 OpenRouter \u505A\u771F\u5047\u5224\u5B9A\u4E0E\u805A\u7C7B\uFF0C\u518D\u901A\u8FC7\u90AE\u4EF6\u53D1\u51FA\u63D0\u9192\u3002" })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                                    ["运行监控", String(snapshot?.stats.activeMonitors ?? 0)],
                                    ["有效命中", String(snapshot?.stats.acceptedEvents ?? 0)],
                                    ["热点簇", String(snapshot?.stats.hotspots ?? 0)],
                                    ["状态", status],
                                ].map(([label, value]) => (_jsxs("div", { className: "panel-card rounded-[1.4rem] p-4", children: [_jsx("div", { className: "mono text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]", children: label }), _jsx("div", { className: "mt-3 text-3xl font-semibold", children: value })] }, label))) })] }) }), status === "degraded" && !snapshot && (_jsxs("div", { className: "rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800", children: [_jsx("strong", { children: "\u540E\u7AEF\u670D\u52A1\u672A\u8FDE\u63A5\u3002" }), " \u8BF7\u786E\u4FDD\u540E\u7AEF\u670D\u52A1\u6B63\u5728\u8FD0\u884C\uFF1A", _jsx("code", { className: "rounded bg-amber-100 px-1", children: "pnpm dev" }), "\u3002\u5982\u679C\u95EE\u9898\u6301\u7EED\uFF0C\u8BF7\u68C0\u67E5\u7AEF\u53E3 8787 \u662F\u5426\u88AB\u5360\u7528\uFF1A", _jsx("code", { className: "rounded bg-amber-100 px-1", children: "netstat -ano | findstr :8787" })] })), _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row", children: [_jsx("aside", { className: "panel-card rounded-[2rem] p-3 lg:w-72", children: _jsx("nav", { className: "grid gap-2", children: [["/", "总览"], ["/monitors", "任务管理"], ["/hotspots", "热点发现"], ["/settings", "通知设置"]].map(([to, label]) => (_jsx(NavLink, { to: to, end: to === "/", className: ({ isActive }) => `rounded-[1.3rem] px-4 py-3 text-sm font-semibold ${isActive ? "bg-[var(--ember-soft)] text-[var(--ember)]" : "bg-white/60 text-[var(--ink-soft)]"}`, children: label }, to))) }) }), _jsxs("main", { className: "min-w-0 flex-1", children: [(busy || error || notice) && (_jsx("div", { className: `mb-4 rounded-xl px-4 py-3 text-sm font-medium ${error
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : busy
                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                            : "bg-green-50 text-green-700 border border-green-200"}`, children: error || busy || notice })), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[1.08fr_0.92fr]", children: [_jsxs("div", { children: [_jsx(EventsFilterBar, { monitors: snapshot?.monitors ?? [], prefs: eventsPrefs.prefs, onSortChange: eventsPrefs.setSort, onFilterChange: eventsPrefs.setFilter, onClearFilter: eventsPrefs.clearFilter, onQuickFilterChange: eventsPrefs.setQuickFilter }), _jsx(Panel, { title: "\u5B9E\u65F6\u547D\u4E2D", body: "\u8FD9\u91CC\u5C55\u793A\u5173\u952E\u8BCD\u76D1\u63A7\u547D\u4E2D\u7684\u7ED3\u679C\u3002", children: _jsx(EventsPanel, { events: filteredEvents, loading: eventsLoading, monitors: snapshot?.monitors ?? [], selectedIds: selectedEventIds, expandedReasons: expandedReasons, onSelectAll: handleSelectAll, onSelectEvent: handleSelectEvent, onExpandAll: handleExpandAll, onCollapseAll: handleCollapseAll, onToggleReason: handleToggleReason, onMarkRead: handleBatchMarkRead, onDelete: handleBatchDelete }) })] }), _jsxs("div", { className: "grid gap-5", children: [_jsx(Panel, { title: "\u70ED\u70B9\u5FEB\u7167", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: snapshot?.hotspots?.length ? _jsx(HotspotList, { hotspots: snapshot.hotspots.slice(0, 3) }) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u547E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" }) }), _jsx(Panel, { title: "\u626B\u63CF\u4EFB\u52A1", body: "\u626B\u63CF\u63D0\u4EA4\u540E\u4F1A\u5728\u540E\u53F0\u6267\u884C\uFF0C\u5E76\u5728\u8FD9\u91CC\u66F4\u65B0\u72B6\u6001\u3002", children: jobs.length ? jobs.slice(0, 6).map((job) => _jsxs("article", { className: "mb-3 rounded-[1.4rem] bg-white/70 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("strong", { children: job.monitorName }), _jsx("span", { className: "mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]", children: job.status }), (job.status === "queued" || job.status === "running") ? _jsx("button", { type: "button", className: "rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]", onClick: () => void cancelScanJob(job.id), children: "\u53D6\u6D88" }) : null] }), _jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--ink-soft)]", children: jobSummary(job) })] }, job.id)) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u626B\u63CF\u4EFB\u52A1\u8BB0\u5F55\u3002" }) })] })] }) }), _jsx(Route, { path: "/monitors", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[1fr_0.78fr]", children: [_jsxs("form", { className: "panel-card rounded-[2rem] p-6 h-fit", onSubmit: saveMonitor, children: [_jsxs("h3", { className: "text-lg font-bold mb-5 flex items-center justify-between gap-2 select-none text-[var(--ink)] tracking-tight", children: [_jsx("span", { children: editingMonitorId === null ? "新建监控画布" : "编辑监控画布 (编辑中)" }), editingMonitorId !== null && (_jsx("button", { type: "button", onClick: handleCancelEdit, className: "rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 cursor-pointer transition-colors", children: "取消编辑" }))] }), _jsxs("div", { className: "grid gap-5", children: [_jsx(Field, { label: "\u4EFB\u52A1\u540D\u79F0", children: _jsx("input", { placeholder: "\u4F8B\u5982\uFF1A\u7F51\u7EDC\u5B89\u5168\u6F0F\u6D1E\u76D1\u63A7", value: monitorForm.name, onChange: (event) => setMonitorForm((current) => ({ ...current, name: event.target.value })) }) }), _jsx(Field, { label: queryLabel(), children: _jsx("input", { placeholder: "\u8F93\u5165\u76D1\u6D4B\u7684\u5173\u952E\u8BCD\uFF0C\u7528\u9017\u53F7\u5206\u9694\uFF0C\u4F8B\u5982\uFF1AGPT-5.4", value: monitorForm.query, onChange: (event) => setMonitorForm((current) => ({ ...current, query: event.target.value })) }) }), _jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(Field, { label: "\u8F6E\u8BE2\u95F4\u9694", children: _jsxs("div", { className: "relative", children: [_jsx("input", { type: "number", className: "pr-14", placeholder: "15", value: monitorForm.intervalMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) })) }), _jsx("span", { className: "absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-soft)] pointer-events-none select-none", children: "\u5206\u949F" })] }) }), _jsx(Field, { label: "\u51B7\u5374\u65F6\u95F4", children: _jsxs("div", { className: "relative", children: [_jsx("input", { type: "number", className: "pr-14", placeholder: "60", value: monitorForm.cooldownMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) })) }), _jsx("span", { className: "absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-soft)] pointer-events-none select-none", children: "\u5206\u949F" })] }) })] }), _jsx(Field, { label: "\u76D1\u63A7\u6570\u636E\u6E90", children: _jsx("div", { className: "grid grid-cols-3 gap-2 pt-1 select-none", children: [
                                                            ["twitter", "Twitter/X"],
                                                            ["search", "DuckDuckGo"],
                                                            ["rss", "官方博客"],
                                                            ["github", "GitHub"],
                                                            ["hackernews", "Hacker News"],
                                                            ["weibo", "微博"],
                                                            ["zhihu", "知乎"],
                                                            ["baidu", "百度"],
                                                            ["reddit", "Reddit"],
                                                            ["bing", "Bing Search"],
                                                        ].map(([key, label]) => {
                                                            const isSelected = monitorForm.sources[key];
                                                            return (_jsxs("button", { type: "button", onClick: () => setMonitorForm((c) => ({
                                                                    ...c,
                                                                    sources: { ...c.sources, [key]: !isSelected },
                                                                })), className: `group flex items-center justify-center gap-1.5 rounded-lg border py-1.5 px-2 text-xs transition-all duration-200 cursor-pointer active:scale-95 smooth-interactive ${isSelected
                                                                    ? "bg-white text-[var(--ink)] border-[var(--ember)]/30 shadow-sm font-semibold"
                                                                    : "bg-white/40 text-slate-400 border-slate-100 hover:bg-white/80 hover:text-slate-600"}`, children: [isSelected && (_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-[var(--ember)] animate-pulse flex-shrink-0" })), _jsx("span", { children: label })] }, key));
                                                        }) }) }), _jsx("div", { className: "flex justify-center pt-2", children: _jsx("button", { type: "submit", className: "w-40 rounded-xl bg-[var(--ink)] py-2.5 text-xs font-bold text-white smooth-interactive active:scale-98 cursor-pointer shadow-md hover:shadow-lg transition-all duration-300", children: editingMonitorId === null ? "开启监控" : "保存修改" }) })] })] }), _jsx("div", { className: "grid gap-4.5", children: (snapshot?.monitors ?? []).map((monitor) => {
                                                            const job = jobsByMonitorId.get(monitor.id);
                                                            const isRunning = job?.status === "queued" || job?.status === "running";
                                                            const enabledSourcesCount = Object.values(monitor.sources).filter(Boolean).length;
                                                            return (_jsxs("article", { className: "group relative panel-card rounded-[1.6rem] bg-white/80 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-white/50 overflow-hidden cursor-default", children: [isRunning && (_jsx("span", { className: "absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--ember)] rounded-l-[1.6rem] animate-pulse" })), _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1.5 flex-1", children: [_jsx("h3", { className: `text-lg font-bold transition-colors duration-300 ${isRunning ? "text-[var(--ember)] animate-pulse" : "text-[var(--ink)]"}`, children: monitor.name }), _jsxs("p", { className: "text-xs text-[var(--ink-soft)] font-medium flex items-center gap-1.5 select-none", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-[rgba(8,17,31,0.2)]" }), modeLabel(), " \u00B7 \u6BCF ", monitor.intervalMinutes, " \u5206\u949F\u8F6E\u8BE2 \u00B7 ", enabledSourcesCount, " \u4E2A\u6570\u636E\u6E90"] })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsx("button", { type: "button", className: `relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${monitor.enabled ? "bg-[var(--ember)]" : "bg-gray-200"}`, onClick: () => void patchMonitor(monitor, { enabled: !monitor.enabled }), children: _jsx("span", { className: `pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${monitor.enabled ? "translate-x-4" : "translate-x-0"}` }) }) })] }), _jsxs("div", { className: "absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2", children: [_jsx("button", { type: "button", title: "编辑监控任务配置", className: "h-8 w-8 rounded-full border border-[var(--line)] bg-white/95 text-[var(--ink-soft)] flex items-center justify-center smooth-interactive cursor-pointer hover:border-[var(--ember)] hover:text-[var(--ember)]", onClick: () => handleStartEdit(monitor), children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" }) }) }), _jsx("button", { type: "button", disabled: isRunning, title: isRunning ? "正在后台轮询中" : "立即触发雷达扫描", className: "h-8 w-8 rounded-full border border-[var(--line)] bg-white/95 text-[var(--ink-soft)] flex items-center justify-center smooth-interactive cursor-pointer hover:border-[var(--ember)] hover:text-[var(--ember)] disabled:opacity-50", onClick: () => void runMonitor(monitor.id), children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsx("button", { type: "button", title: "\u4ECE\u96F7\u8FBE\u7F51\u79FB\u9664\u6B64\u76D1\u63A7", className: "h-8 w-8 rounded-full border border-red-100 bg-red-50 text-red-600 flex items-center justify-center smooth-interactive cursor-pointer hover:bg-red-100 hover:border-red-300", onClick: () => void deleteMonitor(monitor), children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" }) }) })] })] }, monitor.id));
                                                        }) })] }) }), _jsx(Route, { path: "/hotspots", element: _jsxs("div", { children: [_jsx(HotspotsFilterBar, { monitors: snapshot?.monitors ?? [], prefs: hotspotsPrefs.prefs, onSortChange: (field, order) => { hotspotsPrefs.setSort(field, order); loadFilteredHotspotsRef.current({ field, order }, hotspotsPrefs.prefs.filter, 1, hotspotsPageSize); }, onFilterChange: (filter) => { hotspotsPrefs.setFilter(filter); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, filter, 1, hotspotsPageSize); }, onClearFilter: () => { hotspotsPrefs.setFilter({}); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, {}, 1, hotspotsPageSize); }, onQuickFilterChange: (quick) => { hotspotsPrefs.setQuickFilter(quick); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, { ...hotspotsPrefs.prefs.filter, timeRange: quick || undefined }, 1, hotspotsPageSize); } }), _jsx(Panel, { title: "\u70ED\u70B9\u53D1\u73B0", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: _jsx(HotspotPanel, { hotspots: filteredHotspots, loading: hotspotsLoading }) }), _jsx(HotspotPagination, { page: hotspotsPage, pageSize: hotspotsPageSize, total: hotspotsTotal, onPageChange: (page) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, page, hotspotsPageSize), onPageSizeChange: (size) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, 1, size) })] }) }), _jsx(Route, { path: "/settings", element: settingsForm ? (_jsxs("div", { className: "space-y-6", children: [_jsx(Panel, { title: "\u53D1\u4FE1\u901A\u9053\u914D\u7F6E (SMTP)", body: "\u914D\u7F6E Hot-Monitor \u60C5\u62A5\u96F7\u8FBE\u6295\u9012\u53D1\u4FE1\u7684 SMTP \u7269\u7406\u901A\u9053\u670D\u52A1\u5668\u3002", children: _jsxs("form", { className: "grid gap-5", onSubmit: saveSettings, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "SMTP \u670D\u52A1\u5668", description: "\u53D1\u4FE1\u90AE\u5C40\u4E3B\u673A\u57DF\u540D\u3002", children: _jsx("input", { placeholder: "smtp.example.com", value: settingsForm.smtpHost ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null })) }) }), _jsx(Field, { label: "\u7AEF\u53E3", description: "\u5E38\u7528\u7AEF\u53E3 587 (TLS) \u6216 465 (SSL)\u3002", children: _jsx("input", { type: "number", placeholder: "587", value: settingsForm.smtpPort ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null })) }) }), _jsx(Field, { label: "\u53D1\u4EF6\u4EBA\u90AE\u7BB1", description: "\u5FC5\u987B\u662F\u7ECF\u8FC7\u90AE\u5C40\u6388\u6743\u7684\u53D1\u4EF6\u5730\u5740\u3002", children: _jsx("input", { placeholder: "noreply@example.com", value: settingsForm.smtpFrom ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null })) }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u53D1\u4EF6\u7528\u6237\u540D", description: "\u901A\u5E38\u4E0E\u53D1\u4EF6\u4EBA\u90AE\u7BB1\u4E00\u81F4\u3002", children: _jsx("input", { value: settingsForm.smtpUser ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null })) }) }), _jsx(Field, { label: "\u5BC6\u7801 / \u6388\u6743\u7801", description: "\u5404\u5927\u90AE\u5C40\uFF08\u5982 QQ, \u7F51\u6613\uFF09\u8BF7\u4F7F\u7528\u72EC\u7ACB\u751F\u6210\u7684\u6388\u6743\u7801\u3002", children: _jsx("input", { type: "password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: settingsForm.smtpPassword ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null })) }) })] }), smtpNotice && (_jsxs("div", { className: "rounded-[1.2rem] border border-green-200/50 bg-green-50/70 p-4 text-sm text-green-950 backdrop-blur-xl flex items-center justify-between gap-3 animate-pulse", children: [_jsxs("span", { className: "font-semibold flex items-center gap-1.5", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-green-600 animate-ping" }), "\u2728 ", smtpNotice] }), _jsx("button", { type: "button", onClick: () => setSmtpNotice(null), className: "text-green-600 hover:text-green-800 font-semibold select-none cursor-pointer", children: "\u2715" })] })), smtpError && (_jsxs("div", { className: "rounded-[1.2rem] border border-red-200/50 bg-red-50/70 p-4 text-sm text-red-950 backdrop-blur-xl flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("span", { className: "font-semibold text-red-700 flex items-center gap-1.5", children: "\u26A0\uFE0F \u901A\u9053\u914D\u7F6E/\u53D1\u4FE1\u5931\u8D25\uFF1A" }), _jsx("span", { className: "text-xs text-red-900/90 font-mono leading-5 whitespace-pre-wrap", children: smtpError })] }), _jsx("button", { type: "button", onClick: () => setSmtpError(null), className: "text-red-500 hover:text-red-700 font-semibold select-none cursor-pointer", children: "\u2715" })] })), _jsxs("div", { className: "flex items-center gap-3.5 pt-2", children: [_jsx("button", { type: "submit", disabled: smtpBusy || smtpTestBusy, className: "rounded-full bg-[var(--ink)] px-6 py-2.5 text-xs font-semibold text-white smooth-interactive active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer", children: smtpBusy ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-3.5 w-3.5 text-white", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u6B63\u5728\u4FDD\u5B58\u901A\u9053..."] })) : "保存通道配置" }), _jsx("button", { type: "button", disabled: smtpBusy || smtpTestBusy, className: "rounded-full border border-[var(--line)] bg-white/70 px-6 py-2.5 text-xs font-semibold text-[var(--ink-soft)] smooth-interactive hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer", onClick: () => void sendTestNotification(), children: smtpTestBusy ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-3.5 w-3.5 text-[var(--ember)]", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u6B63\u5728\u6D4B\u8BD5\u5E95\u5C42\u53D1\u4FE1..."] })) : "⚡ 测试底层发信" })] })] }) }), _jsx(Panel, { title: "\uD83E\uDDF9 \u6570\u636E\u751F\u547D\u5468\u671F\u7BA1\u7406", body: "\u914D\u7F6E\u6570\u636E\u5E93\u4E2D\u626B\u63CF\u4E8B\u4EF6\u548C\u70ED\u70B9\u6C47\u603B\u6570\u636E\u7684\u6700\u5927\u4FDD\u7559\u671F\u9650\u3002\u591A\u4F59\u7684\u6570\u636E\u5C06\u5B9A\u671F\u5728\u6BCF\u5929\u51CC\u6668 03:00 \u88AB\u81EA\u52A8\u6E05\u7406\u4EE5\u9632\u78C1\u76D8\u65E0\u9650\u81A8\u80C0\uFF0C\u60A8\u4E5F\u53EF\u4EE5\u968F\u65F6\u5728\u6B64\u624B\u52A8\u6E05\u7406\u3002", children: _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u539F\u59CB\u4E8B\u4EF6\u4FDD\u7559\u5929\u6570", description: "\u5E95\u5C42\u6293\u53D6\u5230\u7684\u672A\u805A\u7C7B\u4E8B\u4EF6\u6700\u5927\u4FDD\u7559\u671F\u9650\u3002", children: _jsx("input", { type: "number", min: "1", value: settingsForm.eventRetentionDays, onChange: (event) => updateSettingsField((current) => ({ ...current, eventRetentionDays: Number(event.target.value) || 30 })) }) }), _jsx(Field, { label: "\u70ED\u70B9\u6570\u636E\u4FDD\u7559\u5929\u6570", description: "AI \u805A\u7C7B\u805A\u5408\u51FA\u7684\u9AD8\u4EF7\u503C\u70ED\u70B9\u6570\u636E\u4FDD\u7559\u671F\u9650\u3002", children: _jsx("input", { type: "number", min: "1", value: settingsForm.hotspotRetentionDays, onChange: (event) => updateSettingsField((current) => ({ ...current, hotspotRetentionDays: Number(event.target.value) || 90 })) }) })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", disabled: smtpBusy || cleanupBusy, onClick: saveSettings, className: "rounded-full bg-[var(--ink)] px-6 py-2.5 text-xs font-semibold text-white smooth-interactive active:scale-95 cursor-pointer disabled:opacity-50", children: smtpBusy ? "正在保存配置..." : "保存天数策略" }), _jsx("button", { type: "button", disabled: smtpBusy || cleanupBusy, onClick: triggerManualCleanup, className: "rounded-full border border-red-200 bg-red-50/50 px-6 py-2.5 text-xs font-semibold text-red-600 smooth-interactive hover:bg-red-100 disabled:opacity-50 cursor-pointer flex items-center gap-1.5", children: cleanupBusy ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-3.5 w-3.5 text-red-600", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u6B63\u5728\u5F3A\u529B\u6E05\u7406\u4E2D..."] })) : "🧹 立即清理历史数据" })] }), cleanupNotice && (_jsxs("div", { className: "rounded-[1.2rem] border border-green-200/50 bg-green-50/70 p-4 text-sm text-green-950 backdrop-blur-xl flex items-center justify-between gap-3 animate-pulse", children: [_jsxs("span", { className: "font-semibold", children: ["\u2728 ", cleanupNotice] }), _jsx("button", { type: "button", onClick: () => setCleanupNotice(null), className: "text-green-600 hover:text-green-800 font-semibold select-none cursor-pointer", children: "\u2715" })] }))] }) }), _jsx(Panel, { title: "\uD83D\uDCCA \u8BA2\u9605\u6295\u9012\u5065\u5EB7\u76D1\u63A7", body: "\u5B9E\u65F6\u8FFD\u8E2A\u90AE\u4EF6\u9001\u8FBE\u7387\u4E0E\u7528\u6237\u53CD\u9988\u566A\u97F3\u6BD4\uFF0C\u5E2E\u52A9\u60A8\u8BC4\u4F30\u60C5\u62A5\u5206\u53D1\u7684\u8D28\u91CF\u3002", children: _jsx(NotificationHealthDashboard, {}) }), _jsx(Panel, { title: "\u667A\u80FD\u8BA2\u9605\u8DEF\u7531\u5206\u6D41", body: "\u5728\u6B64\u914D\u7F6E\u591A\u7EF4\u5EA6\u8DEF\u7531\u89C4\u5219\u3002\u7CFB\u7EDF\u5C06\u6839\u636E\u4E0D\u540C\u7684\u5173\u952E\u8BCD\u3001\u70ED\u5EA6\u5206\u6570\u95F8\u503C\uFF0C\u5C06\u5339\u914D\u7684\u70ED\u70B9\u60C5\u62A5\u7CBE\u51C6\u8DEF\u7531\u53D1\u9001\u81F3\u6307\u5B9A\u7684\u90AE\u7BB1\u4E2D\u3002", children: _jsxs("div", { className: "space-y-5", children: [newRuleForm !== null ? (_jsxs("form", { className: "panel-card rounded-[1.6rem] bg-white/70 p-6 grid gap-5", onSubmit: createSubRule, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-base font-semibold text-[var(--ink)]", children: "\u65B0\u5EFA\u8BA2\u9605\u89C4\u5219" }), _jsx("button", { type: "button", onClick: () => setNewRuleForm(null), className: "text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer", children: "\u53D6\u6D88" })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u89C4\u5219\u540D\u79F0", children: _jsx("input", { value: newRuleForm.name, onChange: (e) => setNewRuleForm((c) => c ? { ...c, name: e.target.value } : c), placeholder: "\u4F8B\u5982\uFF1ADeepSeek \u52A8\u6001\u9884\u8B66" }) }), _jsx(Field, { label: "\u53D1\u9001\u9891\u6B21", children: _jsxs("select", { value: newRuleForm.deliveryFrequency, onChange: (e) => setNewRuleForm((c) => c ? { ...c, deliveryFrequency: e.target.value } : c), children: [_jsx("option", { value: "instant", children: "\u26A1 \u79D2\u7EA7\u5B9E\u65F6\u9884\u8B66" }), _jsx("option", { value: "daily", children: "\uD83D\uDCC5 \u6BCF\u65E5\u5B9A\u65F6\u7B80\u62A5" }), _jsx("option", { value: "weekly", children: "\uD83D\uDCC5 \u6BCF\u5468\u5B9A\u65F6\u603B\u7ED3" })] }) })] }), newRuleForm.deliveryFrequency !== "instant" && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u5B9A\u65F6\u53D1\u9001\u65F6\u95F4", description: "\u652F\u6301\u591A\u4E2A\u65F6\u95F4\u70B9\uFF0C\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF0C\u4F8B\u5982 '09:00, 18:00'", children: _jsx("input", { value: newRuleForm.deliveryTime ?? "", onChange: (e) => setNewRuleForm((c) => c ? { ...c, deliveryTime: e.target.value || null } : c), placeholder: "09:00" }) }), _jsx(Field, { label: "\u7B80\u62A5\u63D0\u524D\u9884\u6293\u53D6\uFF08\u5206\u949F\uFF09", description: "\u5728\u53D1\u9001\u524D\u63D0\u524D\u591A\u5C11\u5206\u949F\u542F\u52A8\u5BF9\u5173\u8054\u6E90\u7684\u6700\u65B0\u6570\u636E\u6293\u53D6\u3002", children: _jsx("input", { type: "number", min: "0", max: "1440", value: newRuleForm.prefetchMinutes ?? 0, onChange: (e) => setNewRuleForm((c) => c ? { ...c, prefetchMinutes: e.target.value ? Number(e.target.value) : 0 } : c), placeholder: "10" }) })] })), _jsx(Field, { label: "\u9650\u5B9A\u76D1\u63A7\u6E90", description: "\u4E0D\u52FE\u9009\u8868\u793A\u5339\u914D\u5168\u7F51\u6240\u6709\u76D1\u63A7\u4EFB\u52A1", children: _jsxs("div", { className: "flex flex-wrap gap-2", children: [(snapshot?.monitors ?? []).map((m) => (_jsxs("label", { className: "inline-flex items-center gap-1.5 rounded-full border border-[rgba(8,17,31,0.08)] bg-white/60 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/80", children: [_jsx("input", { type: "checkbox", checked: newRuleForm.monitorIds?.includes(m.id) ?? false, onChange: (e) => {
                                                                                                    setNewRuleForm((c) => {
                                                                                                        if (!c)
                                                                                                            return c;
                                                                                                        const ids = c.monitorIds ?? [];
                                                                                                        return { ...c, monitorIds: e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id) };
                                                                                                    });
                                                                                                } }), m.name] }, m.id))), (snapshot?.monitors ?? []).length === 0 && _jsx("span", { className: "text-xs text-[var(--ink-soft)]", children: "\u6682\u65E0\u53EF\u7528\u76D1\u63A7\u4EFB\u52A1" })] }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "\u5305\u542B\u5173\u952E\u8BCD (OR)", children: _jsx("textarea", { value: newRuleForm.includeKeywords.join(", "), onChange: (e) => setNewRuleForm((c) => c ? { ...c, includeKeywords: e.target.value.split(",").map((s) => s.trim()) } : c), placeholder: "DeepSeek, Llama, GPT", rows: 2, className: "text-xs" }) }), _jsx(Field, { label: "\u5FC5\u987B\u5305\u542B (AND)", children: _jsx("textarea", { value: newRuleForm.andKeywords.join(", "), onChange: (e) => setNewRuleForm((c) => c ? { ...c, andKeywords: e.target.value.split(",").map((s) => s.trim()) } : c), placeholder: "\u5F00\u6E90, \u53D1\u5E03", rows: 2, className: "text-xs" }) }), _jsx(Field, { label: "\u6392\u9664\u5173\u952E\u8BCD (NOT)", children: _jsx("textarea", { value: newRuleForm.excludeKeywords.join(", "), onChange: (e) => setNewRuleForm((c) => c ? { ...c, excludeKeywords: e.target.value.split(",").map((s) => s.trim()) } : c), placeholder: "\u5E7F\u544A, \u63A8\u5E7F", rows: 2, className: "text-xs" }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: `热度阈值 ≥ ${Math.round(newRuleForm.minScore * 100)}%`, children: _jsx("input", { type: "range", min: "0", max: "100", value: newRuleForm.minScore * 100, onChange: (e) => setNewRuleForm((c) => c ? { ...c, minScore: Number(e.target.value) / 100 } : c), className: "w-full" }) }), _jsx(Field, { label: `最低信源数 ≥ ${newRuleForm.minSupportingSources}`, children: _jsx("input", { type: "range", min: "1", max: "10", value: newRuleForm.minSupportingSources, onChange: (e) => setNewRuleForm((c) => c ? { ...c, minSupportingSources: Number(e.target.value) } : c), className: "w-full" }) }), _jsx(Field, { label: `最低可信度 ≥ ${Math.round(newRuleForm.minTrustScore * 100)}%`, children: _jsx("input", { type: "range", min: "0", max: "100", value: newRuleForm.minTrustScore * 100, onChange: (e) => setNewRuleForm((c) => c ? { ...c, minTrustScore: Number(e.target.value) / 100 } : c), className: "w-full" }) })] }), _jsx(Field, { label: "\u63A5\u6536\u90AE\u7BB1", description: "\u652F\u6301\u4EE5\u6362\u884C\u3001\u9017\u53F7\u3001\u5206\u53F7\u6216\u7A7A\u683C\u5206\u9694\u591A\u4E2A\u63A5\u6536\u90AE\u7BB1", children: _jsx("textarea", { rows: 2, value: newRecipientsInput, onChange: (e) => setNewRecipientsInput(e.target.value), placeholder: "tech@company.com\ncto@company.com" }) }), formError && (_jsx("div", { className: "rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700", children: formError })), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "submit", disabled: formBusy, className: "rounded-full bg-[var(--ember)] px-6 py-2.5 text-xs font-semibold text-white smooth-interactive active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer", children: formBusy ? "创建中..." : "创建规则" }), _jsx("button", { type: "button", onClick: () => setNewRuleForm(null), className: "rounded-full border border-[var(--line)] bg-white/70 px-6 py-2.5 text-xs font-semibold text-[var(--ink-soft)] cursor-pointer", children: "\u53D6\u6D88" })] })] })) : (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("p", { className: "text-xs text-[var(--ink-soft)]", children: [subRules.length, " \u6761\u8BA2\u9605\u89C4\u5219"] }), _jsx("button", { onClick: () => { setNewRuleForm({ ...defaultNewRuleForm }); setNewRecipientsInput(""); }, className: "rounded-full bg-[var(--ember)] px-5 py-2 text-xs font-semibold text-white smooth-interactive active:scale-95 cursor-pointer", children: "+ \u65B0\u5EFA\u89C4\u5219" })] })), subRules.length > 0 && (_jsx("div", { className: "grid gap-4", children: subRules.map((rule) => {
                                                                        const isEditing = editingRuleId === rule.id;
                                                                        return (_jsx("article", { className: "panel-card rounded-[1.6rem] bg-white/70 p-5 transition-all duration-300", children: isEditing && editingRuleForm ? (
                                                                            /* 就地编辑表单 */
                                                                            _jsxs("form", { className: "grid gap-4", onSubmit: async (e) => {
                                                                                    e.preventDefault();
                                                                                    if (!editingRuleForm)
                                                                                        return;
                                                                                    // 将本地临时多邮箱状态解析并装载到表单参数中，支持换行、中英文逗号、分号及空格拆分
                                                                                    const recipientsArray = editRecipientsInput.split(/[\n,，;\s]+/).map((s) => s.trim()).filter(Boolean);
                                                                                    // 统一进行关键词的清洗，排除就地编辑保存过程中的多余空项
                                                                                    const finalForm = {
                                                                                        ...editingRuleForm,
                                                                                        recipients: recipientsArray,
                                                                                        includeKeywords: editingRuleForm.includeKeywords.map((s) => s.trim()).filter(Boolean),
                                                                                        andKeywords: editingRuleForm.andKeywords.map((s) => s.trim()).filter(Boolean),
                                                                                        excludeKeywords: editingRuleForm.excludeKeywords.map((s) => s.trim()).filter(Boolean),
                                                                                    };
                                                                                    if (!finalForm.name.trim()) {
                                                                                        setEditError("订阅规则名称不能为空。");
                                                                                        return;
                                                                                    }
                                                                                    if (finalForm.recipients.length === 0) {
                                                                                        setEditError("匹配邮箱不能为空，请配置至少一个接收人邮箱。");
                                                                                        return;
                                                                                    }
                                                                                    setEditBusy(true);
                                                                                    setEditError(null);
                                                                                    try {
                                                                                        await api.updateSubscriptionRule(rule.id, finalForm);
                                                                                        setEditingRuleId(null);
                                                                                        setNotice(`智能订阅规则「${finalForm.name}」已保存修改！`);
                                                                                        await refresh();
                                                                                    }
                                                                                    catch (reason) {
                                                                                        setEditError(reason instanceof Error ? reason.message : String(reason));
                                                                                    }
                                                                                    finally {
                                                                                        setEditBusy(false);
                                                                                    }
                                                                                }, children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u8BA2\u9605\u89C4\u5219\u540D\u79F0", children: _jsx("input", { value: editingRuleForm.name, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, name: e.target.value } : c) }) }), _jsx(Field, { label: "\u9891\u6B21\u7279\u5F81", children: _jsxs("select", { value: editingRuleForm.deliveryFrequency, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, deliveryFrequency: e.target.value } : c), children: [_jsx("option", { value: "instant", children: "\u26A1 \u79D2\u7EA7\u5B9E\u65F6\u9884\u8B66" }), _jsx("option", { value: "daily", children: "\uD83D\uDCC5 \u6BCF\u65E5\u5B9A\u65F6\u7B80\u62A5" }), _jsx("option", { value: "weekly", children: "\uD83D\uDCC5 \u6BCF\u5468\u5B9A\u65F6\u603B\u7ED3" })] }) })] }), editingRuleForm.deliveryFrequency !== "instant" && (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsx(Field, { label: "\u5B9A\u65F6\u53D1\u9001\u65F6\u95F4\u70B9", description: "\u652F\u6301\u914D\u7F6E\u591A\u4E2A\uFF0C\u82F1\u6587\u9017\u53F7\u5206\u9694\uFF0C\u4F8B\u5982 '09:00, 18:00'", children: _jsx("input", { value: editingRuleForm.deliveryTime ?? "", onChange: (e) => setEditingRuleForm((c) => c ? { ...c, deliveryTime: e.target.value || null } : c) }) }), _jsx(Field, { label: "\u7B80\u62A5\u63D0\u524D\u9884\u6293\u53D6\uFF08\u5206\u949F\uFF09", description: "\u5728\u53D1\u9001\u524D\u63D0\u524D\u591A\u5C11\u5206\u949F\u542F\u52A8\u5BF9\u5173\u8054\u6E90\u7684\u6700\u65B0\u6570\u636E\u6293\u53D6\u3002", children: _jsx("input", { type: "number", min: "0", max: "1440", value: editingRuleForm.prefetchMinutes ?? 0, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, prefetchMinutes: e.target.value ? Number(e.target.value) : 0 } : c), placeholder: "10" }) })] })), _jsx(Field, { label: "\u9650\u5B9A\u76D1\u63A7\u6E90", description: "\u4E0D\u52FE\u9009\u9ED8\u8BA4\u5339\u914D\u5168\u7F51\u6240\u6709\u76D1\u63A7\u4EFB\u52A1\u4EA7\u751F\u7684\u60C5\u62A5", children: _jsx("div", { className: "flex flex-wrap gap-2 pt-1.5", children: (snapshot?.monitors ?? []).map((m) => {
                                                                                                const checked = editingRuleForm.monitorIds?.includes(m.id) ?? false;
                                                                                                return (_jsx("button", { type: "button", onClick: () => {
                                                                                                        const currentIds = editingRuleForm.monitorIds ?? [];
                                                                                                        const nextIds = checked ? currentIds.filter(id => id !== m.id) : [...currentIds, m.id];
                                                                                                        setEditingRuleForm((c) => c ? { ...c, monitorIds: nextIds.length > 0 ? nextIds : null } : c);
                                                                                                    }, className: `rounded-full border px-3.5 py-1.5 text-xs font-semibold smooth-interactive cursor-pointer ${checked ? "bg-[var(--ember-soft)] text-[var(--ember)] border-[var(--ember)]/20" : "bg-white/60 text-[var(--ink-soft)] border-gray-100"}`, children: m.name }, m.id));
                                                                                            }) }) }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: "\u5305\u542B\u4EFB\u610F\u8BCD (OR)", description: "\u5339\u914D\u5176\u4E00\u5373\u53EF\uFF0C\u9017\u53F7/\u6362\u884C\u5206\u9694", children: _jsx("input", { placeholder: "\u5982: DeepSeek, Llama", value: editingRuleForm.includeKeywords.join(","), onChange: (e) => setEditingRuleForm((c) => c ? { ...c, includeKeywords: e.target.value.split(/[\r\n,，]+/).map((s) => s.trim()) } : c) }) }), _jsx(Field, { label: "\u5FC5\u987B\u540C\u65F6\u5305\u542B (AND)", description: "\u5339\u914D\u5168\u90E8\uFF0C\u9017\u53F7/\u6362\u884C\u5206\u9694", children: _jsx("input", { placeholder: "\u5982: \u5F00\u6E90, \u6743\u91CD", value: editingRuleForm.andKeywords.join(","), onChange: (e) => setEditingRuleForm((c) => c ? { ...c, andKeywords: e.target.value.split(/[\r\n,，]+/).map((s) => s.trim()) } : c) }) }), _jsx(Field, { label: "\u6392\u9664\u8BCD\u8FC7\u6EE4\u5668 (NOT)", description: "\u53EA\u8981\u547D\u4E2D\u5373\u5F3A\u529B\u62E6\u622A\uFF0C\u9017\u53F7/\u6362\u884C\u5206\u9694", children: _jsx("input", { placeholder: "\u5982: \u7092\u4F5C, \u516B\u5366", value: editingRuleForm.excludeKeywords.join(","), onChange: (e) => setEditingRuleForm((c) => c ? { ...c, excludeKeywords: e.target.value.split(/[\r\n,，]+/).map((s) => s.trim()) } : c) }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsx(Field, { label: `最低热度分闸值: ${Math.round(editingRuleForm.minScore * 100)}%`, children: _jsx("input", { type: "range", min: "0.0", max: "1.0", step: "0.05", value: editingRuleForm.minScore, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, minScore: Number(e.target.value) } : c) }) }), _jsx(Field, { label: `最低信源可信度: ${Math.round(editingRuleForm.minTrustScore * 100)}%`, children: _jsx("input", { type: "range", min: "0.0", max: "1.0", step: "0.05", value: editingRuleForm.minTrustScore, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, minTrustScore: Number(e.target.value) } : c) }) }), _jsx(Field, { label: `最少覆盖渠道: ${editingRuleForm.minSupportingSources} 个`, children: _jsx("input", { type: "number", min: "1", max: "10", value: editingRuleForm.minSupportingSources, onChange: (e) => setEditingRuleForm((c) => c ? { ...c, minSupportingSources: Number(e.target.value) } : c) }) })] }), _jsx(Field, { label: "\u76EE\u6807\u8DEF\u7531\u90AE\u7BB1", description: "\u652F\u6301\u4EE5\u6362\u884C\u3001\u9017\u53F7\u3001\u5206\u53F7\u6216\u7A7A\u683C\u5206\u9694\u591A\u4E2A\u63A5\u6536\u90AE\u7BB1", children: _jsx("textarea", { rows: 2, value: editRecipientsInput, onChange: (e) => setEditRecipientsInput(e.target.value) }) }), editError && (_jsxs("div", { className: "rounded-[1.2rem] border border-red-200/50 bg-red-50/70 p-4 text-sm text-red-950 backdrop-blur-xl flex items-start justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-red-500 font-semibold", children: "\u26A0\uFE0F \u4FEE\u6539\u5931\u8D25\uFF1A" }), _jsx("span", { className: "text-red-900/90 leading-5 whitespace-pre-wrap", children: editError })] }), _jsx("button", { type: "button", onClick: () => setEditError(null), className: "text-red-500 hover:text-red-700 font-semibold select-none cursor-pointer", children: "\u2715" })] })), _jsxs("div", { className: "flex gap-2.5 pt-2", children: [_jsx("button", { type: "submit", disabled: editBusy, className: "rounded-full bg-[var(--ink)] px-6 py-2.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm active:scale-95", children: editBusy ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-3.5 w-3.5 text-white", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u6B63\u5728\u4FDD\u5B58\u4FEE\u6539..."] })) : "保存修改" }), _jsx("button", { type: "button", disabled: editBusy, className: "rounded-full border border-gray-100 bg-white px-6 py-2.5 text-xs font-semibold text-[var(--ink-soft)] disabled:opacity-50 disabled:cursor-not-allowed smooth-interactive cursor-pointer", onClick: () => { setEditingRuleId(null); setEditError(null); }, children: "\u53D6\u6D88" })] })] })) : (
                                                                            /* 规则静态展示卡片 */
                                                                            _jsxs("div", { className: updatingRuleId === rule.id ? "opacity-50 pointer-events-none transition-opacity duration-300" : "transition-opacity duration-300", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 uppercase tracking-wider", children: rule.deliveryFrequency === "instant" ? "⚡ 秒级实时" : rule.deliveryFrequency === "daily" ? `📅 每日定时 (${rule.deliveryTime})` : `📅 每周定时 (${rule.deliveryTime})` }), _jsxs("span", { className: "mono rounded-full border border-[rgba(8,17,31,0.06)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)] font-medium", children: ["\u70ED\u5EA6\u5206 \u2265 ", Math.round(rule.minScore * 100), "%"] }), _jsxs("span", { className: "mono rounded-full border border-[rgba(8,17,31,0.06)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)] font-medium", children: ["\u4FE1\u6E90\u6570 \u2265 ", rule.minSupportingSources] })] }), _jsx("h3", { className: "text-lg font-bold text-[var(--ink)] mt-2.5", children: rule.name })] }), _jsx("button", { type: "button", disabled: updatingRuleId === rule.id, className: `relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${rule.enabled ? "bg-[var(--signal)]" : "bg-gray-200"}`, onClick: () => void toggleRuleEnabled(rule), children: _jsx("span", { className: `pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.enabled ? "translate-x-5" : "translate-x-0"}` }) })] }), _jsxs("div", { className: "mt-4 grid gap-2.5 text-xs text-[var(--ink-soft)] border-t border-gray-50 pt-3", children: [_jsxs("div", { children: [_jsx("strong", { className: "text-[var(--ink)]", children: "\u76D1\u63A7\u6E90\u9650\u5236\uFF1A" }), rule.monitorIds ? rule.monitorIds.map(id => snapshot?.monitors.find(m => m.id === id)?.name).filter(Boolean).join(", ") : "匹配全网监控任务"] }), rule.includeKeywords.length > 0 && (_jsxs("div", { children: [_jsx("strong", { className: "text-[var(--ink)]", children: "\u5305\u542B\u4EFB\u610F\u8BCD (OR)\uFF1A" }), rule.includeKeywords.map(kw => _jsx("span", { className: "inline-block bg-gray-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-gray-600", children: kw }, kw))] })), rule.andKeywords.length > 0 && (_jsxs("div", { children: [_jsx("strong", { className: "text-[var(--ink)]", children: "\u5FC5\u987B\u540C\u65F6\u5305\u542B (AND)\uFF1A" }), rule.andKeywords.map(kw => _jsx("span", { className: "inline-block bg-blue-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-blue-600", children: kw }, kw))] })), rule.excludeKeywords.length > 0 && (_jsxs("div", { children: [_jsx("strong", { className: "text-[var(--ink)]", children: "\u6392\u9664\u8FC7\u6EE4\u8BCD (NOT)\uFF1A" }), rule.excludeKeywords.map(kw => _jsx("span", { className: "inline-block bg-red-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-red-600", children: kw }, kw))] })), _jsxs("div", { children: [_jsx("strong", { className: "text-[var(--ink)]", children: "\u8DEF\u7531\u76EE\u6807\u90AE\u7BB1\uFF1A" }), rule.recipients.join(", ")] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-50", children: [_jsx("button", { type: "button", disabled: testingRuleId === rule.id || updatingRuleId === rule.id, className: "rounded-full bg-[var(--ember-soft)] px-4 py-2 text-xs font-semibold text-[var(--ember)] smooth-interactive active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer", onClick: () => void testSubRule(rule.id), children: testingRuleId === rule.id ? (_jsxs(_Fragment, { children: [_jsxs("svg", { className: "animate-spin h-3 w-3 text-[var(--ember)]", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "\u6D4B\u8BD5\u53D1\u9001\u4E2D..."] })) : "⚡ 实时测试发信" }), _jsx("button", { type: "button", disabled: testingRuleId === rule.id || updatingRuleId === rule.id, className: "rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink-soft)] smooth-interactive disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer", onClick: () => {
                                                                                                    setEditingRuleId(rule.id);
                                                                                                    setEditError(null);
                                                                                                    setEditingRuleForm({
                                                                                                        name: rule.name,
                                                                                                        enabled: rule.enabled,
                                                                                                        monitorIds: rule.monitorIds,
                                                                                                        includeKeywords: rule.includeKeywords,
                                                                                                        andKeywords: rule.andKeywords,
                                                                                                        excludeKeywords: rule.excludeKeywords,
                                                                                                        minScore: rule.minScore,
                                                                                                        minTrustScore: rule.minTrustScore,
                                                                                                        minSupportingSources: rule.minSupportingSources,
                                                                                                        prefetchMinutes: rule.prefetchMinutes,
                                                                                                        deliveryFrequency: rule.deliveryFrequency,
                                                                                                        deliveryTime: rule.deliveryTime,
                                                                                                        recipients: rule.recipients,
                                                                                                    });
                                                                                                    setEditRecipientsInput(rule.recipients.join("\n"));
                                                                                                }, children: "\u7F16\u8F91\u89C4\u5219" }), _jsx("button", { type: "button", disabled: testingRuleId === rule.id || updatingRuleId === rule.id, className: "rounded-full border border-red-100 bg-red-50/50 px-4 py-2 text-xs font-semibold text-red-600 smooth-interactive hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer", onClick: () => void deleteSubRule(rule.id), children: "\u5220\u9664" })] })] })) }, rule.id));
                                                                    }) }))] }) })] })) : (_jsxs("div", { className: "rounded-[2rem] bg-white/70 p-12 text-center flex flex-col items-center justify-center border border-[rgba(8,17,31,0.06)] shadow-sm backdrop-blur-xl", children: [_jsxs("svg", { className: "animate-spin h-10 w-10 text-[var(--ember)] mb-4", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-10", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "3" }), _jsx("path", { className: "opacity-90", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), _jsx("p", { className: "text-sm font-semibold text-[var(--ink-soft)] animate-pulse", children: "\u6B63\u5728\u5524\u9192\u53D1\u4FE1\u901A\u9053\u4E0E\u8BA2\u9605\u5206\u6D41\u7CFB\u7EDF..." })] })) })] })] })] })] }) }));
}
