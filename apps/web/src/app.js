import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { DEFAULT_NOTIFICATION_CHANNELS, DEFAULT_SOURCE_CONFIG, } from "@hot-monitor/shared";
import { startTransition, useEffect, useEffectEvent, useMemo, useState, } from "react";
import { NavLink, Route, Routes } from "react-router";
import { useRegisterSW } from "virtual:pwa-register/react";
import { api, splitLines } from "./lib/api";
import { subscribeToPush } from "./lib/push";
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
        webhookUrls: settings.webhookUrls,
        emailTo: settings.emailTo,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser,
        smtpPassword: settings.smtpPassword,
        smtpFrom: settings.smtpFrom,
        vapidPublicKey: settings.vapidPublicKey,
        vapidPrivateKey: settings.vapidPrivateKey,
        vapidSubject: settings.vapidSubject,
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
function HotspotList({ hotspots }) {
    if (hotspots.length === 0) {
        return _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" });
    }
    return (_jsx(_Fragment, { children: hotspots.map((hotspot) => (_jsxs("article", { className: "mb-4 rounded-[1.5rem] bg-white/70 p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("strong", { children: hotspot.label }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: [Math.round(hotspot.score * 100), "%"] })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--ink-soft)]", children: hotspot.summary }), hotspot.supportingUrls?.length ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: hotspot.supportingUrls.slice(0, 3).map((url) => (_jsxs("span", { className: "mono rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-soft)]", title: url, children: ["\u6765\u6E90\uFF1A", formatSourceHost(url)] }, url))) })) : null] }, hotspot.id))) }));
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
    const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
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
            });
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
            setStatus("degraded");
        }
    });
    useEffect(() => {
        void refresh();
    }, [refresh]);
    useEffect(() => {
        const stream = new EventSource("/api/stream");
        const refreshHandler = () => void refresh();
        const jobHandler = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                mergeJob(parsed.payload);
            }
            catch {
                void refresh();
            }
        };
        stream.addEventListener("event.created", refreshHandler);
        stream.addEventListener("hotspot.created", refreshHandler);
        stream.addEventListener("notification.sent", refreshHandler);
        stream.addEventListener("scan.job.updated", jobHandler);
        stream.onopen = () => setStatus("live");
        stream.onerror = () => setStatus("reconnecting");
        return () => stream.close();
    }, [mergeJob, refresh]);
    useEffect(() => {
        if (pendingJobIds.length === 0)
            return;
        const timer = setInterval(() => {
            pendingJobIds.forEach((jobId) => {
                void api.getScanJob(jobId).then((job) => {
                    mergeJob(job);
                    if (job.status === "succeeded" || job.status === "failed") {
                        void refresh();
                    }
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
    async function subscribePush() {
        if (!settingsForm?.vapidPublicKey) {
            setError("请先填写 VAPID Public Key。");
            return;
        }
        setBusy("正在订阅浏览器推送…");
        setError(null);
        setNotice(null);
        try {
            const subscription = await subscribeToPush(settingsForm.vapidPublicKey);
            if (subscription) {
                await api.savePushSubscription(subscription);
                setNotice("当前浏览器已完成推送订阅。");
            }
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    async function sendTestNotification() {
        setBusy("正在发送测试通知…");
        setError(null);
        setNotice(null);
        try {
            await api.testNotification(["push", "webhook", "email"]);
            setNotice("测试通知已发送，请检查你的通知渠道。");
        }
        catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        }
        finally {
            setBusy(null);
        }
    }
    return (_jsx("div", { className: "min-h-screen px-4 py-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-7xl space-y-5", children: [_jsx("header", { className: "panel-card radar-panel rounded-[2rem] p-6", children: _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row lg:justify-between", children: [_jsxs("div", { className: "max-w-3xl", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-[rgba(8,17,31,0.08)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]", children: [_jsx("span", { className: "h-2 w-2 rounded-full bg-[var(--signal)]" }), "AI Hot Signal Radar"] }), _jsx("h1", { className: "mt-4 text-4xl font-bold tracking-tight sm:text-5xl", children: "Hot Monitor \u60C5\u62A5\u96F7\u8FBE\u53F0" }), _jsx("p", { className: "mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base", children: "\u81EA\u52A8\u6293\u53D6\u591A\u6E90\u70ED\u70B9\uFF0C\u501F\u52A9 OpenRouter \u505A\u771F\u5047\u5224\u5B9A\u4E0E\u805A\u7C7B\uFF0C\u518D\u901A\u8FC7 Web Push\u3001Webhook \u548C\u90AE\u4EF6\u53D1\u51FA\u63D0\u9192\u3002" })] }), _jsx("div", { className: "grid gap-3 sm:grid-cols-2", children: [
                                    ["运行监控", String(snapshot?.stats.activeMonitors ?? 0)],
                                    ["有效命中", String(snapshot?.stats.acceptedEvents ?? 0)],
                                    ["热点簇", String(snapshot?.stats.hotspots ?? 0)],
                                    ["状态", status],
                                ].map(([label, value]) => (_jsxs("div", { className: "panel-card rounded-[1.4rem] p-4", children: [_jsx("div", { className: "mono text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]", children: label }), _jsx("div", { className: "mt-3 text-3xl font-semibold", children: value })] }, label))) })] }) }), _jsxs("div", { className: "panel-card flex flex-col gap-3 rounded-[1.5rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "text-sm text-[var(--ink-soft)]", children: summary }), needRefresh ? _jsx("button", { type: "button", className: "rounded-full bg-[var(--ember)] px-4 py-2 text-sm font-semibold text-white", onClick: () => void updateServiceWorker(true), children: "\u5237\u65B0\u5230\u65B0\u7248\u672C" }) : null] }), _jsxs("div", { className: "flex flex-col gap-5 lg:flex-row", children: [_jsx("aside", { className: "panel-card rounded-[2rem] p-3 lg:w-72", children: _jsx("nav", { className: "grid gap-2", children: [["/", "总览"], ["/monitors", "任务管理"], ["/hotspots", "热点发现"], ["/settings", "通知设置"]].map(([to, label]) => (_jsx(NavLink, { to: to, end: to === "/", className: ({ isActive }) => `rounded-[1.3rem] px-4 py-3 text-sm font-semibold ${isActive ? "bg-[var(--ember-soft)] text-[var(--ember)]" : "bg-white/60 text-[var(--ink-soft)]"}`, children: label }, to))) }) }), _jsx("main", { className: "min-w-0 flex-1", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[1.08fr_0.92fr]", children: [_jsx(Panel, { title: "\u5B9E\u65F6\u547D\u4E2D", body: "\u8FD9\u91CC\u5C55\u793A\u5173\u952E\u8BCD\u76D1\u63A7\u547D\u4E2D\u7684\u7ED3\u679C\u3002", children: snapshot?.events?.length ? snapshot.events.map((event) => _jsxs("article", { className: "mb-4 rounded-[1.4rem] bg-white/70 p-5", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("strong", { children: event.title }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: ["\u771F\u5B9E\u6027 ", Math.round(event.authenticityScore * 100), "%"] }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: ["\u76F8\u5173\u6027 ", Math.round(event.relevanceScore * 100), "%"] })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--ink-soft)]", children: event.summary })] }, event.id)) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u547D\u4E2D\u4E8B\u4EF6\u3002\u521B\u5EFA\u4E00\u4E2A\u5173\u952E\u8BCD\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" }) }), _jsxs("div", { className: "grid gap-5", children: [_jsx(Panel, { title: "\u70ED\u70B9\u5FEB\u7167", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: snapshot?.hotspots?.length ? snapshot.hotspots.slice(0, 3).map((hotspot) => _jsxs("article", { className: "mb-4 rounded-[1.5rem] bg-white/70 p-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("strong", { children: hotspot.label }), _jsxs("span", { className: "mono text-xs text-[var(--ink-soft)]", children: [Math.round(hotspot.score * 100), "%"] })] }), _jsx("p", { className: "mt-3 text-sm leading-6 text-[var(--ink-soft)]", children: hotspot.summary })] }, hotspot.id)) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" }) }), _jsx(Panel, { title: "\u626B\u63CF\u4EFB\u52A1", body: "\u626B\u63CF\u63D0\u4EA4\u540E\u4F1A\u5728\u540E\u53F0\u6267\u884C\uFF0C\u5E76\u5728\u8FD9\u91CC\u66F4\u65B0\u72B6\u6001\u3002", children: jobs.length ? jobs.slice(0, 6).map((job) => _jsxs("article", { className: "mb-3 rounded-[1.4rem] bg-white/70 p-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsx("strong", { children: job.monitorName }), _jsx("span", { className: "mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]", children: job.status })] }), _jsx("p", { className: "mt-2 text-sm leading-6 text-[var(--ink-soft)]", children: jobSummary(job) })] }, job.id)) : _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u626B\u63CF\u4EFB\u52A1\u8BB0\u5F55\u3002" }) })] })] }) }), _jsx(Route, { path: "/monitors", element: _jsxs("div", { className: "grid gap-5 xl:grid-cols-[0.92fr_1.08fr]", children: [_jsx("form", { className: "panel-card rounded-[2rem] p-6", onSubmit: createMonitor, children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "\u4EFB\u52A1\u540D\u79F0", description: "\u53EA\u7528\u4E8E\u5361\u7247\u6807\u9898\u548C\u4EFB\u52A1\u533A\u5206\uFF0C\u4E0D\u53C2\u4E0E\u641C\u7D22\u3002", children: _jsx("input", { value: monitorForm.name, onChange: (event) => setMonitorForm((current) => ({ ...current, name: event.target.value })) }) }), _jsx(Field, { label: "\u76D1\u63A7\u6A21\u5F0F", description: "\u5173\u952E\u8BCD\u76D1\u63A7\u7528\u4E8E\u7CBE\u51C6\u547D\u4E2D\uFF0C\u4E3B\u9898\u70ED\u70B9\u7528\u4E8E\u5468\u671F\u6027\u53D1\u73B0\u3002", children: _jsxs("select", { value: monitorForm.mode, onChange: (event) => setMonitorForm((current) => ({ ...current, mode: event.target.value })), children: [_jsx("option", { value: "keyword", children: "\u5173\u952E\u8BCD\u76D1\u63A7" }), _jsx("option", { value: "topic", children: "\u4E3B\u9898\u70ED\u70B9" })] }) }), _jsx(Field, { label: queryLabel(monitorForm.mode), description: queryHint(monitorForm.mode), children: _jsx("input", { placeholder: monitorForm.mode === "keyword" ? "例如：GPT-5.4" : "例如：OpenAI", value: monitorForm.query, onChange: (event) => setMonitorForm((current) => ({ ...current, query: event.target.value })) }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "\u8F6E\u8BE2\u95F4\u9694", description: "\u7CFB\u7EDF\u591A\u4E45\u81EA\u52A8\u68C0\u67E5\u4E00\u6B21\u3002", children: _jsx("input", { type: "number", value: monitorForm.intervalMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) })) }) }), _jsx(Field, { label: "\u51B7\u5374\u65F6\u95F4", description: "\u4E24\u6B21\u76F8\u4F3C\u63D0\u9192\u4E4B\u95F4\u81F3\u5C11\u95F4\u9694\u591A\u4E45\u3002", children: _jsx("input", { type: "number", value: monitorForm.cooldownMinutes, onChange: (event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) })) }) })] }), _jsx("button", { type: "submit", className: "rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white", children: "\u521B\u5EFA\u4EFB\u52A1" })] }) }), _jsx("div", { className: "grid gap-4", children: (snapshot?.monitors ?? []).map((monitor) => { const job = jobsByMonitorId.get(monitor.id); const isRunning = job?.status === "queued" || job?.status === "running"; return _jsx("article", { className: "panel-card rounded-[1.6rem] p-5", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "rounded-full bg-[var(--ember-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember)]", children: modeLabel(monitor.mode) }), _jsxs("span", { className: "mono rounded-full border border-[rgba(8,17,31,0.08)] px-3 py-1 text-xs text-[var(--ink-soft)]", children: [monitor.intervalMinutes, " min"] }), job ? _jsx("span", { className: "mono rounded-full border border-[rgba(19,138,123,0.16)] bg-[var(--signal-soft)] px-3 py-1 text-xs text-[var(--signal)]", children: job.status }) : null] }), _jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold", children: monitor.name }), _jsxs("p", { className: "mt-1 text-sm text-[var(--ink-soft)]", children: [queryPrefix(monitor.mode), "\uFF1A", monitor.query] })] }), job ? _jsx("p", { className: "text-sm text-[var(--ink-soft)]", children: jobSummary(job) }) : null] }), _jsxs("div", { className: "flex flex-wrap gap-2 md:max-w-[16rem] md:justify-end", children: [_jsx("button", { type: "button", className: "rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60", disabled: isRunning, onClick: () => void runMonitor(monitor.id), children: isRunning ? "扫描中…" : "扫描" }), _jsx("button", { type: "button", className: "rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]", onClick: () => void patchMonitor(monitor, { enabled: !monitor.enabled }), children: monitor.enabled ? "停用" : "启用" }), _jsx("button", { type: "button", className: "rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]", onClick: () => void deleteMonitor(monitor), children: "\u5220\u9664" })] })] }) }, monitor.id); }) })] }) }), _jsx(Route, { path: "/hotspots", element: _jsx(Panel, { title: "\u70ED\u70B9\u53D1\u73B0", body: "\u8FD9\u91CC\u5C55\u793A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u805A\u5408\u51FA\u7684\u7ED3\u679C\u3002", children: _jsx(HotspotList, { hotspots: snapshot?.hotspots ?? [] }) }) }), _jsx(Route, { path: "/settings", element: settingsForm ? _jsxs("form", { className: "grid gap-5 xl:grid-cols-[1fr_0.92fr]", onSubmit: saveSettings, children: [_jsx(Panel, { title: "\u901A\u77E5\u914D\u7F6E", body: "\u6BCF\u884C\u4E00\u4E2A Webhook \u6216\u90AE\u7BB1\uFF0C\u4FDD\u5B58\u540E\u5373\u53EF\u7528\u4E8E\u6D4B\u8BD5\u901A\u77E5\u3002", children: _jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "Webhook URLs", description: "\u6BCF\u884C\u4E00\u4E2A\u5730\u5740", children: _jsx("textarea", { rows: 4, value: settingsForm.webhookUrls.join("\n"), onChange: (event) => updateSettingsField((current) => ({ ...current, webhookUrls: splitLines(event.target.value) })) }) }), _jsx(Field, { label: "\u901A\u77E5\u90AE\u7BB1", description: "\u6BCF\u884C\u4E00\u4E2A\u90AE\u7BB1", children: _jsx("textarea", { rows: 3, value: settingsForm.emailTo.join("\n"), onChange: (event) => updateSettingsField((current) => ({ ...current, emailTo: splitLines(event.target.value) })) }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "SMTP Host", children: _jsx("input", { value: settingsForm.smtpHost ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null })) }) }), _jsx(Field, { label: "SMTP Port", children: _jsx("input", { type: "number", value: settingsForm.smtpPort ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null })) }) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsx(Field, { label: "SMTP User", children: _jsx("input", { value: settingsForm.smtpUser ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null })) }) }), _jsx(Field, { label: "SMTP Password", children: _jsx("input", { type: "password", value: settingsForm.smtpPassword ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null })) }) })] }), _jsx(Field, { label: "SMTP From", children: _jsx("input", { value: settingsForm.smtpFrom ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null })) }) }), _jsx(Field, { label: "VAPID Public Key", children: _jsx("textarea", { rows: 4, value: settingsForm.vapidPublicKey ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, vapidPublicKey: event.target.value || null })) }) }), _jsx(Field, { label: "VAPID Private Key", children: _jsx("textarea", { rows: 4, value: settingsForm.vapidPrivateKey ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, vapidPrivateKey: event.target.value || null })) }) }), _jsx(Field, { label: "VAPID Subject", children: _jsx("input", { value: settingsForm.vapidSubject ?? "", onChange: (event) => updateSettingsField((current) => ({ ...current, vapidSubject: event.target.value || null })) }) }), _jsx("button", { type: "submit", className: "rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white", children: "\u4FDD\u5B58\u901A\u77E5\u8BBE\u7F6E" })] }) }), _jsxs("div", { className: "grid gap-5", children: [_jsx(Panel, { title: "\u6D4F\u89C8\u5668\u63A8\u9001", body: "\u4FDD\u5B58 VAPID \u516C\u94A5\u540E\uFF0C\u4E3A\u5F53\u524D\u6D4F\u89C8\u5668\u5B8C\u6210\u8BA2\u9605\u3002", children: _jsx("button", { type: "button", className: "rounded-full bg-[var(--signal)] px-4 py-3 text-sm font-semibold text-white", onClick: () => void subscribePush(), children: "\u8BA2\u9605\u5F53\u524D\u6D4F\u89C8\u5668" }) }), _jsx(Panel, { title: "\u6D4B\u8BD5\u901A\u77E5", body: "\u5411\u5F53\u524D\u914D\u7F6E\u597D\u7684\u4E09\u7C7B\u6E20\u9053\u7EDF\u4E00\u53D1\u4E00\u6761\u6D4B\u8BD5\u6D88\u606F\u3002", children: _jsx("button", { type: "button", className: "rounded-full bg-[var(--ember)] px-4 py-3 text-sm font-semibold text-white", onClick: () => void sendTestNotification(), children: "\u53D1\u9001\u6D4B\u8BD5\u901A\u77E5" }) })] })] }) : _jsx(Panel, { title: "\u901A\u77E5\u914D\u7F6E", body: "\u6B63\u5728\u52A0\u8F7D\u901A\u77E5\u8BBE\u7F6E\uFF0C\u8BF7\u7A0D\u7B49\u7247\u523B\u3002", children: _jsx(Empty, { text: "\u8BBE\u7F6E\u5C1A\u672A\u5C31\u7EEA\u65F6\u4E0D\u4F1A\u5C55\u793A\u8F93\u5165\u6846\uFF0C\u907F\u514D\u4F60\u8F93\u5165\u540E\u53C8\u88AB\u521D\u59CB\u5316\u6570\u636E\u8986\u76D6\u3002" }) }) })] }) })] })] }) }));
}
