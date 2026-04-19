import type {
  DashboardSnapshot,
  MonitorFormInput,
  MonitorMode,
  MonitorRecord,
  ScanJobRecord,
  SettingsFormInput,
  SettingsRecord,
} from "@hot-monitor/shared";
import {
  DEFAULT_NOTIFICATION_CHANNELS,
  DEFAULT_SOURCE_CONFIG,
} from "@hot-monitor/shared";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { NavLink, Route, Routes } from "react-router";
import { useRegisterSW } from "virtual:pwa-register/react";

import { api, splitLines } from "./lib/api";
import { subscribeToPush } from "./lib/push";

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

function HotspotList({ hotspots }: { hotspots: DashboardSnapshot["hotspots"] }) {
  if (hotspots.length === 0) {
    return <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />;
  }

  return (
    <>
      {hotspots.map((hotspot) => (
        <article key={hotspot.id} className="mb-4 rounded-[1.5rem] bg-white/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <strong>{hotspot.label}</strong>
            <span className="mono text-xs text-[var(--ink-soft)]">
              {Math.round(hotspot.score * 100)}%
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
            {hotspot.summary}
          </p>
          {hotspot.supportingUrls?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {hotspot.supportingUrls.slice(0, 3).map((url) => (
                <span
                  key={url}
                  className="mono rounded-full border border-[rgba(8,17,31,0.08)] bg-[var(--paper-strong)] px-3 py-1 text-xs text-[var(--ink-soft)]"
                  title={url}
                >
                  来源：{formatSourceHost(url)}
                </span>
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
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

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
      });
    } catch (reason) {
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
    const jobHandler = (event: Event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent<string>).data) as { payload: ScanJobRecord };
        mergeJob(parsed.payload);
      } catch {
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
    if (pendingJobIds.length === 0) return;
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
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
                自动抓取多源热点，借助 OpenRouter 做真假判定与聚类，再通过 Web Push、Webhook 和邮件发出提醒。
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

        <div className="panel-card flex flex-col gap-3 rounded-[1.5rem] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--ink-soft)]">{summary}</div>
          {needRefresh ? <button type="button" className="rounded-full bg-[var(--ember)] px-4 py-2 text-sm font-semibold text-white" onClick={() => void updateServiceWorker(true)}>刷新到新版本</button> : null}
        </div>

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
              <Route path="/" element={<div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]"><Panel title="实时命中" body="这里展示关键词监控命中的结果。">{snapshot?.events?.length ? snapshot.events.map((event) => <article key={event.id} className="mb-4 rounded-[1.4rem] bg-white/70 p-5"><div className="flex flex-wrap items-center gap-3"><strong>{event.title}</strong><span className="mono text-xs text-[var(--ink-soft)]">真实性 {Math.round(event.authenticityScore * 100)}%</span><span className="mono text-xs text-[var(--ink-soft)]">相关性 {Math.round(event.relevanceScore * 100)}%</span></div><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{event.summary}</p></article>) : <Empty text="还没有命中事件。创建一个关键词监控后，再手动触发一次扫描。" />}</Panel><div className="grid gap-5"><Panel title="热点快照" body="这里展示主题热点监控聚合出的结果。">{snapshot?.hotspots?.length ? snapshot.hotspots.slice(0, 3).map((hotspot) => <article key={hotspot.id} className="mb-4 rounded-[1.5rem] bg-white/70 p-5"><div className="flex items-center justify-between gap-3"><strong>{hotspot.label}</strong><span className="mono text-xs text-[var(--ink-soft)]">{Math.round(hotspot.score * 100)}%</span></div><p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{hotspot.summary}</p></article>) : <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />}</Panel><Panel title="扫描任务" body="扫描提交后会在后台执行，并在这里更新状态。">{jobs.length ? jobs.slice(0, 6).map((job) => <article key={job.id} className="mb-3 rounded-[1.4rem] bg-white/70 p-4"><div className="flex flex-wrap items-center gap-3"><strong>{job.monitorName}</strong><span className="mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">{job.status}</span></div><p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{jobSummary(job)}</p></article>) : <Empty text="还没有扫描任务记录。" />}</Panel></div></div>} />
              <Route path="/monitors" element={<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]"><form className="panel-card rounded-[2rem] p-6" onSubmit={createMonitor}><div className="grid gap-4"><Field label="任务名称" description="只用于卡片标题和任务区分，不参与搜索。"><input value={monitorForm.name} onChange={(event) => setMonitorForm((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="监控模式" description="关键词监控用于精准命中，主题热点用于周期性发现。"><select value={monitorForm.mode} onChange={(event) => setMonitorForm((current) => ({ ...current, mode: event.target.value as MonitorMode }))}><option value="keyword">关键词监控</option><option value="topic">主题热点</option></select></Field><Field label={queryLabel(monitorForm.mode)} description={queryHint(monitorForm.mode)}><input placeholder={monitorForm.mode === "keyword" ? "例如：GPT-5.4" : "例如：OpenAI"} value={monitorForm.query} onChange={(event) => setMonitorForm((current) => ({ ...current, query: event.target.value }))} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="轮询间隔" description="系统多久自动检查一次。"><input type="number" value={monitorForm.intervalMinutes} onChange={(event) => setMonitorForm((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))} /></Field><Field label="冷却时间" description="两次相似提醒之间至少间隔多久。"><input type="number" value={monitorForm.cooldownMinutes} onChange={(event) => setMonitorForm((current) => ({ ...current, cooldownMinutes: Number(event.target.value) }))} /></Field></div><button type="submit" className="rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white">创建任务</button></div></form><div className="grid gap-4">{(snapshot?.monitors ?? []).map((monitor) => { const job = jobsByMonitorId.get(monitor.id); const isRunning = job?.status === "queued" || job?.status === "running"; return <article key={monitor.id} className="panel-card rounded-[1.6rem] p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--ember-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ember)]">{modeLabel(monitor.mode)}</span><span className="mono rounded-full border border-[rgba(8,17,31,0.08)] px-3 py-1 text-xs text-[var(--ink-soft)]">{monitor.intervalMinutes} min</span>{job ? <span className="mono rounded-full border border-[rgba(19,138,123,0.16)] bg-[var(--signal-soft)] px-3 py-1 text-xs text-[var(--signal)]">{job.status}</span> : null}</div><div><h3 className="text-xl font-semibold">{monitor.name}</h3><p className="mt-1 text-sm text-[var(--ink-soft)]">{queryPrefix(monitor.mode)}：{monitor.query}</p></div>{job ? <p className="text-sm text-[var(--ink-soft)]">{jobSummary(job)}</p> : null}</div><div className="flex flex-wrap gap-2 md:max-w-[16rem] md:justify-end"><button type="button" className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={isRunning} onClick={() => void runMonitor(monitor.id)}>{isRunning ? "扫描中…" : "扫描"}</button><button type="button" className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]" onClick={() => void patchMonitor(monitor, { enabled: !monitor.enabled })}>{monitor.enabled ? "停用" : "启用"}</button><button type="button" className="rounded-full bg-[rgba(8,17,31,0.06)] px-4 py-2 text-sm font-semibold text-[var(--ink-soft)]" onClick={() => void deleteMonitor(monitor)}>删除</button></div></div></article>; })}</div></div>} />
              <Route path="/hotspots" element={<Panel title="热点发现" body="这里展示主题热点监控聚合出的结果。"><HotspotList hotspots={snapshot?.hotspots ?? []} /></Panel>} />
              <Route path="/settings" element={settingsForm ? <form className="grid gap-5 xl:grid-cols-[1fr_0.92fr]" onSubmit={saveSettings}><Panel title="通知配置" body="每行一个 Webhook 或邮箱，保存后即可用于测试通知。"><div className="grid gap-4"><Field label="Webhook URLs" description="每行一个地址"><textarea rows={4} value={settingsForm.webhookUrls.join("\n")} onChange={(event) => updateSettingsField((current) => ({ ...current, webhookUrls: splitLines(event.target.value) }))} /></Field><Field label="通知邮箱" description="每行一个邮箱"><textarea rows={3} value={settingsForm.emailTo.join("\n")} onChange={(event) => updateSettingsField((current) => ({ ...current, emailTo: splitLines(event.target.value) }))} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="SMTP Host"><input value={settingsForm.smtpHost ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpHost: event.target.value || null }))} /></Field><Field label="SMTP Port"><input type="number" value={settingsForm.smtpPort ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPort: event.target.value ? Number(event.target.value) : null }))} /></Field></div><div className="grid gap-4 md:grid-cols-2"><Field label="SMTP User"><input value={settingsForm.smtpUser ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpUser: event.target.value || null }))} /></Field><Field label="SMTP Password"><input type="password" value={settingsForm.smtpPassword ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpPassword: event.target.value || null }))} /></Field></div><Field label="SMTP From"><input value={settingsForm.smtpFrom ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, smtpFrom: event.target.value || null }))} /></Field><Field label="VAPID Public Key"><textarea rows={4} value={settingsForm.vapidPublicKey ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, vapidPublicKey: event.target.value || null }))} /></Field><Field label="VAPID Private Key"><textarea rows={4} value={settingsForm.vapidPrivateKey ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, vapidPrivateKey: event.target.value || null }))} /></Field><Field label="VAPID Subject"><input value={settingsForm.vapidSubject ?? ""} onChange={(event) => updateSettingsField((current) => ({ ...current, vapidSubject: event.target.value || null }))} /></Field><button type="submit" className="rounded-full bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-white">保存通知设置</button></div></Panel><div className="grid gap-5"><Panel title="浏览器推送" body="保存 VAPID 公钥后，为当前浏览器完成订阅。"><button type="button" className="rounded-full bg-[var(--signal)] px-4 py-3 text-sm font-semibold text-white" onClick={() => void subscribePush()}>订阅当前浏览器</button></Panel><Panel title="测试通知" body="向当前配置好的三类渠道统一发一条测试消息。"><button type="button" className="rounded-full bg-[var(--ember)] px-4 py-3 text-sm font-semibold text-white" onClick={() => void sendTestNotification()}>发送测试通知</button></Panel></div></form> : <Panel title="通知配置" body="正在加载通知设置，请稍等片刻。"><Empty text="设置尚未就绪时不会展示输入框，避免你输入后又被初始化数据覆盖。" /></Panel>} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
