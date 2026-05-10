import type { HotspotCluster, NotificationChannel, SettingsRecord, VerifiedEvent } from "@hot-monitor/shared";
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
  ) {}

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
}
