# Hot Monitor

AI 领域热点监控服务，支持关键词精确监控与热点聚类发现。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、Vite 7、Tailwind CSS 4 |
| 后端 | Fastify 5、SQLite、Drizzle ORM |
| AI | OpenRouter (deepseek/deepseek-v4-flash) |
| 通知 | Web Push、Webhook、SMTP |
| 测试 | Vitest、Playwright |

## 环境准备

### 依赖

- Node.js >= 20
- pnpm >= 10 (`npm i -g pnpm`)
- Python >= 3.10 (用于 Skill 脚本)

### 安装依赖

```bash
pnpm install
```

## 配置

复制环境变量文件并填写配置：

```bash
cp .env.example .env
```

关键配置项说明：

| 变量 | 说明 | 必填 |
|------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API Key，用于 AI 判定 | 启用 AI 功能时必填 |
| `OPENROUTER_MODEL` | 模型名称，默认 `deepseek/deepseek-v4-flash` | 否 |
| `TWITTERAPI_IO_KEY` | Twitter API Key | 启用 Twitter 数据源时必填 |
| `WEBHOOK_URLS` | Webhook 地址，多个用逗号分隔 | 启用 Webhook 时必填 |
| `SMTP_*` | SMTP 邮件配置 | 启用邮件通知时必填 |
| `VAPID_*` | Web Push 配置 | 启用浏览器推送时必填 |
| `HOT_MONITOR_PORT` | 服务端口，默认 `8787` | 否 |

## 数据库初始化

```bash
pnpm db:generate   # 生成数据库迁移
pnpm db:migrate    # 执行迁移，创建表结构
```

数据库文件位于 `apps/server/data/hot-monitor.db`。

## 启动服务

### 开发模式（同时启动前端和后端）

```bash
pnpm dev
```

- 后端服务：`http://127.0.0.1:8787`
- 前端页面：`http://127.0.0.1:5255`

### 单独启动

```bash
# 仅后端
pnpm --filter @hot-monitor/server dev

# 仅前端
pnpm --filter @hot-monitor/web dev
```

## 构建生产版本

```bash
pnpm build
```

产物输出到：
- `apps/server/dist/` — 后端
- `apps/web/dist/` — 前端

## 其他命令

```bash
pnpm test           # 运行所有测试
pnpm test:api       # API 冒烟测试
pnpm typecheck      # 类型检查
```

## 项目结构

```
.
├── apps/
│   ├── server/          # Fastify 后端
│   │   ├── src/
│   │   │   ├── app.ts           # 路由注册
│   │   │   ├── index.ts         # 入口文件
│   │   │   ├── db/              # 数据库相关
│   │   │   └── services/        # 核心服务（采集器、调度器、AI、通知）
│   │   └── data/                # SQLite 数据目录
│   └── web/             # React 前端
│       └── src/
│           ├── app.tsx          # 路由和页面
│           └── lib/api.ts       # API 客户端
├── packages/
│   └── shared/         # 共享类型定义
├── skills/
│   └── hot-monitor/    # Codex Skill
│       └── scripts/
│           └── hot_monitor_client.py  # Python 客户端脚本
└── docs/
    └── implementation.md   # 实施文档
```

## Dashboard 统计指标

首页右上角的统计指标说明：

| 指标 | 含义 | 数据来源 |
|------|------|----------|
| **运行监控** | 当前已启用的监控任务数量 | monitors 表中 enabled = true 的记录数 |
| **有效命中** | 最近 12 条事件中已接受（accepted）的事件数量 | 最近 12 条 events 中 status = "accepted" 的记录数 |
| **热点簇** | 当前已聚合的热点簇数量 | 最近 8 个 hotspots 的数量 |
| **状态** | SSE 连接状态（booting/connected/disconnected） | 前端 WebSocket 连接状态 |

统计指标会在以下情况自动更新：
- 扫描任务完成时（通过 SSE 推送事件触发）
- 页面刷新时
