import type { HotspotCluster, HotspotEventSummary } from "@hot-monitor/shared";
import React from "react";

import { HotspotCard } from "./HotspotCard";

interface HotspotPanelProps {
  hotspots: (HotspotCluster & { events?: HotspotEventSummary[] })[];
  loading: boolean;
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
}: HotspotPanelProps) {
  if (loading) {
    return <Empty text="加载中..." />;
  }

  if (hotspots.length === 0) {
    return <Empty text="还没有热点簇。创建一个主题热点监控后，再手动触发一次扫描。" />;
  }

  return (
    <>
      {/* 热点卡片列表 */}
      {hotspots.map((hotspot) => (
        <HotspotCard
          key={hotspot.id}
          hotspot={hotspot}
        />
      ))}
    </>
  );
}

export default HotspotPanel;
