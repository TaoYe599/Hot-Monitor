import type { HotspotCluster, SourceKind, HotspotEventSummary } from "@hot-monitor/shared";
import React, { useState, useEffect, useRef } from "react";

interface HotspotCardProps {
  hotspot: HotspotCluster & { events?: HotspotEventSummary[] };
}

// 来源平台显示标签映射
const SOURCE_LABELS: Record<SourceKind, string> = {
  twitter: "Twitter",
  search: "搜索",
  google: "Google",
  rss: "官方博客",
  github: "GitHub",
  hackernews: "Hacker News",
  zhihu: "知乎",
  baidu: "百度",
  weibo: "微博",
  reddit: "Reddit",
  manual: "手动",
};

// 从 URL 解析来源类型
function parseSourceFromUrl(url: string): SourceKind {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "twitter";
    if (hostname.includes("news.ycombinator.com")) return "hackernews";
    if (hostname.includes("reddit.com")) return "reddit";
    if (hostname.includes("zhihu.com")) return "zhihu";
    if (hostname.includes("baidu.com")) return "baidu";
    if (hostname.includes("weibo.com")) return "weibo";
    if (hostname.includes("github.com")) return "github";
    if (hostname.includes("google.com")) return "google";
    return "search";
  } catch {
    return "search";
  }
}

// 获取来源显示名称
function getSourceDisplay(url: string): string {
  const kind = parseSourceFromUrl(url);
  return SOURCE_LABELS[kind] || kind;
}

// 格式化相对时间
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 格式化数字（超过1000显示为K）
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return String(num);
}

// 获取去重后的来源类型
function getSupportingSourceKinds(urls: string[]): SourceKind[] {
  const kinds = new Set<SourceKind>();
  for (const url of urls) {
    kinds.add(parseSourceFromUrl(url));
  }
  return Array.from(kinds);
}

// 智能生成信源跳转列表的精细标签，支持抓取具体事件作者
function getSourceMenuLabel(url: string, events?: HotspotEventSummary[]): string {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const kind = parseSourceFromUrl(url);
    const platform = SOURCE_LABELS[kind] || "数据源";
    const matchedEvent = events?.find((e) => e.sourceUrl === url);
    
    if (matchedEvent) {
      if (matchedEvent.author) {
        return `查看 ${matchedEvent.author} 的分享 (${domain})`;
      }
      return `查看 ${matchedEvent.title ? matchedEvent.title.slice(0, 16) : platform} (${domain})`;
    }
    return `查看 ${platform} 的分析 (${domain})`;
  } catch {
    return `查看原著链接 (${url.slice(0, 20)}...)`;
  }
}

