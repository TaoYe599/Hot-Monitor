import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4.1-mini"),
  OPENROUTER_SITE_URL: z.string().default("http://localhost:5173"),
  OPENROUTER_APP_NAME: z.string().default("Hot Monitor"),
  TWITTERAPI_IO_KEY: z.string().optional(),
  WEBHOOK_URLS: z.string().default(""),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  EMAIL_TO: z.string().default(""),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:hot-monitor@example.com"),
  HOT_MONITOR_PORT: z.coerce.number().default(8787),
  HOT_MONITOR_PUBLIC_URL: z.string().default("http://localhost:8787"),
  HOT_MONITOR_DB_PATH: z.string().default("file:./apps/server/data/hot-monitor.db"),
});

export interface AppConfig {
  openRouterApiKey?: string;
  openRouterModel: string;
  openRouterSiteUrl: string;
  openRouterAppName: string;
  twitterApiKey?: string;
  webhookUrls: string[];
  emailTo: string[];
  smtp: {
    host?: string;
    port?: number;
    secure: boolean;
    user?: string;
    password?: string;
    from?: string;
  };
  vapid: {
    publicKey?: string;
    privateKey?: string;
    subject: string;
  };
  port: number;
  publicUrl: string;
  databasePath: string;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadConfig(): AppConfig {
  const env = envSchema.parse(process.env);

  return {
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterModel: env.OPENROUTER_MODEL,
    openRouterSiteUrl: env.OPENROUTER_SITE_URL,
    openRouterAppName: env.OPENROUTER_APP_NAME,
    twitterApiKey: env.TWITTERAPI_IO_KEY,
    webhookUrls: splitCsv(env.WEBHOOK_URLS),
    emailTo: splitCsv(env.EMAIL_TO),
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    },
    port: env.HOT_MONITOR_PORT,
    publicUrl: env.HOT_MONITOR_PUBLIC_URL,
    databasePath: env.HOT_MONITOR_DB_PATH,
  };
}
