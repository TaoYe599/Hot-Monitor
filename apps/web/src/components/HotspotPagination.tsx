import React from "react";

interface HotspotPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function HotspotPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: HotspotPaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = Math.min((page - 1) * pageSize + 1, total);
  const endItem = Math.min(page * pageSize, total);

  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="mt-8 mb-4">
      {/* 分页栏容器 - 玻璃态设计 */}
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/60 px-5 py-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        {/* 装饰性渐变条 */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--ember)]/20 to-transparent" />

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* 左侧：分页信息 */}
          <div className="flex items-center gap-4">
            {/* 统计信息 */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ember-soft)]">
                <svg className="h-4 w-4 text-[var(--ember)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-[var(--ink-soft)]">显示条目</span>
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {startItem}–{endItem}
                  <span className="ml-1 font-normal text-[var(--ink-soft)]">/ {total}</span>
                </span>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-[rgba(8,17,31,0.1)] to-transparent sm:block" />

            {/* 每页条数选择 */}
            {onPageSizeChange && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--ink-soft)]">每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 w-14 cursor-pointer rounded-lg border border-[rgba(8,17,31,0.1)] bg-white px-1.5 text-center text-sm font-semibold text-[var(--ink)] transition-all hover:border-[var(--ember)] hover:shadow-[0_2px_8px_rgba(239,68,68,0.1)] focus:border-[var(--ember)] focus:outline-none focus:ring-2 focus:ring-[var(--ember)]/20"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-xs text-[var(--ink-soft)]">条</span>
              </div>
            )}
          </div>

          {/* 右侧：页码导航 */}
          <div className="flex items-center gap-1">
            {/* 上一页 */}
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="group flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--ink-soft)] shadow-sm transition-all duration-200 enabled:hover:bg-[var(--ember-soft)] enabled:hover:text-[var(--ember)] enabled:hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)] disabled:cursor-not-allowed disabled:opacity-30"
              title="上一页"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* 页码按钮 */}
            <div className="flex items-center gap-0.5">
              {pages.map((p, idx) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="flex h-9 w-9 items-center justify-center text-sm font-medium text-[var(--ink-soft)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange(p as number)}
                    className={`flex h-9 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${
                      p === page
                        ? "bg-gradient-to-br from-[var(--ember)] to-[var(--ember)]/90 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.4)]"
                        : "bg-white text-[var(--ink-soft)] shadow-sm hover:bg-[var(--ember-soft)] hover:text-[var(--ember)] hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)]"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>

            {/* 下一页 */}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="group flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[var(--ink-soft)] shadow-sm transition-all duration-200 enabled:hover:bg-[var(--ember-soft)] enabled:hover:text-[var(--ember)] enabled:hover:shadow-[0_4px_12px_rgba(239,68,68,0.15)] disabled:cursor-not-allowed disabled:opacity-30"
              title="下一页"
            >
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HotspotPagination;
