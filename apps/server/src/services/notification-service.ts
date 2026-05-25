import type {
  HotspotCluster,
  NotificationChannel,
  SettingsRecord,
  VerifiedEvent,
  SubscriptionRuleRecord,
  HotspotEventSummary,
} from "@hot-monitor/shared";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import type { AppConfig } from "../config.js";
import type { LiveEventBus } from "../lib/event-bus.js";
import type { Repository } from "./repositories.js";

interface NotificationEnvelope {
  title: string;
  body: string;
  url?: string;
  tag: string;
  type: "event" | "hotspot" | "test";
  payload: Record<string, unknown>;
}

function createTransporter(settings: SettingsRecord): Transporter | null {
  if (!settings.smtpHost || !settings.smtpPort || !settings.smtpFrom) {
    return null;
  }

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
    auth: settings.smtpUser && settings.smtpPassword
      ? {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      }
      : undefined,
  });
}

export class NotificationService {
  constructor(
    private readonly repository: Repository,
    private readonly config: AppConfig,
    private readonly bus: LiveEventBus,
  ) { }

  private async sendEmail(envelope: NotificationEnvelope, settings: SettingsRecord): Promise<void> {
    const transporter = createTransporter(settings);
    if (!transporter || settings.emailTo.length === 0 || !settings.smtpFrom) {
      return;
    }

    for (const target of settings.emailTo) {
      try {
        await transporter.sendMail({
          from: settings.smtpFrom,
          to: target,
          subject: envelope.title,
          text: `${envelope.body}\n\n${envelope.url ?? ""}`.trim(),
          html: `<strong>${envelope.title}</strong><p>${envelope.body}</p>${envelope.url ? `<p><a href="${envelope.url}">${envelope.url}</a></p>` : ""}`,
        });

        await this.repository.logNotification({
          channel: "email",
          target,
          payload: envelope.payload,
          status: "sent",
        });
      } catch (error) {
        await this.repository.logNotification({
          channel: "email",
          target,
          payload: envelope.payload,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // 通用自定义发信接口，支持向指定订阅人的邮箱路由
  async sendCustomEmail(
    recipients: string[],
    subject: string,
    htmlContent: string,
    settings: SettingsRecord,
    payload: Record<string, unknown>
  ): Promise<void> {
    const transporter = createTransporter(settings);
    if (!transporter || recipients.length === 0 || !settings.smtpFrom) {
      console.warn("[smtp] 无法生成发信通道，请确认 SMTP 服务配置或接收邮箱列表是否为空。");
      return;
    }

    for (const target of recipients) {
      try {
        await transporter.sendMail({
          from: settings.smtpFrom,
          to: target,
          subject,
          html: htmlContent,
        });

        await this.repository.logNotification({
          channel: "email",
          target,
          payload,
          status: "sent",
        });
      } catch (error) {
        console.error(`[smtp] 邮件投递失败，目标: ${target}`, error);
        await this.repository.logNotification({
          channel: "email",
          target,
          payload,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async dispatch(
    envelope: NotificationEnvelope,
    channels: NotificationChannel[],
  ): Promise<void> {
    const settings = await this.repository.getSettings();
    const tasks: Promise<void>[] = [];

    if (channels.includes("email")) tasks.push(this.sendEmail(envelope, settings));

    await Promise.all(tasks);
    this.bus.publish({
      type: "notification.sent",
      createdAt: new Date().toISOString(),
      payload: envelope.payload,
    });
  }



  // 重构系统热点通知入口：改写为调用订阅路由匹配引擎 (SubscriptionDispatchEngine)
  async notifyHotspot(
    hotspot: HotspotCluster,
    monitor: { name: string },
  ): Promise<void> {
    // 1. 保留原本的 SSE 事件总线消息发布，确保前端雷达盘实时同步接收
    this.bus.publish({
      type: "notification.sent",
      createdAt: new Date().toISOString(),
      payload: {
        kind: "hotspot",
        monitorName: monitor.name,
        hotspot,
      },
    });

    // 2. 调度智能订阅路由引擎进行精准分流推送
    await this.dispatchSubscription(hotspot);
  }

  async sendTestNotification(channels: NotificationChannel[]): Promise<void> {
    await this.dispatch(
      {
        title: "Hot Monitor 测试通知",
        body: "这是一条测试邮件，用于验证邮件通知链路。",
        tag: "test-notification",
        type: "test",
        payload: {
          kind: "test",
          sentAt: new Date().toISOString(),
        },
      },
      channels,
    );
  }

  // =========================================================================
  // 核心订阅分流引擎 (SubscriptionDispatchEngine)
  // =========================================================================

  async dispatchSubscription(hotspot: HotspotCluster): Promise<void> {
    const settings = await this.repository.getSettings();
    const rules = await this.repository.listSubscriptionRules();
    const activeRules = rules.filter((r) => r.enabled);

    for (const rule of activeRules) {
      try {
        const isMatched = await this.matchSubscriptionRule(hotspot, rule);
        if (!isMatched) {
          continue;
        }

        if (rule.deliveryFrequency === "instant") {
          // 实时推送分支
          const now = new Date();
          const hour = now.getHours();
          const isSilentPeriod = hour >= 22 || hour < 8; // 全局静默时间: 22:00 - 08:00

          if (isSilentPeriod && hotspot.score < 0.98) {
            // 静默期非特等强穿透热点，进行入队暂存
            console.info(`[静默队列] 热点 ${hotspot.id} 已进入订阅规则 ${rule.id} 的静默队列`);
            await this.repository.enqueueSilent(rule.id, hotspot.id);
            continue;
          }

          // 冷却期检查
          const cooldown = await this.repository.getSubscriptionCooldown(rule.id, hotspot.id);
          const nowMs = Date.now();
          const fourHoursMs = 4 * 60 * 60 * 1000; // 冷却间隔 4 小时

          if (!cooldown) {
            // 首次命中该规则，立即发信
            await this.sendInstantAlert(hotspot, rule, settings, false);
            await this.repository.setSubscriptionCooldown(rule.id, hotspot.id, hotspot.score);
          } else {
            const lastNotifiedTime = new Date(cooldown.lastNotifiedAt).getTime();
            const isInCooldown = (nowMs - lastNotifiedTime) < fourHoursMs;

            if (!isInCooldown) {
              // 冷却期过期，再次触发警报
              await this.sendInstantAlert(hotspot, rule, settings, false);
              await this.repository.updateSubscriptionCooldown(rule.id, hotspot.id, hotspot.score);
            } else {
              // 在冷却期内，做“重大追加演进”质变验证
              const isEvolution = await this.checkHotspotEvolution(hotspot, cooldown);
              if (isEvolution) {
                await this.sendInstantAlert(hotspot, rule, settings, true);
                await this.repository.updateSubscriptionCooldown(rule.id, hotspot.id, hotspot.score);
              } else {
                console.info(`[冷却拦截] 热点 ${hotspot.id} 由于处于 4h 冷却期内且未发生重大演进被拦截，防止骚扰。`);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[订阅匹配失败] 评估订阅规则 ${rule.name} (ID: ${rule.id}) 时抛出异常:`, err);
      }
    }
  }

  // 校验订阅规则的相交匹配逻辑
  async matchSubscriptionRule(hotspot: HotspotCluster, rule: SubscriptionRuleRecord): Promise<boolean> {
    // 1. 监控任务白名单校验
    if (rule.monitorIds && rule.monitorIds.length > 0) {
      if (!rule.monitorIds.includes(hotspot.monitorId)) {
        return false;
      }
    }

    // 2. 关键词与或非三段逻辑校验 (匹配标题 label + 情报摘要 summary)
    const matchText = `${hotspot.label} ${hotspot.summary}`.toLowerCase();

    // 排除关键词 (NOT) -> 只要命中任意一个排除词，立即强力拦截
    if (rule.excludeKeywords && rule.excludeKeywords.length > 0) {
      const isExcluded = rule.excludeKeywords.some(
        (kw) => kw && matchText.includes(kw.toLowerCase().trim())
      );
      if (isExcluded) return false;
    }

    // 包含任意关键词 (OR)
    if (rule.includeKeywords && rule.includeKeywords.length > 0) {
      const isIncluded = rule.includeKeywords.some(
        (kw) => kw && matchText.includes(kw.toLowerCase().trim())
      );
      if (!isIncluded) return false;
    }

    // 必须包含全部关键词 (AND)
    if (rule.andKeywords && rule.andKeywords.length > 0) {
      const allIncluded = rule.andKeywords.every(
        (kw) => kw && matchText.includes(kw.toLowerCase().trim())
      );
      if (!allIncluded) return false;
    }

    // 3. 综合推荐热度分数校验
    if (hotspot.score < rule.minScore) {
      return false;
    }

    // 4. 覆盖渠道数量过滤
    if (hotspot.supportingUrls.length < rule.minSupportingSources) {
      return false;
    }

    // 5. 校验信源可信度 (关联事件中的最大 authenticityScore 需达到规则设定的最低限度)
    const events = await this.repository.getEventsByClusterId(hotspot.id);
    const maxTrust = events.length > 0 ? Math.max(...events.map((e) => e.authenticityScore)) : 0.4;
    if (maxTrust < rule.minTrustScore) {
      return false;
    }

    return true;
  }

  // 重大演进质变判定
  private async checkHotspotEvolution(
    hotspot: HotspotCluster,
    cooldown: { score: number },
  ): Promise<boolean> {
    // 演进判定 1：当前综合分值大涨超过 0.15
    if (hotspot.score - cooldown.score >= 0.15) {
      return true;
    }

    // 演进判定 2：新增了可信度分值 >= 0.95 的官方权威机构公告
    const events = await this.repository.getEventsByClusterId(hotspot.id);
    const hasNewHighTrustEvent = events.some((e) => e.authenticityScore >= 0.95);
    if (hasNewHighTrustEvent) {
      return true;
    }

    return false;
  }

  // 发送单条热点实时预警邮件
  private async sendInstantAlert(
    hotspot: HotspotCluster,
    rule: SubscriptionRuleRecord,
    settings: SettingsRecord,
    isEvolution = false,
  ): Promise<void> {
    const heuristicPrefix = hotspot.isHeuristic ? "[Heuristic] " : "";
    const subject = isEvolution
      ? `[🚨 追加演进] ${heuristicPrefix}Hot Monitor 实时情报: ${hotspot.label} (${Math.round(hotspot.score * 100)}%)`
      : `[⚡ 实时预警] ${heuristicPrefix}Hot Monitor 重大发现: ${hotspot.label} (${Math.round(hotspot.score * 100)}%)`;

    // 获取关联事件以渲染真实可信度数据
    const events = await this.repository.getEventsByClusterId(hotspot.id);
    const htmlContent = this.renderInstantAlertEmail(hotspot, rule, isEvolution, events);

    await this.sendCustomEmail(
      rule.recipients,
      subject,
      htmlContent,
      settings,
      {
        kind: "subscription_instant",
        ruleId: rule.id,
        hotspotId: hotspot.id,
        isEvolution,
      }
    );
  }

  // 对单条订阅规则进行实时测试发信
  async sendTestSubscriptionNotification(ruleId: number): Promise<void> {
    const settings = await this.repository.getSettings();
    const rule = await this.repository.getSubscriptionRule(ruleId);
    if (!rule) {
      throw new Error(`订阅规则 (ID: ${ruleId}) 不存在`);
    }

    // Mock 一个精美的高热点簇数据
    const mockHotspot: HotspotCluster = {
      id: 9999,
      monitorId: 1,
      label: "DeepSeek-v4 启发式协同 MoE 开源，推理算力成本骤降 75%",
      summary: "大模型黑马 DeepSeek 刚刚宣布了其最新旗舰 DeepSeek-v4 开源计划。该模型首创启发式动态协同 MoE 路由架构，在逻辑、推理和多模态交互指标上持平 GPT-4o 的同时，训练与实际部署推理开销大跌 75%，并已提供了与主流 IDE 插件一键直连的 SDK，在全网引发极高热度讨论与技术追随。",
      score: 0.95,
      diversityScore: 0.88,
      freshnessScore: 1.0,
      engagementScore: 0.92,
      status: "notified",
      supportingUrls: [
        "https://openai.com/news/deepseek-v4-collaborative",
        "https://github.com/deepseek-ai/DeepSeek-V2",
      ],
      isHeuristic: false,
      createdAt: new Date().toISOString(),
    };

    const subject = `[⚡ 规则测试] Hot Monitor 发信正常: ${rule.name}`;
    // 测试邮件使用模拟的 mock 事件数据
    const mockEvents: import("@hot-monitor/shared").HotspotEventSummary[] = [
      {
        id: 1,
        title: "DeepSeek-v4 架构白皮书正式开源",
        sourceUrl: "https://openai.com/news/deepseek-v4-collaborative",
        sourceType: "rss",
        sourceLabel: "官方博客",
        author: null,
        publishedAt: null,
        authenticityScore: 0.95,
        relevanceScore: 0.9,
        engagementDetails: null,
      },
      {
        id: 2,
        title: "DeepSeek-V2 GitHub Repo",
        sourceUrl: "https://github.com/deepseek-ai/DeepSeek-V2",
        sourceType: "github",
        sourceLabel: "GitHub",
        author: null,
        publishedAt: null,
        authenticityScore: 0.88,
        relevanceScore: 0.85,
        engagementDetails: null,
      },
    ];
    const htmlContent = this.renderInstantAlertEmail(mockHotspot, rule, false, mockEvents);

    await this.sendCustomEmail(
      rule.recipients,
      subject,
      htmlContent,
      settings,
      {
        kind: "subscription_test",
        ruleId: rule.id,
      }
    );
  }

  /**
   * 唤醒并清空释放静默期积压的所有热点，按照订阅规则合并汇总发信
   */
  async releaseSilentQueue(): Promise<void> {
    console.info("[静默释放] 开始装箱释放免打扰静默期积压队列...");
    const settings = await this.repository.getSettings();
    const rules = await this.repository.listSubscriptionRules();
    const activeRules = rules.filter((r) => r.enabled);

    try {
      const silentItems = await this.repository.listSilentQueue();
      if (silentItems.length === 0) {
        console.info("[静默释放] 静默期队列为空，无需释放。");
        return;
      }

      // 按 ruleId 分组装箱
      const grouped = new Map<number, number[]>();
      for (const item of silentItems) {
        const list = grouped.get(item.ruleId) ?? [];
        list.push(item.hotspotId);
        grouped.set(item.ruleId, list);
      }

      for (const [ruleId, hotspotIds] of grouped.entries()) {
        const rule = activeRules.find((r) => r.id === ruleId);
        if (!rule) {
          // 规则已被停用或删除，直接清空对应的队列
          await this.repository.clearSilentQueue(ruleId);
          continue;
        }

        // 提取热点数据
        const hotspots = [];
        for (const hid of hotspotIds) {
          // 从数据库拉取具体热点
          const hotspotObj = await this.repository.getHotspot(hid);
          if (hotspotObj) {
            const events = await this.repository.getEventsByClusterId(hid);
            hotspots.push({ ...hotspotObj, events });
          }
        }

        if (hotspots.length > 0) {
          const subject = `[🌅 早报汇总] Hot Monitor 夜间重大预警合并: ${rule.name}`;
          const htmlContent = this.renderPeriodicDigestEmail(hotspots, rule, true);
          await this.sendCustomEmail(rule.recipients, subject, htmlContent, settings, {
            kind: "subscription_silent_release",
            ruleId: rule.id,
            count: hotspots.length,
          });
        }

        // 发送完毕，清空对应的静默记录
        await this.repository.clearSilentQueue(ruleId);
      }
      console.info("[静默释放] 积压队列清空与汇总邮件发送顺利完成。");
    } catch (err) {
      console.error("[静默释放] 自动释放静默期任务发生异常:", err);
      throw err;
    }
  }

  // =========================================================================
  // Apple 降级拟物 HTML 发送模板渲染器
  // =========================================================================

  private renderInstantAlertEmail(
    hotspot: HotspotCluster,
    rule: SubscriptionRuleRecord,
    isEvolution = false,
    events: import("@hot-monitor/shared").HotspotEventSummary[] = [],
  ): string {
    const feedbackBaseUrl = this.config.publicUrl || "http://127.0.0.1:8787";
    const settingsUrl = `${feedbackBaseUrl}/settings`;
    const yesFeedback = `${feedbackBaseUrl}/api/feedback?hotspotId=${hotspot.id}&ruleId=${rule.id}&verdict=relevant`;
    const noFeedback = `${feedbackBaseUrl}/api/feedback?hotspotId=${hotspot.id}&ruleId=${rule.id}&verdict=irrelevant`;
    const wrongCategoryFeedback = `${feedbackBaseUrl}/api/feedback?hotspotId=${hotspot.id}&ruleId=${rule.id}&verdict=wrong_category`;
    const highScoreFeedback = `${feedbackBaseUrl}/api/feedback?hotspotId=${hotspot.id}&ruleId=${rule.id}&verdict=score_too_high`;

    const scorePct = Math.round(hotspot.score * 100);
    const freshPct = Math.round(hotspot.freshnessScore * 100);
    const engagePct = Math.round(hotspot.engagementScore * 100);

    // 构建事件 URL 映射用于显示真实信任分
    const eventByUrl = new Map(events.map((e) => [e.sourceUrl, e]));

    // 信源列表渲染（使用真实可信度数据）
    const sourceRows = hotspot.supportingUrls.map((url, idx) => {
      const hostname = url.replace(/https?:\/\/(www\.)?/, "").split("/")[0];
      const event = eventByUrl.get(url);
      // 优先使用事件中的真实信任分，否则使用基于 URL 的启发式估算
      const trustScore = event ? Math.round(event.authenticityScore * 100) / 100 : (idx === 0 ? 0.95 : 0.88);
      let trustTag = "新闻资讯";
      if (trustScore >= 0.95) {
        trustTag = "官方机构";
      } else if (trustScore >= 0.8) {
        trustTag = "技术社区";
      } else if (trustScore >= 0.7) {
        trustTag = "社交媒体";
      }
      const isOfficial = trustScore >= 0.95;
      const sourceLabel = event?.sourceLabel || "";

      return `
                  <tr>
                    <td style="padding: 12px 16px; font-size: 13px; color: #475569; border-bottom: ${idx === hotspot.supportingUrls.length - 1 ? "none" : "1px solid rgba(8,17,31,0.06)"};">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            <a href="${url}" target="_blank" style="color: #08111f; font-weight: 600; text-decoration: none;">${hostname}</a>
                            ${sourceLabel ? `<span style="font-size: 10px; color: #64748b; margin-left: 6px;">[${sourceLabel}]</span>` : ""}
                            <span style="font-size: 10px; font-weight: 600; color: ${isOfficial ? "#10b981" : "#f59e0b"}; background-color: ${isOfficial ? "#ecfdf5" : "#fffbeb"}; padding: 2px 6px; border-radius: 12px; margin-left: 8px;">
                              ${trustTag} ${trustScore.toFixed(2)}
                            </span>
                          </td>
                          <td align="right">
                            <a href="${url}" target="_blank" style="color: #ef4444; font-weight: 600; text-decoration: none; font-size: 12px;">直达 &rarr;</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`;
    }).join("");

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hotspot.label}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- 容器外板，柔和阴影，模拟空气毛玻璃圆角 -->
        <table width="100%" max-width="640" style="max-width: 640px; background-color: #ffffff; border-radius: 20px; border: 1px solid rgba(8, 17, 31, 0.05); box-shadow: 0 8px 30px rgba(0,0,0,0.03); overflow: hidden; border-collapse: separate;" border="0" cellspacing="0" cellpadding="0">
          
          <!-- 页头 -->
          <tr>
            <td style="padding: 24px 30px; background-color: #ffffff; border-bottom: 1px solid rgba(8, 17, 31, 0.06);">
              ${hotspot.isHeuristic ? `
              <div style="margin-bottom: 12px; padding: 6px 12px; background-color: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; font-size: 11px; color: #92400e; font-weight: 600;">
                ⚠️ [Heuristic 模式降级生成] 因 AI 服务临时繁忙，本条摘要由系统根据最高可信度信源段落进行启发式提取，请酌情参考。
              </div>` : ""}
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <!-- 红色呼吸指示灯 -->
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${isEvolution ? "#e11d48" : "#ef4444"}; margin-right: 6px; vertical-align: middle;"></span>
                    <span style="font-size: 11px; font-weight: 700; color: #8f9ca9; letter-spacing: 0.2em; text-transform: uppercase; vertical-align: middle;">
                      ${isEvolution ? "追加重大演进" : "实时情报警报"}
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 500; color: #8f9ca9; background-color: #f4f6f8; padding: 4px 10px; border-radius: 20px;">
                      规则: ${rule.name}
                    </span>
                  </td>
                </tr>
              </table>
              <h2 style="margin: 16px 0 0 0; font-size: 20px; font-weight: 700; color: #08111f; line-height: 1.4; letter-spacing: -0.01em;">
                ${hotspot.label}
              </h2>
            </td>
          </tr>

          <!-- 指标环 -->
          <tr>
            <td style="padding: 20px 30px; background-color: #fafbfc; border-bottom: 1px solid rgba(8, 17, 31, 0.04);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%">
                    <div style="font-size: 11px; font-weight: 600; color: #8f9ca9; letter-spacing: 0.05em; text-transform: uppercase;">🔥 综合热度</div>
                    <div style="font-size: 18px; font-weight: 700; color: #ef4444; margin-top: 4px;">${scorePct}%</div>
                  </td>
                  <td width="33%">
                    <div style="font-size: 11px; font-weight: 600; color: #8f9ca9; letter-spacing: 0.05em; text-transform: uppercase;">⏰ 新鲜度</div>
                    <div style="font-size: 18px; font-weight: 700; color: #0284c7; margin-top: 4px;">${freshPct}%</div>
                  </td>
                  <td width="33%">
                    <div style="font-size: 11px; font-weight: 600; color: #8f9ca9; letter-spacing: 0.05em; text-transform: uppercase;">⚡ 交互度</div>
                    <div style="font-size: 18px; font-weight: 700; color: #7c3aed; margin-top: 4px;">${engagePct}%</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 核心情报卡片 -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #08111f; text-transform: uppercase; letter-spacing: 0.05em;">💡 AI 情报摘要</h3>
              <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.7; letter-spacing: 0.02em;">
                ${hotspot.summary}
              </p>
            </td>
          </tr>

          <!-- 支持信源列表 -->
          <tr>
            <td style="padding: 0 30px 30px 30px; background-color: #ffffff;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #08111f; text-transform: uppercase; letter-spacing: 0.05em;">🔗 可信链路与原著</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-radius: 12px; border: 1px solid rgba(8, 17, 31, 0.06); background-color: #fafbfc; overflow: hidden; border-collapse: separate;">
                ${sourceRows}
              </table>
            </td>
          </tr>

          <!-- 体验闭环负反馈 -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid rgba(8, 17, 31, 0.05); text-align: center;">
              <span style="font-size: 12px; font-weight: 600; color: #64748b; margin-right: 12px;">此情报对您:</span>
              <a href="${yesFeedback}" target="_blank" style="display: inline-block; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #10b981; border: 1px solid rgba(16,185,129,0.2); background-color: #ffffff; border-radius: 20px; text-decoration: none; margin-right: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);">👍 非常有用</a>
              <a href="${noFeedback}" target="_blank" style="display: inline-block; padding: 6px 14px; font-size: 12px; font-weight: 600; color: #64748b; border: 1px solid rgba(8,17,31,0.08); background-color: #ffffff; border-radius: 20px; text-decoration: none; margin-right: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);">👎 不太相关</a>
              <div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">
                或反馈: <a href="${wrongCategoryFeedback}" target="_blank" style="color: #64748b;">分类错误</a> · <a href="${highScoreFeedback}" target="_blank" style="color: #64748b;">分数过高</a>
              </div>
            </td>
          </tr>

          <!-- 页脚 -->
          <tr>
            <td style="padding: 20px 30px; background-color: #fafbfc; border-top: 1px solid rgba(8, 17, 31, 0.05); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                本通知由 <span style="font-weight: 600; color: #475569;">Hot-Monitor 智能热点情报分析系统</span> 自动调度生成与发送。<br>
                仅面向内部授权成员分发，请妥善保管。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  // 渲染周期简报 HTML 邮件模板
  renderPeriodicDigestEmail(
    hotspots: (HotspotCluster & { events: HotspotEventSummary[] })[],
    rule: SubscriptionRuleRecord,
    isNightSilent = false,
  ): string {
    const feedbackBaseUrl = this.config.publicUrl || "http://127.0.0.1:8787";
    const settingsUrl = `${feedbackBaseUrl}/settings`;

    const totalSources = hotspots.reduce((acc, h) => acc + h.supportingUrls.length, 0);

    // 对热点进行分值降序排列，做 TOP 3 高能排行榜
    const sortedHotspots = [...hotspots].sort((a, b) => b.score - a.score);
    const top3 = sortedHotspots.slice(0, 3);

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${rule.name} 每日简报</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="640" style="max-width: 640px; background-color: #ffffff; border-radius: 20px; border: 1px solid rgba(8, 17, 31, 0.05); box-shadow: 0 8px 30px rgba(0,0,0,0.03); overflow: hidden; border-collapse: separate;" border="0" cellspacing="0" cellpadding="0">
          
          <!-- 页头 -->
          <tr>
            <td style="padding: 24px 30px; background-color: #ffffff; border-bottom: 1px solid rgba(8, 17, 31, 0.06);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #0284c7; margin-right: 6px; vertical-align: middle;"></span>
                    <span style="font-size: 11px; font-weight: 700; color: #8f9ca9; letter-spacing: 0.2em; text-transform: uppercase; vertical-align: middle;">
                      ${isNightSilent ? "夜间静默汇总简报" : "每日情报简报"}
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 500; color: #0284c7; background-color: #e0f2fe; padding: 4px 10px; border-radius: 20px;">
                      周期订阅简报
                    </span>
                  </td>
                </tr>
              </table>
              <h2 style="margin: 16px 0 0 0; font-size: 22px; font-weight: 700; color: #08111f; line-height: 1.4; letter-spacing: -0.01em;">
                ${rule.name} 汇总洞察
              </h2>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">
                简报周期：过去 ${rule.deliveryFrequency === "weekly" ? "7 天" : "24 小时"}
              </p>
            </td>
          </tr>

          <!-- 洞察看板 -->
          <tr>
            <td style="padding: 20px 30px; background-color: #fafbfc; border-bottom: 1px solid rgba(8, 17, 31, 0.04);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
                      📊 <strong>本期情报速递</strong>：本期已为您自动匹配并深度聚合出 <span style="color: #ef4444; font-weight: 700;">${hotspots.length} 项</span> 核心情报热点，深度关联来自各大社交媒体、技术社区及官方博客的 <span style="color: #08111f; font-weight: 700;">${totalSources} 个</span> 可信原始信源。
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TOP 3 排行榜 -->
          ${top3.length > 0 ? `
          <tr>
            <td style="padding: 24px 30px 0 30px; background-color: #ffffff;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #08111f; text-transform: uppercase; letter-spacing: 0.05em;">🔥 本期高热度排行 (TOP 3)</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: separate;">
                ${top3.map((h, index) => {
      const colors = [
        "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)", // #1 Pink-Red
        "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)", // #2 Sky-Blue
        "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", // #3 Purple
      ];
      const textColors = ["#be123c", "#0369a1", "#6d28d9"];
      const targetUrl = h.events?.[0]?.sourceUrl || h.supportingUrls?.[0] || "#";
      
      // 动态获取首要信源的可信度指标及域名原始信任分数值
      const firstEvent = h.events?.[0];
      const trustScore = firstEvent ? firstEvent.authenticityScore : 0.88;
      let trustTag = "新闻资讯";
      if (trustScore >= 0.95) {
        trustTag = "官方机构";
      } else if (trustScore >= 0.8) {
        trustTag = "技术社区";
      } else if (trustScore >= 0.7) {
        trustTag = "社交媒体";
      }
      const tagColor = trustScore >= 0.95 ? "#10b981" : trustScore >= 0.8 ? "#0284c7" : trustScore >= 0.7 ? "#d97706" : "#64748b";
      const tagBg = trustScore >= 0.95 ? "#ecfdf5" : trustScore >= 0.8 ? "#e0f2fe" : trustScore >= 0.7 ? "#fef3c7" : "#f1f5f9";

      return `
                <tr>
                  <td style="padding: 14px 18px; margin-bottom: 10px; background: ${colors[index] || "#fafbfc"}; border-radius: 12px; border: 1px solid rgba(8,17,31,0.02); display: block;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="28" style="font-size: 18px; font-weight: 800; color: ${textColors[index] || "#475569"}; vertical-align: top; padding-top: 2px;">
                          #${index + 1}
                        </td>
                        <td style="font-size: 14px; font-weight: 700; color: #08111f; line-height: 1.4; vertical-align: top;">
                          <div>
                            <a href="${targetUrl}" target="_blank" style="color: #08111f; text-decoration: none; hover: underline;">${h.label}</a>
                            <span style="font-size: 9px; font-weight: 600; color: ${tagColor}; background-color: ${tagBg}; padding: 1px 5px; border-radius: 4px; margin-left: 6px; display: inline-block; vertical-align: middle;">
                              ${trustTag} ${trustScore.toFixed(2)}
                            </span>
                          </div>
                          <div style="font-size: 12px; font-weight: normal; color: #475569; margin-top: 6px; line-height: 1.5;">
                            ${h.summary}
                          </div>
                        </td>
                        <td width="60" align="right" style="font-size: 13px; font-weight: 700; color: ${textColors[index] || "#475569"}; vertical-align: top; padding-top: 2px;">
                          ${Math.round(h.score * 100)}% 热度
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`;
    }).join("")}
              </table>
            </td>
          </tr>` : ""}

          <!-- 详细主题卡片流 -->
          <tr>
            <td style="padding: 30px; background-color: #ffffff;">
              <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #08111f; text-transform: uppercase; letter-spacing: 0.05em;">📂 本期热点聚类详情</h3>
              
              ${hotspots.length === 0 ? `
                <div style="padding: 30px; text-align: center; border: 1px dashed rgba(8,17,31,0.12); border-radius: 16px; background-color: #fafbfc;">
                  <span style="font-size: 24px;">💡</span>
                  <p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">本时段未产生超出过滤条件的新热点信号。</p>
                </div>
              ` : hotspots.map((h, idx) => {
      const targetUrl = h.events?.[0]?.sourceUrl || h.supportingUrls?.[0] || "#";
      return `
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: ${idx === hotspots.length - 1 ? "0" : "24px"}; border-radius: 14px; border: 1px solid rgba(8, 17, 31, 0.06); background-color: #fafbfc; overflow: hidden; border-collapse: separate;">
                  <tr>
                    <td style="padding: 16px 20px; border-bottom: 1px solid rgba(8, 17, 31, 0.05); background-color: #ffffff;">
                      <table width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            <a href="${targetUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #08111f; text-decoration: none; hover: underline;">${h.label}</a>
                          </td>
                          <td align="right" width="100">
                            <span style="font-size: 11px; font-weight: 600; color: #ef4444; background-color: #fef2f2; padding: 2px 8px; border-radius: 12px; margin-right: 4px;">
                              热度 ${Math.round(h.score * 100)}%
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px; font-size: 13px; color: #475569; line-height: 1.6; background-color: #fafbfc;">
                      ${h.summary}
                      
                      <!-- 关联事件摘要 -->
                      ${h.events && h.events.length > 0 ? `
                      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(8,17,31,0.06);">
                        <div style="font-size: 11px; font-weight: 700; color: #8f9ca9; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em;">主要信源头条</div>
                        ${h.events.slice(0, 2).map(e => {
        const trustScore = e.authenticityScore;
        let trustTag = "新闻资讯";
        if (trustScore >= 0.95) {
          trustTag = "官方机构";
        } else if (trustScore >= 0.8) {
          trustTag = "技术社区";
        } else if (trustScore >= 0.7) {
          trustTag = "社交媒体";
        }
        const tagColor = trustScore >= 0.95 ? "#10b981" : trustScore >= 0.8 ? "#0284c7" : trustScore >= 0.7 ? "#d97706" : "#64748b";
        const tagBg = trustScore >= 0.95 ? "#ecfdf5" : trustScore >= 0.8 ? "#e0f2fe" : trustScore >= 0.7 ? "#fef3c7" : "#f1f5f9";
        return `
                        <div style="margin-bottom: 6px; font-size: 12px; color: #08111f;">
                          • <a href="${e.sourceUrl}" target="_blank" style="color: #475569; text-decoration: none; font-weight: 500; hover: underline;">${e.title}</a> 
                          <span style="font-size: 10px; color: #94a3b8; margin-left: 4px;">(${e.sourceLabel})</span>
                          <span style="font-size: 9px; font-weight: 600; color: ${tagColor}; background-color: ${tagBg}; padding: 1px 5px; border-radius: 4px; margin-left: 4px; display: inline-block; vertical-align: middle;">
                            ${trustTag} ${trustScore.toFixed(2)}
                          </span>
                        </div>`;
      }).join("")}
                      </div>
                      ` : ""}
                    </td>
                  </tr>
                </table>
              `;
    }).join("")}
            </td>
          </tr>

          <!-- 页脚 -->
          <tr>
            <td style="padding: 20px 30px; background-color: #fafbfc; border-top: 1px solid rgba(8, 17, 31, 0.05); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.6;">
                本通知由 <span style="font-weight: 600; color: #475569;">Hot-Monitor 智能热点情报分析系统</span> 自动调度生成与发送。<br>
                仅面向内部授权成员分发，请妥善保管。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }
}
