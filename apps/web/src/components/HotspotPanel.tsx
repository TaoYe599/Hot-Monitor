import type { HotspotCluster, HotspotEventSummary } from "@hot-monitor/shared";
import React from "react";

import { HotspotCard } from "./HotspotCard";

interface HotspotPanelProps {
  hotspots: (HotspotCluster & { events?: HotspotEventSummary[] })[];
  loading: boolean;
  selectedIds: Set<number>;
  expandedReasons: Set<number>;
  onSelectAll: (select: boolean) => void;
  onSelectHotspot: (id: number, selected: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleReason: (id: number) => void;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]">
      {text}
    </div>
  );
}

export function HotspotPanel({
  hotspots,
  loading,
  selectedIds,
  expandedReasons,
  onSelectAll,
  onSelectHotspot,
  onExpandAll,
  onCollapseAll,
  onToggleReason,
}: HotspotPanelProps) {
  if (loading) {
    return <Empty text="加载中..." />;
  }

  if (hotspots.length === 0) {
    return <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />;
  }

  const allExpanded = hotspots.every((h) => expandedReasons.has(h.id));

  return (
    <>
      {/* 批量操作栏 */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* 全选 */}
          <label className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-white/50">
            <div className="relative">
              <input
                type="checkbox"
                checked={selectedIds.size === hotspots.length && hotspots.length > 0}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="peer h-5 w-5 cursor-pointer rounded-md border-2 border-[rgba(8,17,31,0.15)] text-[var(--ember)] transition-all checked:border-[var(--ember)] checked:bg-[var(--ember)] hover:border-[var(--ember)]/50 focus:ring-2 focus:ring-[var(--ember)]/20 focus:ring-offset-2"
              />
              <svg
                className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--ink)]">全选</span>
              <span className="text-xs text-[var(--ink-soft)]">
                {selectedIds.size > 0 ? `已选 ${selectedIds.size} / ${hotspots.length}` : `${hotspots.length} 个热点`}
              </span>
            </div>
          </label>

          {/* 分隔线 */}
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-[rgba(8,17,31,0.08)] to-transparent" />

          {/* 一键展开/折叠 */}
          <button
            type="button"
            onClick={allExpanded ? onCollapseAll : onExpandAll}
            className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[var(--ink-soft)] shadow-sm transition-all duration-200 hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)]"
          >
            <svg
              className={`h-4 w-4 transition-transform duration-300 ${allExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {allExpanded ? "全部折叠" : "全部展开"}
          </button>
        </div>
      </div>

      {/* 热点卡片列表 */}
      {hotspots.map((hotspot) => (
        <HotspotCard
          key={hotspot.id}
          hotspot={hotspot}
          selected={selectedIds.has(hotspot.id)}
          onSelect={onSelectHotspot}
          expandedReasons={expandedReasons}
          onToggleReason={onToggleReason}
        />
      ))}
    </>
  );
}

export default HotspotPanel;
