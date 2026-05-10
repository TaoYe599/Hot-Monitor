import type {
  EventFilter,
  EventSortConfig,
  EventSortField,
  HotspotFilter,
  HotspotSortConfig,
  HotspotSortField,
  MonitorRecord,
  SourceKind,
} from "@hot-monitor/shared";
import React, { useCallback, useEffect, useState } from "react";

// ============== 类型定义 ==============

export type { EventFilter, EventSortConfig, HotspotFilter, HotspotSortConfig };

interface BaseSortOption {
  value: string;
  label: string;
}

export const EVENT_SORT_OPTIONS: BaseSortOption[] = [
  { value: "createdAt-desc", label: "最新优先" },
  { value: "createdAt-asc", label: "最早优先" },
  { value: "authenticityScore-desc", label: "真实性 高→低" },
  { value: "relevanceScore-desc", label: "相关性 高→低" },
  { value: "combinedScore-desc", label: "综合评分 高→低" },
  { value: "sourceType-asc", label: "来源类型" },
];

export const HOTSPOT_SORT_OPTIONS: BaseSortOption[] = [
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

export const SOURCE_TYPE_OPTIONS: { value: SourceKind; label: string }[] = [
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

export interface EventsPrefs {
  sort: EventSortConfig;
  filter: Partial<EventFilter>;
  quickFilter?: "today" | "week" | "";
}

export interface HotspotsPrefs {
  sort: HotspotSortConfig;
  filter: Partial<HotspotFilter>;
  quickFilter?: "today" | "week" | "";
}

function loadPrefs<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return defaults;
}

function savePrefs<T>(key: string, prefs: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

// ============== Events Filter & Sort Hook ==============

export function useEventsPrefs(monitors: MonitorRecord[]) {
  const defaults: EventsPrefs = {
    sort: { field: "createdAt", order: "desc" },
    filter: {},
    quickFilter: "",
  };

  const [prefs, setPrefs] = useState<EventsPrefs>(() => loadPrefs(STORAGE_KEY_EVENTS, defaults));

  useEffect(() => {
    savePrefs(STORAGE_KEY_EVENTS, prefs);
  }, [prefs]);

  const setSort = useCallback((field: EventSortField, order: "asc" | "desc") => {
    setPrefs((p) => ({ ...p, sort: { field, order }, quickFilter: "" }));
  }, []);

  const setFilter = useCallback((filter: Partial<EventFilter>) => {
    setPrefs((p) => ({ ...p, filter: { ...p.filter, ...filter } }));
  }, []);

  const clearFilter = useCallback(() => {
    setPrefs((p) => ({ ...p, filter: {} }));
  }, []);

  const setQuickFilter = useCallback((quick: "today" | "week" | "") => {
    setPrefs((p) => ({
      ...p,
      quickFilter: quick,
      filter: { ...p.filter, timeRange: quick || undefined },
    }));
  }, []);

  const hasActiveFilter =
    prefs.filter.monitorId !== undefined ||
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

export function useHotspotsPrefs(monitors: MonitorRecord[]) {
  const defaults: HotspotsPrefs = {
    sort: { field: "score", order: "desc" },
    filter: {},
    quickFilter: "",
  };

  const [prefs, setPrefs] = useState<HotspotsPrefs>(() =>
    loadPrefs(STORAGE_KEY_HOTSPOTS, defaults),
  );

  useEffect(() => {
    savePrefs(STORAGE_KEY_HOTSPOTS, prefs);
  }, [prefs]);

  const setSort = useCallback((field: HotspotSortField, order: "asc" | "desc") => {
    setPrefs((p) => ({ ...p, sort: { field, order }, quickFilter: "" }));
  }, []);

  const setFilter = useCallback((filter: Partial<HotspotFilter>) => {
    setPrefs((p) => ({ ...p, filter: { ...p.filter, ...filter } }));
  }, []);

  const clearFilter = useCallback(() => {
    setPrefs((p) => ({ ...p, filter: {} }));
  }, []);

  const setQuickFilter = useCallback((quick: "today" | "week" | "") => {
    setPrefs((p) => ({
      ...p,
      quickFilter: quick,
      filter: { ...p.filter, timeRange: quick || undefined },
    }));
  }, []);

  const hasActiveFilter =
    prefs.filter.monitorId !== undefined ||
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

// ============== FilterBar 组件 ==============

interface EventsFilterBarProps {
  monitors: MonitorRecord[];
  prefs: EventsPrefs;
  onSortChange: (field: EventSortField, order: "asc" | "desc") => void;
  onFilterChange: (filter: Partial<EventFilter>) => void;
  onClearFilter: () => void;
  onQuickFilterChange: (quick: "today" | "week" | "") => void;
}

export function EventsFilterBar({
  monitors,
  prefs,
  onSortChange,
  onFilterChange,
  onClearFilter,
  onQuickFilterChange,
}: EventsFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 rounded-[1.4rem] bg-white/70 p-4">
      {/* 快捷筛选标签 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">快捷:</span>
        {[
          { value: "", label: "全部" },
          { value: "today", label: "今日最新" },
          { value: "week", label: "本周热门" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onQuickFilterChange(opt.value as "today" | "week" | "")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              prefs.quickFilter === opt.value
                ? "bg-[var(--ember)] text-white"
                : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 排序选择器 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">排序:</span>
        <select
          value={`${prefs.sort.field}-${prefs.sort.order}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split("-") as [EventSortField, "asc" | "desc"];
            onSortChange(field, order);
          }}
          className="rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
        >
          {EVENT_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 展开/收起高级筛选 */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            prefs.filter.monitorId !== undefined ||
            prefs.filter.sourceTypes?.length ||
            prefs.filter.minAuthenticityScore !== undefined ||
            prefs.filter.minRelevanceScore !== undefined ||
            prefs.filter.status
              ? "bg-[var(--ember)] text-white"
              : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"
          }`}
        >
          {expanded ? "收起筛选" : "更多筛选"}
        </button>

        {/* 清除筛选 */}
        {(prefs.filter.monitorId !== undefined ||
          prefs.filter.sourceTypes?.length ||
          prefs.filter.minAuthenticityScore !== undefined ||
          prefs.filter.minRelevanceScore !== undefined ||
          prefs.filter.status) && (
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 高级筛选面板 */}
      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-[rgba(8,17,31,0.08)] pt-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 监控任务筛选 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">监控任务</label>
            <select
              value={prefs.filter.monitorId ?? ""}
              onChange={(e) =>
                onFilterChange({
                  monitorId: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">全部任务</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 数据源多选 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">数据源</label>
            <div className="flex flex-wrap gap-1">
              {SOURCE_TYPE_OPTIONS.map((opt) => {
                const selected = prefs.filter.sourceTypes?.includes(opt.value) ?? false;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const current = prefs.filter.sourceTypes ?? [];
                      const updated = selected
                        ? current.filter((s) => s !== opt.value)
                        : [...current, opt.value];
                      onFilterChange({
                        sourceTypes: updated.length > 0 ? updated : undefined,
                      });
                    }}
                    className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                      selected
                        ? "bg-[var(--ember)] text-white"
                        : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 评分范围 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">最低真实性</label>
            <select
              value={prefs.filter.minAuthenticityScore ?? ""}
              onChange={(e) =>
                onFilterChange({
                  minAuthenticityScore: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">不限</option>
              <option value="0.9">90%+</option>
              <option value="0.8">80%+</option>
              <option value="0.7">70%+</option>
              <option value="0.6">60%+</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">最低相关性</label>
            <select
              value={prefs.filter.minRelevanceScore ?? ""}
              onChange={(e) =>
                onFilterChange({
                  minRelevanceScore: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">不限</option>
              <option value="0.9">90%+</option>
              <option value="0.8">80%+</option>
              <option value="0.7">70%+</option>
              <option value="0.6">60%+</option>
            </select>
          </div>

          {/* 通知状态 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">状态</label>
            <select
              value={prefs.filter.status ?? ""}
              onChange={(e) =>
                onFilterChange({
                  status: (e.target.value as "accepted" | "rejected") || undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              {EVENT_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Hotspots FilterBar 组件 ==============

interface HotspotsFilterBarProps {
  monitors: MonitorRecord[];
  prefs: HotspotsPrefs;
  onSortChange: (field: HotspotSortField, order: "asc" | "desc") => void;
  onFilterChange: (filter: Partial<HotspotFilter>) => void;
  onClearFilter: () => void;
  onQuickFilterChange: (quick: "today" | "week" | "") => void;
}

export function HotspotsFilterBar({
  monitors,
  prefs,
  onSortChange,
  onFilterChange,
  onClearFilter,
  onQuickFilterChange,
}: HotspotsFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 rounded-[1.4rem] bg-white/70 p-4">
      {/* 快捷筛选标签 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">快捷:</span>
        {[
          { value: "", label: "全部" },
          { value: "today", label: "今日最新" },
          { value: "week", label: "本周热门" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onQuickFilterChange(opt.value as "today" | "week" | "")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              prefs.quickFilter === opt.value
                ? "bg-[var(--ember)] text-white"
                : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)] hover:text-[var(--ember)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 排序选择器 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">排序:</span>
        <select
          value={`${prefs.sort.field}-${prefs.sort.order}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split("-") as [
              HotspotSortField,
              "asc" | "desc",
            ];
            onSortChange(field, order);
          }}
          className="rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
        >
          {HOTSPOT_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* 展开/收起高级筛选 */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
            prefs.filter.monitorId !== undefined ||
            prefs.filter.minScore !== undefined ||
            prefs.filter.minCoverage !== undefined
              ? "bg-[var(--ember)] text-white"
              : "bg-white/80 text-[var(--ink-soft)] hover:bg-[var(--ember-soft)]"
          }`}
        >
          {expanded ? "收起筛选" : "更多筛选"}
        </button>

        {/* 清除筛选 */}
        {(prefs.filter.monitorId !== undefined ||
          prefs.filter.minScore !== undefined ||
          prefs.filter.minCoverage !== undefined) && (
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600"
          >
            清除筛选
          </button>
        )}
      </div>

      {/* 高级筛选面板 */}
      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-[rgba(8,17,31,0.08)] pt-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 监控任务筛选 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">监控任务</label>
            <select
              value={prefs.filter.monitorId ?? ""}
              onChange={(e) =>
                onFilterChange({
                  monitorId: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">全部任务</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* 热点评分 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">最低热点评分</label>
            <select
              value={prefs.filter.minScore ?? ""}
              onChange={(e) =>
                onFilterChange({
                  minScore: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">不限</option>
              <option value="0.9">90%+</option>
              <option value="0.8">80%+</option>
              <option value="0.7">70%+</option>
              <option value="0.6">60%+</option>
            </select>
          </div>

          {/* 最低覆盖 */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--ink-soft)]">最低来源数</label>
            <select
              value={prefs.filter.minCoverage ?? ""}
              onChange={(e) =>
                onFilterChange({
                  minCoverage: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              className="w-full rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-3 py-1.5 text-xs"
            >
              <option value="">不限</option>
              <option value="3">3+ 个来源</option>
              <option value="5">5+ 个来源</option>
              <option value="10">10+ 个来源</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
