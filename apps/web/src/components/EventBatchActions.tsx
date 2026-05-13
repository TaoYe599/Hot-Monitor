import React from "react";

interface EventBatchActionsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (select: boolean) => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  allExpanded?: boolean;
}

export function EventBatchActions({
  selectedCount,
  totalCount,
  onSelectAll,
  onMarkRead,
  onDelete,
  onExpandAll,
  onCollapseAll,
  allExpanded = false,
}: EventBatchActionsProps) {
  if (totalCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/20 bg-white/60 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
      {/* 装饰性渐变条 */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--ember)]/20 to-transparent" />

      <div className="flex flex-wrap items-center gap-3">
        {/* 全选 */}
        <label className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all hover:bg-white/50">
          <div className="relative">
            <input
              type="checkbox"
              checked={allSelected}
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
              {selectedCount > 0 ? `已选 ${selectedCount} / ${totalCount}` : `${totalCount} 条事件`}
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

        {/* 批量操作 */}
        {selectedCount > 0 && (
          <>
            {/* 分隔线 */}
            <div className="h-10 w-px bg-gradient-to-b from-transparent via-[rgba(8,17,31,0.08)] to-transparent" />

            {/* 标记已读 */}
            <button
              type="button"
              onClick={onMarkRead}
              className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[var(--ink-soft)] shadow-sm transition-all duration-200 hover:bg-green-50 hover:text-green-600 hover:shadow-[0_4px_12px_rgba(34,197,94,0.15)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              标记已读
              <span className="rounded-md bg-[rgba(8,17,31,0.06)] px-1.5 py-0.5 text-xs font-semibold">
                {selectedCount}
              </span>
            </button>

            {/* 删除 */}
            <button
              type="button"
              onClick={onDelete}
              className="group flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition-all duration-200 hover:bg-red-100 hover:text-red-600 hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除
              <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-bold">
                {selectedCount}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default EventBatchActions;
