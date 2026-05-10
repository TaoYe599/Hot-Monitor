import type {
  DashboardSnapshot,
  EventFilter,
  EventSortField,
  HotspotFilter,
  HotspotSortField,
  MonitorFormInput,
  MonitorMode,
  MonitorRecord,
  ScanJobRecord,
  SettingsFormInput,
  SettingsRecord,
  VerifiedEvent,
  HotspotCluster,
} from "@hot-monitor/shared";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  DEFAULT_SOURCE_CONFIG,
} from "@hot-monitor/shared";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { NavLink, Route, Routes } from "react-router";

import {
  EventsFilterBar,
  HotspotsFilterBar,
  useEventsPrefs,
  useHotspotsPrefs,
} from "./components/FilterBar";
import { api, splitLines } from "./lib/api";

const defaultMonitorForm: MonitorFormInput = {
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

function toSettingsForm(settings: SettingsRecord): SettingsFormInput {
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

function modeLabel(mode: MonitorMode): string {
  return mode === "keyword" ? "关键词监控" : "主题热点";
}

function queryLabel(mode: MonitorMode): string {
  return mode === "keyword" ? "监控关键词" : "监控主题";
}

function queryHint(mode: MonitorMode): string {
  return mode === "keyword"
    ? "输入你想精准盯住的词，比如 GPT-5.4、Claude Code、DeepSeek-R1。"
    : "输入你想持续观察的方向，比如 OpenAI、AI 编程、多模态模型。";
}

function queryPrefix(mode: MonitorMode): string {
  return mode === "keyword" ? "关键词" : "主题";
}

function jobSummary(job: ScanJobRecord): string {
  if (job.status === "queued") return `任务已提交，正在排队：${job.monitorName}`;
  if (job.status === "running") return `正在后台扫描：${job.monitorName}`;
  if (job.status === "cancelled") return `已取消：${job.monitorName}`;
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

function Panel(props: {
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel-card rounded-[1.9rem] p-6">
      <h2 className="text-2xl font-semibold">{props.title}</h2>
      {props.body ? (
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
          {props.body}
        </p>
      ) : null}
      <div className="mt-5">{props.children}</div>
    </section>
  );
}

function Field(props: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-semibold">{props.label}</span>
      {props.description ? (
        <span className="text-xs leading-5 text-[var(--ink-soft)]">
          {props.description}
        </span>
      ) : null}
      {props.children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]">
      {text}
    </div>
  );
}

function formatSourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function EventList({ events }: { events: VerifiedEvent[] }) {
  if (events.length === 0) {
    return <Empty text="还没有命中事件。创建一个关键词监控后，再手动触发一次扫描。" />;
  }

  return (
    <>
      {events.map((event) => (
        <article key={event.id} className="mb-4 rounded-[1.4rem] bg-white/70 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <strong>{event.title}</strong>
            <span className="mono text-xs text-[var(--ink-soft)]">
              真实性 {Math.round(event.authenticityScore * 100)}%
            </span>
            <span className="mono text-xs text-[var(--ink-soft)]">
              相关性 {Math.round(event.relevanceScore * 100)}%
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{event.summary}</p>
        </article>
      ))}
    </>
  );
}

function HotspotList({ hotspots }: { hotspots: HotspotCluster[] }) {
  if (hotspots.length === 0) {
    return <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />;
  }

  return (
    <>
      {hotspots.map((hotspot) => (
        <article key={hotspot.id} className="mb-4 rounded-[1.5rem] bg-white/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <strong>{hotspot.label}</strong>
            <div className="flex items-center gap-3">
              <span className="mono text-xs text-[var(--ink-soft)]" title={hotspot.createdAt}>
                {formatRelativeTime(hotspot.createdAt)}
              </span>
              <span className="mono text-xs text-[var(--ink-soft)]">
                {Math.round(hotspot.score * 100)}%
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
            {hotspot.summary}
          </p>
          {hotspot.supportingUrls?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {hotspot.supportingUrls.slice(0, 3).map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mono rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-soft)] hover:border-[var(--ember)] hover:text-[var(--ember)] max-w-[12rem] truncate"
                  title={url}
                >
                  {formatSourceHost(url)}
                </a>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [jobs, setJobs] = useState<ScanJobRecord[]>([]);
  const [pendingJobIds, setPendingJobIds] = useState<string[]>([]);
  const [monitorForm, setMonitorForm] = useState(defaultMonitorForm);
  const [settingsForm, setSettingsForm] = useState<SettingsFormInput | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [status, setStatus] = useState("booting");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 排序和筛选状态
  const [filteredEvents, setFilteredEvents] = useState<VerifiedEvent[]>([]);
  const [filteredHotspots, setFilteredHotspots] = useState<HotspotCluster[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);

  // 排序和筛选 hooks
  const eventsPrefs = useEventsPrefs(snapshot?.monitors ?? []);
  const hotspotsPrefs = useHotspotsPrefs(snapshot?.monitors ?? []);

  // 加载筛选后的 events
  const loadFilteredEvents = useCallback(
    async (sort: typeof eventsPrefs.prefs.sort, filter: typeof eventsPrefs.prefs.filter) => {
      setEventsLoading(true);
      try {
        const events = await api.listEvents({ sort, filter, limit: 100 });
        setFilteredEvents(events);
      } catch (err) {
        console.warn("[loadFilteredEvents] failed:", err);
      } finally {
        setEventsLoading(false);
      }
    },
    [],
  );

  // 加载筛选后的 hotspots
  const loadFilteredHotspots = useCallback(
    async (sort: typeof hotspotsPrefs.prefs.sort, filter: typeof hotspotsPrefs.prefs.filter) => {
      setHotspotsLoading(true);
      try {
        const hotspots = await api.listHotspots({ sort, filter, limit: 100 });
        setFilteredHotspots(hotspots);
      } catch (err) {
        console.warn("[loadFilteredHotspots] failed:", err);
      } finally {
        setHotspotsLoading(false);
      }
    },
    [],
  );

  // 当排序/筛选改变时，重新加载 events
  useEffect(() => {
    loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
  }, [eventsPrefs.prefs.sort, eventsPrefs.prefs.filter, loadFilteredEvents]);

  // 当排序/筛选改变时，重新加载 hotspots
  useEffect(() => {
    loadFilteredHotspots(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter);
  }, [hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, loadFilteredHotspots]);

  // 当 SSE 有新事件时，刷新列表
  useEffect(() => {
    const handleRefresh = () => {
      loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
      loadFilteredHotspots(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter);
    };

    // 监听 SSE 事件
    const originalConnect = () => {
      const stream = new EventSource("/api/stream");
      stream.addEventListener("event.created", handleRefresh);
      stream.addEventListener("hotspot.created", handleRefresh);
      return stream;
    };

    return () => {};
  }, [eventsPrefs.prefs, hotspotsPrefs.prefs, loadFilteredEvents, loadFilteredHotspots]);

  const jobsByMonitorId = useMemo(
    () => new Map<number, ScanJobRecord>(jobs.map((job) => [job.monitorId, job])),
    [jobs],
  );

  const mergeJob = useEffectEvent((job: ScanJobRecord) => {
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
          if (!dashboard.settings) return current;
          return settingsDirty && current ? current : toSettingsForm(dashboard.settings);
        });
        setStatus("live");
        setError(null);
      });
    } catch (reason) {
      console.warn("[refresh] failed:", reason);
      setStatus("degraded");
    }
  });

  // Retry logic for initial load with exponential backoff
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
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
          } else {
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

  useEffect(() => {
    let stream: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
      if (destroyed) return;

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

      stream.addEventListener("event.created", refreshHandler);
      stream.addEventListener("hotspot.created", refreshHandler);
      stream.addEventListener("notification.sent", refreshHandler);

      stream.addEventListener("scan.job.updated", (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent<string>).data) as { payload: ScanJobRecord };
          mergeJob(parsed.payload);
        } catch {
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
  }, [mergeJob]);

  useEffect(() => {
    if (pendingJobIds.length === 0) return;
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

  const summary = useMemo(
    () => busy ?? error ?? notice ?? `当前已加载 ${snapshot?.monitors.length ?? 0} 个任务`,
    [busy, error, notice, snapshot],
  );

  function updateSettingsField(updater: (current: SettingsFormInput) => SettingsFormInput) {
    setSettingsDirty(true);
    setSettingsForm((current) => (current ? updater(current) : current));
  }

  async function createMonitor(event: React.FormEvent) {
    event.preventDefault();
    setBusy("正在创建任务…");
    setError(null);
    setNotice(null);
    try {
      await api.createMonitor(monitorForm);
      setMonitorForm(defaultMonitorForm);
      setNotice("任务已创建，可以点击“扫描”提交后台任务。");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function runMonitor(id: number) {
    setBusy("正在提交后台扫描任务…");
    setError(null);
    setNotice(null);
    try {
      const job = await api.runMonitor(id);
      mergeJob(job);
      setNotice(jobSummary(job));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function patchMonitor(monitor: MonitorRecord, patch: Partial<MonitorFormInput>) {
    setBusy(`正在更新 ${monitor.name}…`);
    setError(null);
    setNotice(null);
    try {
      await api.updateMonitor(monitor.id, patch);
      setNotice(`${monitor.name} 已更新。`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function deleteMonitor(monitor: MonitorRecord) {
    setBusy(`正在删除 ${monitor.name}…`);
    setError(null);
    setNotice(null);
    try {
      await api.deleteMonitor(monitor.id);
      setNotice(`${monitor.name} 已删除。`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function cancelScanJob(jobId: string) {
    setError(null);
    setNotice(null);
    try {
      await api.cancelScanJob(jobId);
      setNotice("扫描任务已取消。");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    if (!settingsForm) return;
    setBusy("正在保存通知配置…");
    setError(null);
    setNotice(null);
    try {
      const saved = await api.updateSettings(settingsForm);
      setSettingsForm(toSettingsForm(saved));
      setSettingsDirty(false);
      setNotice("通知配置已保存。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="panel-card radar-panel rounded-[2rem] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(8,17,31,0.08)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">
                <span className="h-2 w-2 rounded-full bg-[var(--signal)]" />
                AI Hot Signal Radar
              </div>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Hot Monitor 情报雷达台</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] sm:text-base">
                自动抓取多源热点，借助 OpenRouter 做真假判定与聚类，再通过邮件发出提醒。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["运行监控", String(snapshot?.stats.activeMonitors ?? 0)],
                ["有效命中", String(snapshot?.stats.acceptedEvents ?? 0)],
                ["热点簇", String(snapshot?.stats.hotspots ?? 0)],
                ["状态", status],
              ].map(([label, value]) => (
                <div key={label} className="panel-card rounded-[1.4rem] p-4">
                  <div className="mono text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">{label}</div>
                  <div className="mt-3 text-3xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </header>

        {status === "degraded" && !snapshot && (
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>后端服务未连接。</strong> 请确保后端服务正在运行：<code className="rounded bg-amber-100 px-1">pnpm dev</code>。如果问题持续，请检查端口 8787 是否被占用：<code className="rounded bg-amber-100 px-1">netstat -ano | findstr :8787</code>
          </div>
        )}

        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="panel-card rounded-[2rem] p-3 lg:w-72">
            <nav className="grid gap-2">
              {[["/", "总览"], ["/monitors", "任务管理"], ["/hotspots", "热点发现"], ["/settings", "通知设置"]].map(([to, label]) => (
                <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `rounded-[1.3rem] px-4 py-3 text-sm font-semibold ${isActive ? "bg-[var(--ember-soft)] text-[var(--ember)]" : "bg-white/60 text-[var(--ink-soft)]"}`}>{label}</NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">
            <Routes>
              <Route path="/" element={<div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"><div><EventsFilterBar monitors={snapshot?.monitors ?? []} prefs={eventsPrefs.prefs} onSortChange={eventsPrefs.setSort} onFilterChange={eventsPrefs.setFilter} onClearFilter={eventsPrefs.clearFilter} onQuickFilterChange={eventsPrefs.setQuickFilter} /><Panel title="实时命中" body="这里展示关键词监控命中的结果。">{eventsLoading ? <Empty text="加载中..." /> : filteredEvents.length ? filteredEvents.map((event) => <article key={event.id} className="mb-4 rounded-[1.4rem] bg-white/70 p-5"><div className="flex flex-wrap items-center gap-3"><strong>{event.title}</strong><span className="mono text-xs text-[var(--ink-soft)]">真实性 {Math.round(event.authenticityScore * 100)}%</span><span className="mono text-xs text-[var(--ink-soft)]">相关性 {Math.round(event.relevanceScore * 100)}%</span></div><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{event.summary}</p></article>) : <Empty text="还没有命中事件。创建一个关键词监控后，再手动触发一次扫描。" />}</Panel></div><div className="grid gap-5"><Panel title="热点快照" body="这里展示主题热点监控聚合出的结果。">{snapshot?.hotspots?.length ? <HotspotList hotspots={snapshot.hotspots.slice(0, 3)} /> : <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />}</Panel><Panel title="扫描任务" body="扫描提交后会在后台执行，并在这里更新状态。">{jobs.length ? jobs.slice(0, 6).map((job) => <article key={job.id} className="mb-3 rounded-[1.4rem] bg-white/70 p-4"><div className="flex flex-wrap items-center gap-3"><strong>{job.monitorName}</strong><span className="mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">{job.status}</span>{(job.status === "queued" || job.status === "running") ? <button type="button" className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]" onClick={() => void cancelScanJob(job.id)}>取消</button> : null}</div><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{jobSummary(job)}</p></article>) : <Empty text="还没有扫描任务记录。" />}</Panel></div></div>} />
              <Route path="/monitors" element={<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]"><form className="panel-card rounded-[2rem] p-6" onSubmit={createMonitor}><div className="grid gap-4"><Field label="任务名称" description="只用于卡片标题和任务区分，不参与搜索。"><input value={monitorForm.name} onChange={(event) => setMonitorForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="监控模式" description="关键词监控用于精准命中，主题热点用于周期性发现。"><select value={monitorForm.mode} onChange={(event) => setMonitorForm((current) => ({ ...current, mode: event.target.value as MonitorMode }))}><option value="keyword">关键词监控</option><option value="topic">主题热点</option></select></Field><Field label={queryLabel(monitorForm.mode)} description={queryHint(monitorForm.mode)}><input placeholder={monitorForm.mode === "keyword" ? "例如：GPT-5.4" : "例如：OpenAI"} value={monitorForm.query} onChange={(event) => setMonitorForm((current) => ({ ...current, query: event.target.value }))} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="轮询间隔" description="系统多久自动检查一次。"><input type="number" value={monitorForm.intervalMinutes} onChange={(event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))} /></Field><Field label="冷却时间" description="两次相似提醒之间至少间隔多久。"><input type="number" value={monitorForm.cooldownMinutes} onChange={(event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) }))} /></Field></div><Field label="数据源" description="勾选要启用的信息源。"><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.twitter} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, twitter: e.target.checked } }))} /> Twitter/X</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.search} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, search: e.target.checked } }))} /> DuckDuckGo</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.google} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, google: e.target.checked } }))} /> Google</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.rss} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, rss: e.target.checked } }))} /> 官方博客</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.github} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, github: e.target.checked } }))} /> GitHub</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.hackernews} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, hackernews: e.target.checked } }))} /> Hacker News</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.weibo} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, weibo: e.target.checked } }))} /> 微博</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.zhihu} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, zhihu: e.target.checked } }))} /> 知乎</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.baidu} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, baidu: e.target.checked } }))} /> 百度</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monitorForm.sources.reddit} onChange={(e) => setMonitorForm((c) => ({ ...c, sources: { ...c.sources, reddit: e.target.checked } }))} /> Reddit</label></div></Field><button type="submit" className="rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white">创建任务</button></div></form><div className="grid gap-4">{(snapshot?.monitors ?? []).map((monitor) => { const job = jobsByMonitorId.get(monitor.id); const isRunning = job?.status === "queued" || job?.status === "running"; return <article key={monitor.id} className="panel-card rounded-[1.6rem] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--ember-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember)]">{modeLabel(monitor.mode)}</span><span className="mono rounded-full border border-[rgba(8,17,31,0.08)] px-3 py-1 text-xs text-[var(--ink-soft)]">{monitor.intervalMinutes} min</span>{job ? <span className="mono rounded-full border border-[rgba(19,138,123,0.16)] bg-[var(--signal-soft)] px-3 py-1 text-xs text-[var(--signal)]">{job.status}</span> : null}</div><div><h3 className="text-xl font-semibold">{monitor.name}</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">{queryPrefix(monitor.mode)}：{monitor.query}</p></div>{job ? <p className="text-sm text-[var(--ink-soft)]">{jobSummary(job)}</p> : null}</div><div className="flex flex-wrap gap-2 md:max-w-[20rem] md:justify-end"><button type="button" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isRunning} onClick={() => void runMonitor(monitor.id)}>{isRunning ? "扫描中…" : "扫描"}</button>{(job?.status === "queued" || job?.status === "running") ? <button type="button" className="rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]" onClick={() => void cancelScanJob(job.id)}>取消</button> : null}<button type="button" className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]" onClick={() => void patchMonitor(monitor, { enabled: !monitor.enabled })}>{monitor.enabled ? "停用" : "启用"}</button><button type="button" className="rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]" onClick={() => void deleteMonitor(monitor)}>删除</button></div></div></article>; })}</div></div>} />
              <Route path="/hotspots" element={<div><HotspotsFilterBar monitors={snapshot?.monitors ?? []} prefs={hotspotsPrefs.prefs} onSortChange={hotspotsPrefs.setSort} onFilterChange={hotspotsPrefs.setFilter} onClearFilter={hotspotsPrefs.clearFilter} onQuickFilterChange={hotspotsPrefs.setQuickFilter} /><Panel title="热点发现" body="这里展示主题热点监控聚合出的结果。">{hotspotsLoading ? <Empty text="加载中..." /> : <HotspotList hotspots={filteredHotspots} />}</Panel></div>} />
              <Route path="/settings" element={settingsForm ? <form className="panel-card max-w-xl rounded-[2rem] p-6" onSubmit={saveSettings}><div className="grid gap-5"><Field label="通知邮箱"><textarea rows={2} placeholder="每行一个邮箱" value={settingsForm.emailTo.join("\n")} onChange={(event) => updateSettingsField((current) => ({ ...current, emailTo: splitLines(event.target.value) }))} /></Field><div className="grid grid-cols-3 gap-3"><Field label="SMTP 服务器"><input placeholder="smtp.example.com" value={settingsForm.smtpHost ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null }))} /></Field><Field label="端口"><input type="number" placeholder="587" value={settingsForm.smtpPort ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null }))} /></Field><Field label="发件人"><input placeholder="noreply@example.com" value={settingsForm.smtpFrom ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null }))} /></Field></div><div className="grid grid-cols-2 gap-3"><Field label="用户名"><input value={settingsForm.smtpUser ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null }))} /></Field><Field label="密码"><input type="password" value={settingsForm.smtpPassword ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null }))} /></Field></div><div className="flex gap-3"><button type="submit" className="rounded-full bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white">保存</button><button type="button" className="rounded-full bg-[var(--ember)] px-5 py-2 text-sm font-semibold text-white" onClick={() => void sendTestNotification()}>测试</button></div></div></form> : <div className="panel-card rounded-[2rem] p-6 text-[var(--ink-soft)]">正在加载...</div>} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
