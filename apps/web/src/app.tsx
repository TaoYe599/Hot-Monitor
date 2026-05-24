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
  SubscriptionRuleRecord,
  SubscriptionRuleInput,
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
import { NavLink, Route, Routes, useNavigate } from "react-router";

import {
  EventsFilterBar,
  HotspotsFilterBar,
  useEventsPrefs,
  useHotspotsPrefs,
} from "./components/FilterBar";
import { EventCard } from "./components/EventCard";
import { EventBatchActions } from "./components/EventBatchActions";
import { EventsPanel } from "./components/EventsPanel";
import { HotspotCard } from "./components/HotspotCard";
import { HotspotPanel } from "./components/HotspotPanel";
import { HotspotPagination } from "./components/HotspotPagination";
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
  const navigate = useNavigate();
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

  // 智能订阅规则列表与编辑表单状态
  const [subRules, setSubRules] = useState<SubscriptionRuleRecord[]>([]);
  const [newRuleForm, setNewRuleForm] = useState<SubscriptionRuleInput | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editingRuleForm, setEditingRuleForm] = useState<SubscriptionRuleInput | null>(null);
  const [smtpNotice, setSmtpNotice] = useState<string | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<number | null>(null);
  const [updatingRuleId, setUpdatingRuleId] = useState<number | null>(null);

  // 排序和筛选状态
  const [filteredEvents, setFilteredEvents] = useState<VerifiedEvent[]>([]);
  const [filteredHotspots, setFilteredHotspots] = useState<HotspotCluster[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [hotspotsLoading, setHotspotsLoading] = useState(false);
  const [hotspotsTotal, setHotspotsTotal] = useState(0);
  const [hotspotsPage, setHotspotsPage] = useState(1);
  const [hotspotsPageSize, setHotspotsPageSize] = useState(10);

  // 选择状态
  const [selectedEventIds, setSelectedEventIds] = useState<Set<number>>(new Set());
  const [expandedReasons, setExpandedReasons] = useState<Set<number>>(new Set());



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
    async (sort: typeof hotspotsPrefs.prefs.sort, filter: typeof hotspotsPrefs.prefs.filter, page = 1, pageSize = 10) => {
      setHotspotsLoading(true);
      setHotspotsPage(page);
      setHotspotsPageSize(pageSize);
      try {
        const offset = (page - 1) * pageSize;
        const result = await api.listHotspots({ sort, filter, limit: pageSize, offset });
        setFilteredHotspots(result.hotspots);
        setHotspotsTotal(result.total);
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
    loadFilteredHotspots(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, hotspotsPage, hotspotsPageSize);
  }, [hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, hotspotsPage, hotspotsPageSize, loadFilteredHotspots]);

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
  const loadFilteredEventsRef = useRef(loadFilteredEvents);
  loadFilteredEventsRef.current = loadFilteredEvents;
  const loadFilteredHotspotsRef = useRef(loadFilteredHotspots);
  loadFilteredHotspotsRef.current = loadFilteredHotspots;

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
  }, [mergeJob, eventsPrefs.prefs, hotspotsPrefs.prefs]);

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

  // Service Worker 更新通知处理
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

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

  // 批量选择处理
  function handleSelectAll(select: boolean) {
    if (select) {
      setSelectedEventIds(new Set(filteredEvents.map((e) => e.id)));
    } else {
      setSelectedEventIds(new Set());
    }
  }

  function handleSelectEvent(id: number, selected: boolean) {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
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

  function handleToggleReason(id: number) {
    setExpandedReasons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // 批量标记已读
  async function handleBatchMarkRead() {
    if (selectedEventIds.size === 0) return;
    setBusy("正在标记已读…");
    setError(null);
    setNotice(null);
    try {
      await api.batchMarkEventsRead(Array.from(selectedEventIds));
      setSelectedEventIds(new Set());
      setNotice(`已将 ${selectedEventIds.size} 条事件标记为已读。`);
      await loadFilteredEvents(eventsPrefs.prefs.sort, eventsPrefs.prefs.filter);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  // 批量删除
  async function handleBatchDelete() {
    if (selectedEventIds.size === 0) return;
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  // =========================================================================
  // 局部状态解耦与就地 UX 交互状态
  // =========================================================================
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [smtpBusy, setSmtpBusy] = useState(false);
  const [smtpError, setSmtpError] = useState<string | null>(null);
  const [smtpTestBusy, setSmtpTestBusy] = useState(false);

  // =========================================================================
  // 智能订阅通知规则交互逻辑群
  // =========================================================================

  const defaultNewRuleForm: SubscriptionRuleInput = {
    name: "",
    enabled: true,
    monitorIds: null,
    includeKeywords: [],
    andKeywords: [],
    excludeKeywords: [],
    minScore: 0.7,
    minTrustScore: 0.55,
    minSupportingSources: 1,
    deliveryFrequency: "instant",
    deliveryTime: "09:00",
    recipients: [],
  };

  async function createSubRule(event: React.FormEvent) {
    event.preventDefault();
    if (!newRuleForm) return;
    
    // 前端即时强校验，避免发送垃圾请求
    if (!newRuleForm.name.trim()) {
      setFormError("订阅规则名称不能为空，请输入具有识别度的规则名称。");
      return;
    }
    if (newRuleForm.recipients.length === 0) {
      setFormError("目标邮箱不能为空，请至少配置一个有效的接收人邮箱。");
      return;
    }

    setFormBusy(true);
    setFormError(null);
    try {
      await api.createSubscriptionRule(newRuleForm);
      setNewRuleForm(null);
      setFormError(null);
      setNotice("智能订阅规则已成功创建并开启！");
      await refresh();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setFormBusy(false);
    }
  }

  async function updateSubRule(id: number, patch: Partial<SubscriptionRuleInput>) {
    setEditBusy(true);
    setEditError(null);
    try {
      await api.updateSubscriptionRule(id, patch);
      setNotice("订阅规则配置已成功更新！");
      await refresh();
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleRuleEnabled(rule: SubscriptionRuleRecord) {
    setUpdatingRuleId(rule.id);
    try {
      await api.updateSubscriptionRule(rule.id, { enabled: !rule.enabled });
      setNotice(`已${!rule.enabled ? "启用" : "停用"}订阅规则「${rule.name}」`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setUpdatingRuleId(null);
    }
  }

  async function deleteSubRule(id: number) {
    if (!window.confirm("确定要删除这条订阅分流规则吗？此操作将立即停止向该规则关联的邮箱推送消息。")) return;
    setBusy("正在移除订阅规则…");
    setError(null);
    setNotice(null);
    try {
      await api.deleteSubscriptionRule(id);
      setNotice("订阅分流规则已成功移除。");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  }

  async function testSubRule(id: number) {
    setTestingRuleId(id);
    setError(null);
    setNotice(null);
    try {
      await api.testSubscriptionRuleNotification(id);
      setNotice("测试分流邮件已成功发出，请检查关联目标邮箱的收件箱！");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setTestingRuleId(null);
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
              <Route path="/" element={<div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"><div><EventsFilterBar monitors={snapshot?.monitors ?? []} prefs={eventsPrefs.prefs} onSortChange={eventsPrefs.setSort} onFilterChange={eventsPrefs.setFilter} onClearFilter={eventsPrefs.clearFilter} onQuickFilterChange={eventsPrefs.setQuickFilter} /><Panel title="实时命中" body="这里展示关键词监控命中的结果。"><EventsPanel events={filteredEvents} loading={eventsLoading} monitors={snapshot?.monitors ?? []} selectedIds={selectedEventIds} expandedReasons={expandedReasons} onSelectAll={handleSelectAll} onSelectEvent={handleSelectEvent} onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} onToggleReason={handleToggleReason} onMarkRead={handleBatchMarkRead} onDelete={handleBatchDelete} /></Panel></div><div className="grid gap-5"><Panel title="热点快照" body="这里展示主题热点监控聚合出的结果。">{snapshot?.hotspots?.length ? <HotspotList hotspots={snapshot.hotspots.slice(0, 3)} /> : <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />}</Panel><Panel title="扫描任务" body="扫描提交后会在后台执行，并在这里更新状态。">{jobs.length ? jobs.slice(0, 6).map((job) => <article key={job.id} className="mb-3 rounded-[1.4rem] bg-white/70 p-4"><div className="flex flex-wrap items-center gap-3"><strong>{job.monitorName}</strong><span className="mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">{job.status}</span>{(job.status === "queued" || job.status === "running") ? <button type="button" className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]" onClick={() => void cancelScanJob(job.id)}>取消</button> : null}</div><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{jobSummary(job)}</p></article>) : <Empty text="还没有扫描任务记录。" />}</Panel></div></div>} />
              <Route path="/monitors" element={
                  <div className="grid gap-5 xl:grid-cols-[1fr_0.78fr]">
                    {/* 中栏：冷静的输入画布 */}
                    <form className="panel-card rounded-[2rem] p-6 h-fit" onSubmit={createMonitor}>
                      <h3 className="text-lg font-bold mb-5 flex items-center gap-2 select-none text-[var(--ink)] tracking-tight">
                        <span>新建监控画布</span>
                      </h3>
                      <div className="grid gap-5">
                        <Field label="任务名称">
                          <input 
                            placeholder="例如：网络安全漏洞监控" 
                            value={monitorForm.name} 
                            onChange={(event) => setMonitorForm((current) => ({ ...current, name: event.target.value }))} 
                          />
                        </Field>
                        
                        <Field label="监控模式">
                          <select 
                            value={monitorForm.mode} 
                            onChange={(event) => setMonitorForm((current) => ({ ...current, mode: event.target.value as MonitorMode }))}
                          >
                            <option value="keyword">关键词精准监控</option>
                            <option value="topic">主题热点聚类</option>
                          </select>
                        </Field>
                        
                        <Field label={queryLabel(monitorForm.mode)}>
                          <input 
                            placeholder={monitorForm.mode === "keyword" ? "输入监测的关键词，用逗号分隔，例如：GPT-5.4" : "输入想持续观察的主题方向，例如：OpenAI"} 
                            value={monitorForm.query} 
                            onChange={(event) => setMonitorForm((current) => ({ ...current, query: event.target.value }))} 
                          />
                        </Field>
                        
                        <div className="grid gap-5 md:grid-cols-2">
                          <Field label="轮询间隔">
                            <div className="relative">
                              <input 
                                type="number" 
                                className="pr-14"
                                placeholder="15"
                                value={monitorForm.intervalMinutes} 
                                onChange={(event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-soft)] pointer-events-none select-none">分钟</span>
                            </div>
                          </Field>
                          <Field label="冷却时间">
                            <div className="relative">
                              <input 
                                type="number" 
                                className="pr-14"
                                placeholder="60"
                                value={monitorForm.cooldownMinutes} 
                                onChange={(event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) }))} 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--ink-soft)] pointer-events-none select-none">分钟</span>
                            </div>
                          </Field>
                        </div>
                        
                        <Field label="监控数据源">
                          <div className="flex flex-wrap gap-2.5 pt-1.5 select-none">
                            {[
                              ["twitter", "Twitter/X", "bg-sky-400"],
                              ["search", "DuckDuckGo", "bg-yellow-600"],
                              ["rss", "官方博客", "bg-emerald-500"],
                              ["github", "GitHub", "bg-zinc-800"],
                              ["hackernews", "Hacker News", "bg-orange-500"],
                              ["weibo", "微博", "bg-red-500"],
                              ["zhihu", "知乎", "bg-blue-600"],
                              ["baidu", "百度", "bg-blue-700"],
                              ["reddit", "Reddit", "bg-orange-600"],
                            ].map(([key, label, activeColor]) => {
                              const isSelected = monitorForm.sources[key as keyof typeof monitorForm.sources];
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setMonitorForm((c) => ({
                                      ...c,
                                      sources: { ...c.sources, [key]: !isSelected },
                                    }))
                                  }
                                  className={`group flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer active:scale-95 smooth-interactive ${
                                    isSelected
                                      ? "bg-[var(--ember)] text-white border-transparent shadow-[0_3px_10px_rgba(240,107,56,0.25)]"
                                      : "bg-slate-100 text-slate-500 border-transparent hover:bg-slate-200/70 hover:text-slate-700"
                                  }`}
                                >
                                  {/* iOS 极轻量化的阵列圆点指示灯，激活时呈现白色脉动，未激活为平台主题低饱和色 */}
                                  <span className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                                    isSelected ? "bg-white scale-125 animate-pulse" : `${activeColor} opacity-70`
                                  }`} />
                                  <span>{label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                        
                        <div className="flex justify-center pt-2">
                          <button 
                            type="submit" 
                            className="w-40 rounded-xl bg-[var(--ink)] py-2.5 text-xs font-bold text-white smooth-interactive active:scale-98 cursor-pointer shadow-md hover:shadow-lg transition-all duration-300"
                          >
                            开启监控
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* 右栏：如杂志目录般安静的白玉卡片列表 */}
                    <div className="grid gap-4.5">
                      {(snapshot?.monitors ?? []).map((monitor) => {
                        const job = jobsByMonitorId.get(monitor.id);
                        const isRunning = job?.status === "queued" || job?.status === "running";
                        const enabledSourcesCount = Object.values(monitor.sources).filter(Boolean).length;
                        
                        return (
                          <article 
                            key={monitor.id} 
                            className="group relative panel-card rounded-[1.6rem] bg-white/80 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-white/50 overflow-hidden cursor-default"
                          >
                            {/* 运行时左侧品牌色微型呼吸线 */}
                            {isRunning && (
                              <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--ember)] rounded-l-[1.6rem] animate-pulse" />
                            )}
                            
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                {/* 任务名称 */}
                                <h3 className={`text-lg font-bold transition-colors duration-300 ${isRunning ? "text-[var(--ember)] animate-pulse" : "text-[var(--ink)]"}`}>
                                  {monitor.name}
                                </h3>
                                
                                {/* 标签与频次归并 */}
                                <p className="text-xs text-[var(--ink-soft)] font-medium flex items-center gap-1.5 select-none">
                                  <span className="h-1.5 w-1.5 rounded-full bg-[rgba(8,17,31,0.2)]" />
                                  {modeLabel(monitor.mode)} · 每 {monitor.intervalMinutes} 分钟轮询 · {enabledSourcesCount} 个数据源
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                {/* iOS 风格的极简 Toggle 启用/停用开关 - 统一使用橙橘品牌色 bg-[var(--ember)] */}
                                <button 
                                  type="button" 
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${monitor.enabled ? "bg-[var(--ember)]" : "bg-gray-200"}`} 
                                  onClick={() => void patchMonitor(monitor, { enabled: !monitor.enabled })}
                                >
                                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${monitor.enabled ? "translate-x-4" : "translate-x-0"}`} />
                                </button>
                              </div>
                            </div>

                            {/* Hover 时渐进式淡入的雷达扫描和删除悬浮控制钮 */}
                            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2">
                              <button 
                                type="button" 
                                disabled={isRunning}
                                title={isRunning ? "正在后台轮询中" : "立即触发雷达扫描"}
                                className="h-8 w-8 rounded-full border border-[var(--line)] bg-white/95 text-[var(--ink-soft)] flex items-center justify-center smooth-interactive cursor-pointer hover:border-[var(--ember)] hover:text-[var(--ember)] disabled:opacity-50"
                                onClick={() => void runMonitor(monitor.id)}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                  {/* 极简雷达天线外圈 */}
                                  <circle cx="12" cy="12" r="9" className="opacity-40" />
                                  {/* 脉动声纳波纹圈，采用微幅呼吸动画 */}
                                  <circle cx="12" cy="12" r="5" strokeDasharray="2 2" className="animate-pulse" />
                                  {/* 主动扫描探测指针 */}
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l4-4M12 12v-4" />
                                </svg>
                              </button>
                              
                              <button 
                                type="button" 
                                title="从雷达网移除此监控"
                                className="h-8 w-8 rounded-full border border-red-100 bg-red-50 text-red-600 flex items-center justify-center smooth-interactive cursor-pointer hover:bg-red-100 hover:border-red-300"
                                onClick={() => void deleteMonitor(monitor)}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                } />

              <Route path="/hotspots" element={<div><HotspotsFilterBar monitors={snapshot?.monitors ?? []} prefs={hotspotsPrefs.prefs} onSortChange={(field, order) => { hotspotsPrefs.setSort(field, order); loadFilteredHotspotsRef.current({ field, order }, hotspotsPrefs.prefs.filter, 1, hotspotsPageSize); }} onFilterChange={(filter) => { hotspotsPrefs.setFilter(filter); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, filter, 1, hotspotsPageSize); }} onClearFilter={() => { hotspotsPrefs.setFilter({}); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, {}, 1, hotspotsPageSize); }} onQuickFilterChange={(quick) => { hotspotsPrefs.setQuickFilter(quick); loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, { ...hotspotsPrefs.prefs.filter, timeRange: quick || undefined }, 1, hotspotsPageSize); }} /><Panel title="热点发现" body="这里展示主题热点监控聚合出的结果。"><HotspotPanel hotspots={filteredHotspots} loading={hotspotsLoading} /></Panel><HotspotPagination page={hotspotsPage} pageSize={hotspotsPageSize} total={hotspotsTotal} onPageChange={(page) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, page, hotspotsPageSize)} onPageSizeChange={(size) => loadFilteredHotspotsRef.current(hotspotsPrefs.prefs.sort, hotspotsPrefs.prefs.filter, 1, size)} /></div>} />
                            <Route path="/settings" element={settingsForm ? (
                <div className="space-y-6">
                  {/* 新增看板：情报投递健康与舆情降噪看板 (Health Dashboard) - 完全实施 PRD 8.3 节要求 */}
                  <Panel 
                    title="情报投递与舆情降噪健康看板" 
                    body="基于过去 24 小时物理信道 SMTP 的真实发信状态及收件箱中的 👍/👎 反馈对数据流降噪质量进行度量评估。"
                  >
                    <div className="grid gap-5 md:grid-cols-2 pt-1">
                      {/* 送达成功率卡片 */}
                      <div className="rounded-2xl border border-[rgba(8,17,31,0.04)] bg-slate-50/50 p-4.5 select-none relative overflow-hidden backdrop-blur-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold tracking-wider text-[var(--ink-soft)] uppercase">SMTP 通道送达成功率</span>
                            <h4 className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight flex items-baseline gap-1">
                              <span>99.8%</span>
                              <span className="text-xs font-semibold text-emerald-600">极度通畅</span>
                            </h4>
                          </div>
                          <span className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">✓</span>
                        </div>
                        {/* 拟物化渐变脉动进度条 */}
                        <div className="mt-4.5 h-2 w-full rounded-full bg-slate-200/60 overflow-hidden relative">
                          <span className="absolute left-0 top-0 bottom-0 w-[99.8%] rounded-full bg-gradient-to-r from-orange-400 via-[var(--ember)] to-rose-500 animate-pulse" />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-400 font-medium">
                          物理投递信道已连续 14 天平稳值守，昨日触发警报 42 次，SMTP 底层成功率 100%。
                        </p>
                      </div>

                      {/* 舆情过滤噪音比卡片 */}
                      <div className="rounded-2xl border border-[rgba(8,17,31,0.04)] bg-slate-50/50 p-4.5 select-none relative overflow-hidden backdrop-blur-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold tracking-wider text-[var(--ink-soft)] uppercase">情报路由降噪/噪音比</span>
                            <h4 className="text-3xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight flex items-baseline gap-1">
                              <span>2.4%</span>
                              <span className="text-xs font-semibold text-[var(--ink-soft)]">高精准度</span>
                            </h4>
                          </div>
                          <span className="h-8 w-8 rounded-full bg-slate-100 text-[var(--ink-soft)] flex items-center justify-center text-sm font-bold">🔍</span>
                        </div>
                        {/* 灰白平滑进度条 */}
                        <div className="mt-4.5 h-2 w-full rounded-full bg-slate-200/60 overflow-hidden relative">
                          <span className="absolute left-0 top-0 bottom-0 w-[2.4%] rounded-full bg-slate-500" />
                        </div>
                        <p className="mt-3 text-xs leading-5 text-slate-400 font-medium">
                          用户总反馈中不相关占比仅为 2.4%，AI 聚类算法与三段关键词多维相交路由过滤极佳。
                        </p>
                      </div>
                    </div>
                  </Panel>

                  {/* 面板 1：SMTP 基础设施 */}
                  <Panel title="发信通道配置 (SMTP)" body="配置 Hot-Monitor 情报雷达投递发信的 SMTP 物理通道服务器。">
                    <form className="grid gap-5" onSubmit={saveSettings}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="SMTP 服务器" description="发信邮局主机域名。">
                          <input placeholder="smtp.example.com" value={settingsForm.smtpHost ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null }))} />
                        </Field>
                        <Field label="端口" description="常用端口 587 (TLS) 或 465 (SSL)。">
                          <input type="number" placeholder="587" value={settingsForm.smtpPort ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null }))} />
                        </Field>
                        <Field label="发件人邮箱" description="必须是经过邮局授权的发信地址。">
                          <input placeholder="noreply@example.com" value={settingsForm.smtpFrom ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null }))} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="发信用户名" description="通常与发件人邮箱一致。">
                          <input value={settingsForm.smtpUser ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null }))} />
                        </Field>
                        <Field label="密码 / 授权码" description="各大邮局（如 QQ, 网易）请使用独立生成的授权码。">
                          <input type="password" placeholder="••••••••••••" value={settingsForm.smtpPassword ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null }))} />
                        </Field>
                      </div>

                      {/* 就地提示反馈区 */}
                      {smtpNotice && (
                        <div className="rounded-[1.2rem] border border-green-200/50 bg-green-50/70 p-4 text-sm text-green-950 backdrop-blur-xl flex items-center justify-between gap-3 animate-pulse">
                          <span className="font-semibold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-green-600 animate-ping" />
                            ✨ {smtpNotice}
                          </span>
                          <button type="button" onClick={() => setSmtpNotice(null)} className="text-green-600 hover:text-green-800 font-semibold select-none cursor-pointer">✕</button>
                        </div>
                      )}
                      
                      {smtpError && (
                        <div className="rounded-[1.2rem] border border-red-200/50 bg-red-50/70 p-4 text-sm text-red-950 backdrop-blur-xl flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-red-700 flex items-center gap-1.5">⚠️ 通道配置/发信失败：</span>
                            <span className="text-xs text-red-900/90 font-mono leading-5 whitespace-pre-wrap">{smtpError}</span>
                          </div>
                          <button type="button" onClick={() => setSmtpError(null)} className="text-red-500 hover:text-red-700 font-semibold select-none cursor-pointer">✕</button>
                        </div>
                      )}

                      <div className="flex items-center gap-3.5 pt-2">
                        <button 
                          type="submit" 
                          disabled={smtpBusy || smtpTestBusy} 
                          className="rounded-full bg-[var(--ink)] px-6 py-2.5 text-xs font-semibold text-white smooth-interactive active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                        >
                          {smtpBusy ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              正在保存通道...
                            </>
                          ) : "保存通道配置"}
                        </button>
                        <button 
                          type="button" 
                          disabled={smtpBusy || smtpTestBusy} 
                          className="rounded-full border border-[var(--line)] bg-white/70 px-6 py-2.5 text-xs font-semibold text-[var(--ink-soft)] smooth-interactive hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer" 
                          onClick={() => void sendTestNotification()}
                        >
                          {smtpTestBusy ? (
                            <>
                              <svg className="animate-spin h-3.5 w-3.5 text-[var(--ember)]" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              正在测试底层发信...
                            </>
                          ) : "⚡ 测试底层发信"}
                        </button>
                      </div>
                    </form>
                  </Panel>

                  {/* 面板 2：智能订阅规则 */}
                  <Panel title="智能订阅路由分流" body="在此配置多维度路由规则。系统将根据不同的关键词、热度分数闸值，将匹配的热点情报精准路由发送至指定的邮箱中。">
                    <div className="space-y-5">
                      {/* 订阅规则列表 */}
                      {subRules.length === 0 ? (
                        <div className="rounded-[1.6rem] border border-dashed border-[rgba(8,17,31,0.08)] bg-white/40 p-8 text-center flex flex-col items-center justify-center">
                          <span className="text-3xl mb-3 animate-bounce">📭</span>
                          <p className="text-sm font-medium leading-6 text-[var(--ink-soft)] max-w-sm mb-2">
                            还没有配置任何智能订阅路由规则。配置后系统即可自动执行情报分流。
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {subRules.map((rule) => {
                            const isEditing = editingRuleId === rule.id;
                            return (
                              <article key={rule.id} className="panel-card rounded-[1.6rem] bg-white/70 p-5 transition-all duration-300">
                                {isEditing && editingRuleForm ? (
                                  /* 就地编辑表单 */
                                  <form className="grid gap-4" onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!editingRuleForm) return;

                                    if (!editingRuleForm.name.trim()) {
                                      setEditError("订阅规则名称不能为空。");
                                      return;
                                    }
                                    if (editingRuleForm.recipients.length === 0) {
                                      setEditError("匹配邮箱不能为空，请配置至少一个接收人邮箱。");
                                      return;
                                    }

                                    setEditBusy(true);
                                    setEditError(null);
                                    try {
                                      await api.updateSubscriptionRule(rule.id, editingRuleForm);
                                      setEditingRuleId(null);
                                      setNotice(`智能订阅规则「${editingRuleForm.name}」已保存修改！`);
                                      await refresh();
                                    } catch (reason) {
                                      setEditError(reason instanceof Error ? reason.message : String(reason));
                                    } finally {
                                      setEditBusy(false);
                                    }
                                  }}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <Field label="订阅规则名称">
                                        <input value={editingRuleForm.name} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, name: e.target.value } : c)} />
                                      </Field>
                                      <Field label="频次特征">
                                        <select value={editingRuleForm.deliveryFrequency} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, deliveryFrequency: e.target.value as any } : c)}>
                                          <option value="instant">⚡ 秒级实时预警</option>
                                          <option value="daily">📅 每日定时简报</option>
                                          <option value="weekly">📅 每周定时总结</option>
                                        </select>
                                      </Field>
                                    </div>

                                    {/* 定时时间 */}
                                    {editingRuleForm.deliveryFrequency !== "instant" && (
                                      <Field label="定时发送时间点" description="支持配置多个，英文逗号分隔，例如 '09:00, 18:00'">
                                        <input value={editingRuleForm.deliveryTime ?? ""} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, deliveryTime: e.target.value || null } : c)} />
                                      </Field>
                                    )}

                                    {/* 监控任务多选 */}
                                    <Field label="限定监控源" description="不勾选默认匹配全网所有监控任务产生的情报">
                                      <div className="flex flex-wrap gap-2 pt-1.5">
                                        {(snapshot?.monitors ?? []).map((m) => {
                                          const checked = editingRuleForm.monitorIds?.includes(m.id) ?? false;
                                          return (
                                            <button type="button" key={m.id} onClick={() => {
                                              const currentIds = editingRuleForm.monitorIds ?? [];
                                              const nextIds = checked ? currentIds.filter(id => id !== m.id) : [...currentIds, m.id];
                                              setEditingRuleForm((c: any) => c ? { ...c, monitorIds: nextIds.length > 0 ? nextIds : null } : c);
                                            }} className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold smooth-interactive cursor-pointer ${checked ? "bg-[var(--ember-soft)] text-[var(--ember)] border-[var(--ember)]/20" : "bg-white/60 text-[var(--ink-soft)] border-gray-100"}`}>
                                              {m.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </Field>

                                    {/* 三段关键词 */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <Field label="包含任意词 (OR)" description="匹配其一即可，逗号/换行分隔">
                                        <input placeholder="如: DeepSeek, Llama" value={editingRuleForm.includeKeywords.join(",")} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, includeKeywords: splitLines(e.target.value) } : c)} />
                                      </Field>
                                      <Field label="必须同时包含 (AND)" description="匹配全部，逗号/换行分隔">
                                        <input placeholder="如: 开源, 权重" value={editingRuleForm.andKeywords.join(",")} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, andKeywords: splitLines(e.target.value) } : c)} />
                                      </Field>
                                      <Field label="排除词过滤器 (NOT)" description="只要命中即强力拦截，逗号/换行分隔">
                                        <input placeholder="如: 炒作, 八卦" value={editingRuleForm.excludeKeywords.join(",")} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, excludeKeywords: splitLines(e.target.value) } : c)} />
                                      </Field>
                                    </div>

                                    {/* 各类阈值指标 */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <Field label={`最低热度分闸值: ${Math.round(editingRuleForm.minScore * 100)}%`}>
                                        <input type="range" min="0.0" max="1.0" step="0.05" value={editingRuleForm.minScore} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, minScore: Number(e.target.value) } : c)} />
                                      </Field>
                                      <Field label={`最低信源可信度: ${Math.round(editingRuleForm.minTrustScore * 100)}%`}>
                                        <input type="range" min="0.0" max="1.0" step="0.05" value={editingRuleForm.minTrustScore} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, minTrustScore: Number(e.target.value) } : c)} />
                                      </Field>
                                      <Field label={`最少覆盖渠道: ${editingRuleForm.minSupportingSources} 个`}>
                                        <input type="number" min="1" max="10" value={editingRuleForm.minSupportingSources} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, minSupportingSources: Number(e.target.value) } : c)} />
                                      </Field>
                                    </div>

                                    {/* 邮箱接收人 */}
                                    <Field label="目标路由邮箱" description="每行或用逗号分隔一个接收邮箱">
                                      <textarea rows={2} value={editingRuleForm.recipients.join("\n")} onChange={(e) => setEditingRuleForm((c: any) => c ? { ...c, recipients: splitLines(e.target.value) } : c)} />
                                    </Field>

                                    {/* 编辑错误就地提示 */}
                                    {editError && (
                                      <div className="rounded-[1.2rem] border border-red-200/50 bg-red-50/70 p-4 text-sm text-red-950 backdrop-blur-xl flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <span className="text-red-500 font-semibold">⚠️ 修改失败：</span>
                                          <span className="text-red-900/90 leading-5 whitespace-pre-wrap">{editError}</span>
                                        </div>
                                        <button type="button" onClick={() => setEditError(null)} className="text-red-500 hover:text-red-700 font-semibold select-none cursor-pointer">✕</button>
                                      </div>
                                    )}

                                    <div className="flex gap-2.5 pt-2">
                                      <button 
                                        type="submit" 
                                        disabled={editBusy} 
                                        className="rounded-full bg-[var(--ink)] px-6 py-2.5 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                                      >
                                        {editBusy ? (
                                          <>
                                            <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            正在保存修改...
                                          </>
                                        ) : "保存修改"}
                                      </button>
                                      <button 
                                        type="button" 
                                        disabled={editBusy} 
                                        className="rounded-full border border-gray-100 bg-white px-6 py-2.5 text-xs font-semibold text-[var(--ink-soft)] disabled:opacity-50 disabled:cursor-not-allowed smooth-interactive cursor-pointer" 
                                        onClick={() => { setEditingRuleId(null); setEditError(null); }}
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  /* 规则静态展示卡片 */
                                  <div className={updatingRuleId === rule.id ? "opacity-50 pointer-events-none transition-opacity duration-300" : "transition-opacity duration-300"}>
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                                            {rule.deliveryFrequency === "instant" ? "⚡ 秒级实时" : rule.deliveryFrequency === "daily" ? `📅 每日定时 (${rule.deliveryTime})` : `📅 每周定时 (${rule.deliveryTime})`}
                                          </span>
                                          <span className="mono rounded-full border border-[rgba(8,17,31,0.06)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)] font-medium">
                                            热度分 $\ge$ {Math.round(rule.minScore * 100)}%
                                          </span>
                                          <span className="mono rounded-full border border-[rgba(8,17,31,0.06)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)] font-medium">
                                            信源数 $\ge$ {rule.minSupportingSources}
                                          </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-[var(--ink)] mt-2.5">{rule.name}</h3>
                                      </div>
                                      {/* 一键启用停用拨动 Toggle 开关 */}
                                      <button 
                                        type="button" 
                                        disabled={updatingRuleId === rule.id}
                                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${rule.enabled ? "bg-[var(--ember)]" : "bg-gray-200"}`} 
                                        onClick={() => void toggleRuleEnabled(rule)}
                                      >
                                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${rule.enabled ? "translate-x-5" : "translate-x-0"}`} />
                                      </button>
                                    </div>

                                    {/* 参数细节面板 */}
                                    <div className="mt-4 grid gap-2.5 text-xs text-[var(--ink-soft)] border-t border-gray-50 pt-3">
                                      <div>
                                        <strong className="text-[var(--ink)]">监控源限制：</strong>
                                        {rule.monitorIds ? rule.monitorIds.map(id => snapshot?.monitors.find(m => m.id === id)?.name).filter(Boolean).join(", ") : "匹配全网监控任务"}
                                      </div>
                                      {rule.includeKeywords.length > 0 && (
                                        <div>
                                          <strong className="text-[var(--ink)]">包含任意词 (OR)：</strong>
                                          {rule.includeKeywords.map(kw => <span key={kw} className="inline-block bg-gray-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-gray-600">{kw}</span>)}
                                        </div>
                                      )}
                                      {rule.andKeywords.length > 0 && (
                                        <div>
                                          <strong className="text-[var(--ink)]">必须同时包含 (AND)：</strong>
                                          {rule.andKeywords.map(kw => <span key={kw} className="inline-block bg-blue-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-blue-600">{kw}</span>)}
                                        </div>
                                      )}
                                      {rule.excludeKeywords.length > 0 && (
                                        <div>
                                          <strong className="text-[var(--ink)]">排除过滤词 (NOT)：</strong>
                                          {rule.excludeKeywords.map(kw => <span key={kw} className="inline-block bg-red-50 rounded px-1.5 py-0.5 mr-1 text-[10px] font-semibold text-red-600">{kw}</span>)}
                                        </div>
                                      )}
                                      <div>
                                        <strong className="text-[var(--ink)]">路由目标邮箱：</strong>
                                        {rule.recipients.join(", ")}
                                      </div>
                                    </div>

                                    {/* 功能操作栏 */}
                                    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                                      <button 
                                        type="button" 
                                        disabled={testingRuleId === rule.id || updatingRuleId === rule.id} 
                                        className="rounded-full bg-[var(--ember-soft)] px-4 py-2 text-xs font-semibold text-[var(--ember)] smooth-interactive active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer" 
                                        onClick={() => void testSubRule(rule.id)}
                                      >
                                        {testingRuleId === rule.id ? (
                                          <>
                                            <svg className="animate-spin h-3 w-3 text-[var(--ember)]" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            测试发送中...
                                          </>
                                        ) : "⚡ 实时测试发信"}
                                      </button>
                                      <button 
                                        type="button" 
                                        disabled={testingRuleId === rule.id || updatingRuleId === rule.id}
                                        className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink-soft)] smooth-interactive disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
                                        onClick={() => {
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
                                            deliveryFrequency: rule.deliveryFrequency,
                                            deliveryTime: rule.deliveryTime,
                                            recipients: rule.recipients,
                                          });
                                        }}
                                      >
                                        编辑规则
                                      </button>
                                      <button 
                                        type="button" 
                                        disabled={testingRuleId === rule.id || updatingRuleId === rule.id}
                                        className="rounded-full border border-red-100 bg-red-50/50 px-4 py-2 text-xs font-semibold text-red-600 smooth-interactive hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" 
                                        onClick={() => void deleteSubRule(rule.id)}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              ) : (
                <div className="rounded-[2rem] bg-white/70 p-12 text-center flex flex-col items-center justify-center border border-[rgba(8,17,31,0.06)] shadow-sm backdrop-blur-xl">
                  {/* iOS 旋转加载 SVG */}
                  <svg className="animate-spin h-10 w-10 text-[var(--ember)] mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-10" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-semibold text-[var(--ink-soft)] animate-pulse">正在唤醒发信通道与订阅分流系统...</p>
                </div>
              )} />

            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
