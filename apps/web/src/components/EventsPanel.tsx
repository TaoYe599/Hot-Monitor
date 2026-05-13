import type { MonitorRecord, VerifiedEvent } from "@hot-monitor/shared";
import React from "react";

import { EventCard } from "./EventCard";
import { EventBatchActions } from "./EventBatchActions";

interface EventsPanelProps {
  events: VerifiedEvent[];
  loading: boolean;
  monitors: MonitorRecord[];
  selectedIds: Set<number>;
  expandedReasons: Set<number>;
  onSelectAll: (select: boolean) => void;
  onSelectEvent: (id: number, selected: boolean) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleReason: (id: number) => void;
  onMarkRead: () => void;
  onDelete: () => void;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]">
      {text}
    </div>
  );
}

export function EventsPanel({
  events,
  loading,
  selectedIds,
  expandedReasons,
  onSelectAll,
  onSelectEvent,
  onExpandAll,
  onCollapseAll,
  onToggleReason,
  onMarkRead,
  onDelete,
}: EventsPanelProps) {
  if (loading) {
    return <Empty text="加载中..." />;
  }

  if (events.length === 0) {
    return <Empty text="还没有命中事件。创建一个关键词监控后，再手动触发一次扫描。" />;
  }

  const allExpanded = events.every((e) => expandedReasons.has(e.id));

  return (
    <>
      <EventBatchActions
        selectedCount={selectedIds.size}
        totalCount={events.length}
        onSelectAll={onSelectAll}
        onMarkRead={onMarkRead}
        onDelete={onDelete}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        allExpanded={allExpanded}
      />
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          selected={selectedIds.has(event.id)}
          onSelect={onSelectEvent}
          expandedReasons={expandedReasons}
          onToggleReason={onToggleReason}
        />
      ))}
    </>
  );
}

export default EventsPanel;
