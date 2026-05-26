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

---

## 🧠 核心机制：AI 宏微观双层研判分流 (Double-Layer AI Verification)

在 Hot-Monitor 系统的热点发现面板中，您经常会观察到**“有些热点卡片下方列出了多个具体的关联事件，而有些热点卡片下方却是空白、没有关联事件”**的独特现象。

这并非系统 Bug，而是本雷达在设计上独创的**高纯度 AI 降噪分流机制**的直接体现：

```
                              ┌──────────────────────┐
                              │     预过滤候选池      │
                              └──────────┬───────────┘
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   ▼                                           ▼
      【微观审计（事件级过滤）】                  【宏观聚类（热点级提炼）】
      verifyKeywordCandidate()                    discoverHotspots()
   (逐条考核: 拒绝常识科普, 仅保留干货)             (全局观摩: 提炼抽象热点概念)
                   │                                           │
                   ▼                                           ▼
      ┌─────────────────────────┐                 ┌─────────────────────────┐
      │  落库为物理 Event 记录  │                 │  落库为物理 Hotspot 记录 │
      └────────────┬────────────┘                 └────────────┬────────────┘
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
                                【回填与物理绑定】
                             updateEventsClusterId()
                             (将 Event 关联至 Hotspot)
```

### 1. 为什么会出现“空关联事件”的热点？
* **宏观热点聚类**：AI 聚类（`discoverHotspots`）具有极强的概念归纳能力。在扫描时，如果抓取到多篇讨论“医院信息化基础概念”或“网络安全常规常识”的科普文章，AI 会从大局观上识别出这个技术主题，并提炼出一个热点簇（Cluster）。
* **微观事件拦截**：但与此同时，AI 微观研判（`verifyKeywordCandidate`）会对每一篇文章的干货价值进行微观把关。如果判定这些文章**仅仅是常识科普、百科介绍而缺乏实质性行业新兴动态**，AI 研判会将其**强行拦截过滤，绝不在数据库中为它们创建任何 Event 记录**。
* **分流结果**：因为所有的支撑候选文章在微观过滤那一关全被拒掉了，最终数据库中没有任何一条通过审核的 Event 与该热点绑定。所以在前端卡片上，该热点便会表现为**没有关联事件**。

### 2. 这种设计有什么好处？
* **宏微观兼顾，兼听则明**：在宏观上，您不会漏掉任何正在被行业热议的宏观话题轮廓（即使候选全是科普水文，也能汇聚成一个大主题呈现给您）。
* **严苛的噪音硬隔离**：在微观上，严格降噪。只有真正具备“事件属性”、高真实度与时效性的干货文章，才被允许生成事件呈现在卡片下方，从源头上杜绝了低价值背景噪音对您的打扰。

