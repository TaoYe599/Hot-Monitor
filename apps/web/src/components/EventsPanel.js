import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { EventCard } from "./EventCard";
import { EventBatchActions } from "./EventBatchActions";
function Empty({ text }) {
    return (_jsx("div", { className: "rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]", children: text }));
}
export function EventsPanel({ events, loading, selectedIds, expandedReasons, onSelectAll, onSelectEvent, onExpandAll, onCollapseAll, onToggleReason, onMarkRead, onDelete, }) {
    if (loading) {
        return _jsx(Empty, { text: "\u52A0\u8F7D\u4E2D..." });
    }
    if (events.length === 0) {
        return _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u547D\u4E2D\u4E8B\u4EF6\u3002\u521B\u5EFA\u4E00\u4E2A\u5173\u952E\u8BCD\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" });
    }
    const allExpanded = events.every((e) => expandedReasons.has(e.id));
    return (_jsxs(_Fragment, { children: [_jsx(EventBatchActions, { selectedCount: selectedIds.size, totalCount: events.length, onSelectAll: onSelectAll, onMarkRead: onMarkRead, onDelete: onDelete, onExpandAll: onExpandAll, onCollapseAll: onCollapseAll, allExpanded: allExpanded }), events.map((event) => (_jsx(EventCard, { event: event, selected: selectedIds.has(event.id), onSelect: onSelectEvent, expandedReasons: expandedReasons, onToggleReason: onToggleReason }, event.id)))] }));
}
export default EventsPanel;
