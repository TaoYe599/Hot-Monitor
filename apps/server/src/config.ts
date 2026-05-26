import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import "dotenv/config";

import { z } from "zod";

const require = createRequire(import.meta.url);
const possibleEnvPaths = [
  resolve(process.cwd(), ".env"),
  resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    break;
  }
}

const envSchema = z.object({
  MIMO_API_KEY: z.string().optional(), // 小米 API Key 凭证（可选，用于主 AI 分析端点）
  MIMO_BASE_URL: z.string().default("https://api.xiaomimimo.com/v1"), // 小米 API 专属 Base URL
  MIMO_MODEL: z.string().default("MiMo-V2.5-Pro"), // 小米 API 调用的模型名称，默认 MiMo-V2.5-Pro
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4.1-mini"),
  OPENROUTER_SITE_URL: z.string().default("http://localhost:5173"),
  OPENROUTER_APP_NAME: z.string().default("Hot Monitor"),
  TWITTERAPI_IO_KEY: z.string().optional(),
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
  HOT_MONITOR_PORT: z.coerce.number().default(8787),
  HOT_MONITOR_PUBLIC_URL: z.string().default("http://localhost:8787"),
  HOT_MONITOR_DB_PATH: z.string().default("file:./apps/server/data/hot-monitor.db"),
  // 评分阈值配置
  PRE_FILTER_THRESHOLD: z.coerce.number().min(0).max(1).default(0.2),
  RELEVANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.4),
  AUTHENTICITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.35),
});

export interface AppConfig {
  mimoApiKey?: string; // 小米 API Key（降级流中作为首选）
  mimoBaseUrl: string; // 小米专属 Base URL
  mimoModel: string; // 小米模型名称
  openRouterApiKey?: string;
  openRouterModel: string;
  openRouterSiteUrl: string;
  openRouterAppName: string;
  twitterApiKey?: string;
  emailTo: string[];
  smtp: {
    host?: string;
    port?: number;
    secure: boolean;
    user?: string;
    password?: string;
    from?: string;
  };
  port: number;
  publicUrl: string;
  databasePath: string;
  thresholds: {
    preFilter: number;
    relevance: number;
    authenticity: number;
  };
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
    mimoApiKey: env.MIMO_API_KEY,
    mimoBaseUrl: env.MIMO_BASE_URL,
    mimoModel: env.MIMO_MODEL,
    openRouterApiKey: env.OPENROUTER_API_KEY,
    openRouterModel: env.OPENROUTER_MODEL,
    openRouterSiteUrl: env.OPENROUTER_SITE_URL,
    openRouterAppName: env.OPENROUTER_APP_NAME,
    twitterApiKey: env.TWITTERAPI_IO_KEY,
    emailTo: splitCsv(env.EMAIL_TO),
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    port: env.HOT_MONITOR_PORT,
    publicUrl: env.HOT_MONITOR_PUBLIC_URL,
    databasePath: env.HOT_MONITOR_DB_PATH,
    thresholds: {
      preFilter: env.PRE_FILTER_THRESHOLD,
      relevance: env.RELEVANCE_THRESHOLD,
      authenticity: env.AUTHENTICITY_THRESHOLD,
    },
  };
}