// 渲染极简低饱和度单色 SVG/Emoji 图标
function renderSourceIcon(kind: SourceKind) {
  switch (kind) {
    case "twitter":
      return (
        <svg className="w-3.5 h-3.5 fill-current text-slate-400 hover:text-sky-500 transition-colors" viewBox="0 0 24 24" key="tw">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    case "github":
      return (
        <svg className="w-3.5 h-3.5 fill-current text-slate-400 hover:text-zinc-800 transition-colors" viewBox="0 0 24 24" key="gh">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      );
    case "hackernews":
      return (
        <span className="w-3.5 h-3.5 flex items-center justify-center bg-orange-500/10 text-orange-600 border border-orange-500/20 font-bold rounded-sm text-[8px] scale-90 flex-shrink-0" key="hn" title="Hacker News">Y</span>
      );
    case "reddit":
      return <span key="rd" title="Reddit" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">👽</span>;
    case "zhihu":
      return <span key="zh" title="知乎" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">💬</span>;
    case "weibo":
      return <span key="wb" title="微博" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">🔴</span>;
    case "google":
      return <span key="gg" title="Google News" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">🔍</span>;
    case "rss":
      return <span key="rs" title="官方博客 RSS" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">📰</span>;
    default:
      return <span key="def" title="搜索/其他" className="grayscale opacity-75 hover:grayscale-0 transition-all text-xs flex-shrink-0">🔗</span>;
  }
}

export function HotspotCard({
  hotspot,
}: HotspotCardProps) {
  const supportingKinds = getSupportingSourceKinds(hotspot.supportingUrls);
  const hasSingleSource = hotspot.supportingUrls.length === 1;

  // 展开菜单的状态控制
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement>(null);

  // 监听外部点击以优雅收起微型悬浮菜单
  useEffect(() => {
    if (!isSourceMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(e.target as Node)) {
        setIsSourceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isSourceMenuOpen]);

  // 1. 构建顶部“信任锚点线 (Trust Anchor Line)”中的社交背书与数据指标
  const aggregates = hotspot.engagementAggregates;
  const hasTwitter = supportingKinds.includes("twitter");
  const hasHackerNews = supportingKinds.includes("hackernews");

  const metrics: string[] = [];
  metrics.push(`全网热度 ${Math.round(hotspot.score * 100)}%`);

  if (aggregates) {
    if (hasTwitter) {
      if (aggregates.totalLikes) metrics.push(`${formatNumber(aggregates.totalLikes)} 赞`);
      if (aggregates.totalRetweets) metrics.push(`${formatNumber(aggregates.totalRetweets)} 转发`);
      if (aggregates.totalViews) metrics.push(`${formatNumber(aggregates.totalViews)} 浏览`);
    }
    if (hasHackerNews) {
      if (aggregates.totalPoints) metrics.push(`${formatNumber(aggregates.totalPoints)} 票`);
    }
    if (aggregates.totalComments) {
      metrics.push(`${formatNumber(aggregates.totalComments)} 讨论`);
    }
  }

  // 加入相对人性化时间
  if (hotspot.latestPublishedAt) {
    metrics.push(formatRelativeTime(hotspot.latestPublishedAt));
  } else {
    metrics.push(formatRelativeTime(hotspot.createdAt));
  }

  return (
    <article 
      className="group relative mb-4 rounded-2xl bg-[#FFFFFF] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-transparent"
    >

      {/* 2. 顶部信任锚点线 (Trust Anchor Line) */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 select-none">
        
        {/* 多来源图标串转化：如果只有1个来源直跳新页，否则弹出精致毛玻璃悬浮Popover */}
        {hasSingleSource ? (
          <a
            href={hotspot.supportingUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer active:scale-95 flex-shrink-0"
            title="点击在新标签页查看原著"
          >
            {renderSourceIcon(parseSourceFromUrl(hotspot.supportingUrls[0]))}
          </a>
        ) : (
          <div className="relative inline-block" ref={sourceMenuRef}>
            <button
              type="button"
              onClick={() => setIsSourceMenuOpen(prev => !prev)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-100/80 transition-colors cursor-pointer active:scale-95 flex-shrink-0 ${
                isSourceMenuOpen ? "bg-slate-100 text-[var(--ember)]" : ""
              }`}
              title="查看多个原著信源"
            >
              <div className="flex items-center gap-1">
                {supportingKinds.slice(0, 3).map((kind) => renderSourceIcon(kind))}
              </div>
              <svg
                className={`w-2.5 h-2.5 text-slate-400 transition-transform duration-200 ${
                  isSourceMenuOpen ? "rotate-180 text-[var(--ember)]" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Acrylic 材质微型多源悬浮菜单：带有 8px 小圆点和微弱投影 */}
            {isSourceMenuOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 w-72 rounded-lg border border-white/40 bg-white/85 backdrop-blur-[20px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5 select-none">
                  <div className="text-[10px] font-bold text-slate-400 px-2.5 py-1 select-none border-b border-[rgba(8,17,31,0.04)] mb-1">
                    选择要访问的原著来源：
                  </div>
                  {hotspot.supportingUrls.map((url, idx) => {
                    const menuLabel = getSourceMenuLabel(url, hotspot.events);
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsSourceMenuOpen(false)}
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-semibold text-slate-500 hover:text-[var(--ember)] hover:bg-[rgba(8,17,31,0.04)] transition-all cursor-pointer truncate"
                      >
                        <span className="text-slate-400">🔗</span>
                        <span className="truncate flex-1">{menuLabel}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* 指标圆点分隔 */}
        <span className="text-slate-200 font-bold select-none flex-shrink-0">·</span>
        <span className="flex flex-wrap items-center gap-1.5 select-none leading-none">
          {metrics.map((m, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-200">·</span>}
              <span className={idx === 0 ? "font-bold text-[var(--ember)] bg-[var(--ember-soft)]/50 px-1.5 py-0.5 rounded-md text-[10px]" : ""}>
                {m}
              </span>
            </React.Fragment>
          ))}
        </span>
      </div>

      {/* 3. 字体字阶层级核心事实 */}
      <h3 className="text-[16px] font-semibold text-[#111111] line-height-[1.4] mt-3 mb-2 hover:text-[var(--ember)] transition-colors duration-200 leading-snug">
        {hotspot.label}
      </h3>

      {/* 4. AI 智能总结（价值提炼），超舒适的 1.6 倍行高 */}
      <p className="text-[14px] font-normal text-[#444444] leading-[1.6] mt-2">
        {hotspot.summary}
      </p>

      {/* 5. 底部图层：AI 研判理由与归因辅助 */}
      {hotspot.reason && (
        <div className="mt-3.5 flex items-start gap-1.5 text-[12px] text-[#778899] italic leading-normal select-none">
          <svg className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>AI 研判：{hotspot.reason}</span>
        </div>
      )}

      {/* 6. 关联事件极简目录（无背景框、无折叠小盒子，安静如杂志目录流） */}
      {hotspot.events && hotspot.events.length > 0 && (
        <div className="mt-4 border-t border-slate-50 pt-3.5 select-none">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">关联事件目录</div>
          <div className="space-y-2">
            {hotspot.events.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-start gap-2.5 text-xs text-slate-500">
                <span className="text-[10px] font-bold text-[var(--ember)] bg-[var(--ember-soft)] px-1.5 py-0.5 rounded-md flex-shrink-0">
                  {SOURCE_LABELS[event.sourceType] || event.sourceLabel}
                </span>
                <a 
                  href={event.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-[var(--ember)] hover:underline truncate flex-1 font-medium transition-colors"
                >
                  {event.title}
                </a>
                <span className="text-[10px] text-slate-400 flex-shrink-0 font-medium">
                  {event.publishedAt ? formatRelativeTime(event.publishedAt) : ""}
                </span>
              </div>
            ))}
            {hotspot.events.length > 3 && (
              <div className="text-[10px] text-slate-400 font-medium italic pl-1">
                ... 另有 {hotspot.events.length - 3} 个关联事件链路已归并入顶部信任锚点线
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. 原始来源链路归因（置于右下角极简低调胶囊，Hover 时高亮） */}
      {hotspot.supportingUrls && hotspot.supportingUrls.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 justify-end border-t border-slate-50 pt-3.5 select-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">原始归因链路:</span>
          {hotspot.supportingUrls.slice(0, 5).map((url, i) => {
            const label = getSourceDisplay(url);
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50/60 px-2.5 py-0.5 text-[10px] font-medium text-slate-400 hover:text-[var(--ember)] hover:border-[var(--ember)]/20 transition-all duration-200"
              >
                <span>{label}</span>
                <svg className="w-2.5 h-2.5 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })}
          {hotspot.supportingUrls.length > 5 && (
            <span className="text-[10px] text-slate-400 font-semibold bg-slate-100/50 px-1.5 py-0.5 rounded-full">
              +{hotspot.supportingUrls.length - 5} 更多
            </span>
          )}
        </div>
      )}
    </article>
  );
}

export default HotspotCard;
