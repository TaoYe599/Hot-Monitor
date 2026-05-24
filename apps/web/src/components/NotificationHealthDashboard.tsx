import { useEffect, useState } from "react";
import type { NotificationStats } from "@hot-monitor/shared";
import { api } from "../lib/api";

export function NotificationHealthDashboard() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getNotificationStats()
      .then(setStats)
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const deliveryPct = stats ? Math.round(stats.deliveryRate * 100) : 100;
  const noisePct = stats ? Math.round(stats.noiseRatio * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <svg className="animate-spin h-6 w-6 text-[var(--ember)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-sm text-[var(--ink-soft)]">加载健康数据...</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-6 text-sm text-[var(--ink-soft)]">暂无投递数据</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 核心指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="panel-card rounded-[1.4rem] p-4 text-center">
          <div className="text-2xl font-bold text-[#10b981]">{deliveryPct}%</div>
          <div className="text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide">送达率</div>
        </div>
        <div className="panel-card rounded-[1.4rem] p-4 text-center">
          <div className="text-2xl font-bold text-[#0284c7]">{stats.total}</div>
          <div className="text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide">总投递</div>
        </div>
        <div className="panel-card rounded-[1.4rem] p-4 text-center">
          <div className="text-2xl font-bold text-[#f59e0b]">{noisePct}%</div>
          <div className="text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide">噪音比</div>
        </div>
        <div className="panel-card rounded-[1.4rem] p-4 text-center">
          <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
          <div className="text-xs text-[var(--ink-soft)] mt-1 uppercase tracking-wide">失败数</div>
        </div>
      </div>

      {/* 送达率进度条 */}
      <div>
        <div className="flex justify-between text-xs text-[var(--ink-soft)] mb-1.5">
          <span>送达成功率</span>
          <span className={deliveryPct >= 95 ? "text-[#10b981]" : deliveryPct >= 80 ? "text-[#f59e0b]" : "text-red-500"}>{deliveryPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-[rgba(8,17,31,0.06)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${deliveryPct}%`,
              backgroundColor: deliveryPct >= 95 ? "#10b981" : deliveryPct >= 80 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
        {deliveryPct < 95 && (
          <p className="text-xs text-[#f59e0b] mt-1.5">部分邮件投递失败，可能是目标邮箱满员或被判定为垃圾邮件。</p>
        )}
      </div>

      {/* 噪音比指示 */}
      <div>
        <div className="flex justify-between text-xs text-[var(--ink-soft)] mb-1.5">
          <span>噪音比（不相关反馈率）</span>
          <span>{stats.irrelevantCount} 条标记 / {stats.relevantCount + stats.irrelevantCount} 条反馈</span>
        </div>
        <div className="h-2.5 rounded-full bg-[rgba(8,17,31,0.06)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#f59e0b] transition-all duration-500"
            style={{ width: `${Math.min(noisePct * 2, 100)}%` }}
          />
        </div>
        {stats.noiseRatio > 0.3 && (
          <p className="text-xs text-[#f59e0b] mt-1.5">噪音比较高，建议调整规则的过滤阈值或关键词配置。</p>
        )}
      </div>

      {/* 近 7 天趋势 */}
      <div>
        <div className="text-xs text-[var(--ink-soft)] mb-3 uppercase tracking-wide">近 7 天投递趋势</div>
        <div className="grid grid-cols-7 gap-2">
          {stats.dailyStats.map((day) => {
            const date = new Date(day.date);
            const dayName = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
            const maxBar = Math.max(...stats.dailyStats.map((d) => d.sent), 1);
            return (
              <div key={day.date} className="flex flex-col items-center gap-1.5">
                <div className="w-full h-12 flex items-end justify-center">
                  <div
                    className="w-6 rounded-sm bg-[#10b981]/70 transition-all duration-300"
                    style={{ height: `${Math.max((day.sent / maxBar) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--ink-soft)]">{dayName}</span>
                <span className="text-[10px] font-semibold text-[var(--ink)]">{day.sent}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-[var(--ink-soft)] text-center">
        数据基于最近 30 天 {stats.total} 条通知日志统计
      </p>
    </div>
  );
}
