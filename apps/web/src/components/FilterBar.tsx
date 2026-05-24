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
import React, { useCallback, useEffect, useState, useRef } from "react";

// ============== 通用苹果极简 Popover 排序组件 ==============
interface SortDropdownProps<TValue extends string> {
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}

export function SortDropdown<TValue extends string>({
  value,
  options,
  onChange,
}: SortDropdownProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听全局点击以优雅收起下拉框
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const currentOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* 极简精致的当前状态触发器按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(8,17,31,0.04)] hover:bg-[rgba(8,17,31,0.07)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition-all duration-150 active:scale-95 cursor-pointer border border-[rgba(8,17,31,0.02)]"
      >
        <span>{currentOption?.label || "排序"}</span>
        <svg
          className={`w-3 h-3 text-[var(--ink-soft)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 具有 20px 高斯模糊和 85% 白色背景的精致悬浮窗 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-20 w-52 rounded-lg border border-white/40 bg-white/85 backdrop-blur-[20px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-0.5">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "font-bold text-[var(--ember)] bg-[var(--ember-soft)]/50"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(8,17,31,0.04)]"
                  }`}
                >
                  {/* 选中项的前置高亮品牌色小圆点指示灯 */}
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      isSelected ? "bg-[var(--ember)] scale-110" : "opacity-0"
                    }`}
                  />
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== 通用苹果极简 Popover 单选下拉菜单组件 ==============
interface CustomSelectProps<TValue extends string> {
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect<TValue extends string>({
  value,
  options,
  onChange,
  placeholder = "请选择",
  className = "",
}: CustomSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听全局点击以优雅收起下拉菜单
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const currentOption = options.find((opt) => opt.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* 极简触发展示按钮 */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-1.5 rounded-lg border border-[rgba(8,17,31,0.08)] bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] transition-all duration-150 active:scale-[0.99] cursor-pointer hover:bg-[rgba(8,17,31,0.02)]"
      >
        <span className={currentOption && currentOption.value !== "" ? "text-[var(--ink)] font-semibold" : "text-[var(--ink-soft)]"}>
          {currentOption?.label || placeholder}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-[var(--ink-soft)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 20px 高斯模糊 & 85% 不透明白色的精致下拉浮层 */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-30 w-full min-w-[160px] rounded-lg border border-white/40 bg-white/85 backdrop-blur-[20px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "font-bold text-[var(--ember)] bg-[var(--ember-soft)]/50"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[rgba(8,17,31,0.04)]"
                  }`}
                >
                  {/* 选中项的前置高亮品牌色小圆点指示灯 */}
                  <span
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                      isSelected ? "bg-[var(--ember)] scale-110" : "opacity-0"
                    }`}
                  />
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
    // 忽略解析错误
  }
  return defaults;
}

function savePrefs<T>(key: string, prefs: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // 忽略存储错误
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
    sort: { field: "createdAt", order: "desc" },
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

// ============== EventsFilterBar 组件 ==============

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // 点击外部收起更多筛选面板
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isFilterOpen]);

  const hasActiveFilter =
    prefs.filter.monitorId !== undefined ||
    (prefs.filter.sourceTypes && prefs.filter.sourceTypes.length > 0) ||
    prefs.filter.minAuthenticityScore !== undefined ||
    prefs.filter.minRelevanceScore !== undefined ||
    prefs.filter.status !== undefined;

  // 监控任务下拉选项数据
  const monitorOptions = [
    { value: "", label: "全部任务" },
    ...monitors.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  // 真实性要求下拉选项数据
  const authenticityOptions = [
    { value: "", label: "不限" },
    { value: "0.9", label: "90%+" },
    { value: "0.8", label: "80%+" },
    { value: "0.7", label: "70%+" },
    { value: "0.6", label: "60%+" },
  ];

  // 相关性要求下拉选项数据
  const relevanceOptions = [
    { value: "", label: "不限" },
    { value: "0.9", label: "90%+" },
    { value: "0.8", label: "80%+" },
    { value: "0.7", label: "70%+" },
    { value: "0.6", label: "60%+" },
  ];

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

      {/* 排序与高级筛选触发栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">排序:</span>
        <SortDropdown
          value={`${prefs.sort.field}-${prefs.sort.order}`}
          options={EVENT_SORT_OPTIONS}
          onChange={(val) => {
            const [field, order] = val.split("-") as [EventSortField, "asc" | "desc"];
            onSortChange(field, order);
          }}
        />

        {/* 展开/收起高级筛选 Popover 触发器 */}
        <div className="relative inline-block" ref={filterContainerRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer border border-[rgba(8,17,31,0.02)] ${
              isFilterOpen || hasActiveFilter
                ? "bg-[var(--ember-soft)] text-[var(--ember)] border-[var(--ember)]/10"
                : "bg-[rgba(8,17,31,0.04)] hover:bg-[rgba(8,17,31,0.07)] text-[var(--ink)]"
            }`}
          >
            {hasActiveFilter && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)] animate-pulse" />
            )}
            <span>更多筛选</span>
            <svg
              className={`w-3 h-3 text-[var(--ink-soft)] transition-transform duration-200 ${
                isFilterOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 更多筛选 Popover 悬浮窗：20px 高斯模糊 & 85% 白色 */}
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 z-20 w-[calc(100vw-2rem)] sm:w-[28rem] rounded-lg border border-white/40 bg-white/85 backdrop-blur-[20px] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="space-y-4">
                <div className="text-xs font-bold text-[var(--ink)] border-b border-[rgba(8,17,31,0.05)] pb-2 flex items-center justify-between">
                  <span>高级筛选配置</span>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearFilter();
                        setIsFilterOpen(false);
                      }}
                      className="text-[10px] text-[var(--ember)] hover:underline"
                    >
                      清空全部
                    </button>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
                  {/* 监控任务筛选 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">监控任务</label>
                    <CustomSelect
                      value={prefs.filter.monitorId ? String(prefs.filter.monitorId) : ""}
                      options={monitorOptions}
                      onChange={(val) =>
                        onFilterChange({
                          monitorId: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="全部任务"
                    />
                  </div>

                  {/* 最低真实性 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">最低真实性</label>
                    <CustomSelect
                      value={prefs.filter.minAuthenticityScore ? String(prefs.filter.minAuthenticityScore) : ""}
                      options={authenticityOptions}
                      onChange={(val) =>
                        onFilterChange({
                          minAuthenticityScore: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="不限"
                    />
                  </div>

                  {/* 最低相关性 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">最低相关性</label>
                    <CustomSelect
                      value={prefs.filter.minRelevanceScore ? String(prefs.filter.minRelevanceScore) : ""}
                      options={relevanceOptions}
                      onChange={(val) =>
                        onFilterChange({
                          minRelevanceScore: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="不限"
                    />
                  </div>

                  {/* 状态 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">状态</label>
                    <CustomSelect
                      value={prefs.filter.status ?? ""}
                      options={EVENT_STATUS_OPTIONS}
                      onChange={(val) =>
                        onFilterChange({
                          status: (val as "accepted" | "rejected") || undefined,
                        })
                      }
                      placeholder="全部状态"
                    />
                  </div>

                  {/* 数据源多选 (跨越两列) */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">限制数据源平台</label>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
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
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                              selected
                                ? "bg-[var(--ember)] text-white shadow-sm"
                                : "bg-slate-100 hover:bg-[var(--ember-soft)] text-slate-500 hover:text-[var(--ember)]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 清除筛选 */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600 cursor-pointer"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}

// ============== HotspotsFilterBar 组件 ==============

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
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterContainerRef = useRef<HTMLDivElement>(null);

  // 点击外部收起更多筛选面板
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterContainerRef.current && !filterContainerRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isFilterOpen]);

  const hasActiveFilter =
    prefs.filter.monitorId !== undefined ||
    prefs.filter.minScore !== undefined ||
    prefs.filter.minCoverage !== undefined;

  // 监控任务下拉选项数据
  const monitorOptions = [
    { value: "", label: "全部任务" },
    ...monitors.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  // 最低热点评分下拉选项数据
  const scoreOptions = [
    { value: "", label: "不限" },
    { value: "0.9", label: "90%+" },
    { value: "0.8", label: "80%+" },
    { value: "0.7", label: "70%+" },
    { value: "0.6", label: "60%+" },
  ];

  // 最低来源数下拉选项数据
  const coverageOptions = [
    { value: "", label: "不限" },
    { value: "3", label: "3+ 个来源" },
    { value: "5", label: "5+ 个来源" },
    { value: "10", label: "10+ 个来源" },
  ];

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

      {/* 排序与高级筛选触发栏 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--ink-soft)]">排序:</span>
        <SortDropdown
          value={`${prefs.sort.field}-${prefs.sort.order}`}
          options={HOTSPOT_SORT_OPTIONS}
          onChange={(val) => {
            const [field, order] = val.split("-") as [HotspotSortField, "asc" | "desc"];
            onSortChange(field, order);
          }}
        />

        {/* 展开/收起高级筛选 Popover */}
        <div className="relative inline-block" ref={filterContainerRef}>
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer border border-[rgba(8,17,31,0.02)] ${
              isFilterOpen || hasActiveFilter
                ? "bg-[var(--ember-soft)] text-[var(--ember)] border-[var(--ember)]/10"
                : "bg-[rgba(8,17,31,0.04)] hover:bg-[rgba(8,17,31,0.07)] text-[var(--ink)]"
            }`}
          >
            {hasActiveFilter && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)] animate-pulse" />
            )}
            <span>更多筛选</span>
            <svg
              className={`w-3 h-3 text-[var(--ink-soft)] transition-transform duration-200 ${
                isFilterOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* 更多筛选 Popover 悬浮窗：20px 高斯模糊 & 85% 白色 */}
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 z-20 w-80 rounded-lg border border-white/40 bg-white/85 backdrop-blur-[20px] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="space-y-4">
                <div className="text-xs font-bold text-[var(--ink)] border-b border-[rgba(8,17,31,0.05)] pb-2 flex items-center justify-between">
                  <span>热点筛选配置</span>
                  {hasActiveFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearFilter();
                        setIsFilterOpen(false);
                      }}
                      className="text-[10px] text-[var(--ember)] hover:underline"
                    >
                      清空全部
                    </button>
                  )}
                </div>

                <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  {/* 监控任务筛选 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">监控任务</label>
                    <CustomSelect
                      value={prefs.filter.monitorId ? String(prefs.filter.monitorId) : ""}
                      options={monitorOptions}
                      onChange={(val) =>
                        onFilterChange({
                          monitorId: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="全部任务"
                    />
                  </div>

                  {/* 最低热点评分 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">最低热点评分</label>
                    <CustomSelect
                      value={prefs.filter.minScore ? String(prefs.filter.minScore) : ""}
                      options={scoreOptions}
                      onChange={(val) =>
                        onFilterChange({
                          minScore: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="不限"
                    />
                  </div>

                  {/* 最低来源数 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--ink-soft)] uppercase tracking-wider">最低来源数</label>
                    <CustomSelect
                      value={prefs.filter.minCoverage ? String(prefs.filter.minCoverage) : ""}
                      options={coverageOptions}
                      onChange={(val) =>
                        onFilterChange({
                          minCoverage: val ? Number(val) : undefined,
                        })
                      }
                      placeholder="不限"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 清除筛选 */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-full bg-[rgba(8,17,31,0.06)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:bg-red-50 hover:text-red-600 cursor-pointer"
          >
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
