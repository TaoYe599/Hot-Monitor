import type { HotspotCluster, NotificationChannel, SettingsRecord, VerifiedEvent } from "@hot-monitor/shared";
import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import webpush from "web-push";

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
  ) {}

  private async sendWebhook(envelope: NotificationEnvelope, settings: SettingsRecord): Promise<void> {
    for (const url of settings.webhookUrls) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(envelope.payload),
        });

        if (!response.ok) {
          throw new Error(`Webhook failed with status ${response.status}`);
        }

        await this.repository.logNotification({
          channel: "webhook",
          target: url,
          payload: envelope.payload,
          status: "sent",
        });
      } catch (error) {
        await this.repository.logNotification({
          channel: "webhook",
          target: url,
          payload: envelope.payload,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

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

  private async sendPush(envelope: NotificationEnvelope, settings: SettingsRecord): Promise<void> {
    if (!settings.vapidPublicKey || !settings.vapidPrivateKey) {
      return;
    }

    webpush.setVapidDetails(
      settings.vapidSubject ?? this.config.vapid.subject,
      settings.vapidPublicKey,
      settings.vapidPrivateKey,
    );

    const subscriptions = await this.repository.listPushSubscriptions();
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          JSON.stringify({
            title: envelope.title,
            body: envelope.body,
            url: envelope.url,
            tag: envelope.tag,
            type: envelope.type,
          }),
        );

        await this.repository.logNotification({
          channel: "push",
          target: subscription.endpoint,
          payload: envelope.payload,
          status: "sent",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("410") || message.includes("404")) {
          await this.repository.removePushSubscription(subscription.endpoint);
        }
        await this.repository.logNotification({
          channel: "push",
          target: subscription.endpoint,
          payload: envelope.payload,
          status: "failed",
          error: message,
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

    if (channels.includes("webhook")) tasks.push(this.sendWebhook(envelope, settings));
    if (channels.includes("email")) tasks.push(this.sendEmail(envelope, settings));
    if (channels.includes("push")) tasks.push(this.sendPush(envelope, settings));

    await Promise.all(tasks);
    this.bus.publish({
      type: "notification.sent",
      createdAt: new Date().toISOString(),
      payload: envelope.payload,
    });
  }

  async notifyEvent(event: VerifiedEvent, channels: NotificationChannel[]): Promise<void> {
    await this.dispatch(
      {
        title: `Hot Monitor 命中: ${event.title}`,
        body: event.summary,
        url: event.sourceUrl,
        tag: `event-${event.id}`,
        type: "event",
        payload: {
          kind: "event",
          event,
        },
      },
      channels,
    );
  }

  async notifyHotspot(
    hotspot: HotspotCluster,
    monitor: { name: string; notifyChannels: NotificationChannel[] },
  ): Promise<void> {
    await this.dispatch(
      {
        title: `Hot Monitor 热点: ${hotspot.label}`,
        body: hotspot.summary,
        tag: `hotspot-${hotspot.id}`,
        type: "hotspot",
        payload: {
          kind: "hotspot",
          monitorName: monitor.name,
          hotspot,
        },
      },
      monitor.notifyChannels,
    );
  }

  async sendTestNotification(channels: NotificationChannel[]): Promise<void> {
    await this.dispatch(
      {
        title: "Hot Monitor 测试通知",
        body: "这是一条测试消息，用于验证浏览器推送、Webhook 和邮件通知链路。",
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
}
