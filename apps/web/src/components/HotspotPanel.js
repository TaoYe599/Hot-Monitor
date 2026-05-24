import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { HotspotCard } from "./HotspotCard";
function Empty({ text }) {
    return (_jsx("div", { className: "rounded-[1.4rem] bg-white/70 p-5 text-sm text-[var(--ink-soft)]", children: text }));
}
export function HotspotPanel({ hotspots, loading, }) {
    if (loading) {
        return _jsx(Empty, { text: "\u52A0\u8F7D\u4E2D..." });
    }
    if (hotspots.length === 0) {
        return _jsx(Empty, { text: "\u8FD8\u6CA1\u6709\u70ED\u70B9\u7C07\u3002\u521B\u5EFA\u4E00\u4E2A\u4E3B\u9898\u70ED\u70B9\u76D1\u63A7\u540E\uFF0C\u518D\u624B\u52A8\u89E6\u53D1\u4E00\u6B21\u626B\u63CF\u3002" });
    }
    return (_jsx(_Fragment, { children: hotspots.map((hotspot) => (_jsx(HotspotCard, { hotspot: hotspot }, hotspot.id))) }));
}
export default HotspotPanel;
