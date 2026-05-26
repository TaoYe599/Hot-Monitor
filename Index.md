# Hot-Monitor 项目地图

> AI 热点情报雷达系统 — 自动抓取多源热点信息，AI 判定真假，聚类分析，邮件通知

---

## 目录

- [项目架构](#项目架构)
- [apps/server 后端](#appsserver-后端)
- [apps/web 前端](#appsweb-前端)
- [packages/shared 共享类型](#packagesshared-共享类型)
- [模块依赖关系](#模块依赖关系)
- [环境变量](#环境变量)
- [项目特点](#项目特点)

---

## 项目架构

```
f:\Projects\Hot-Monitor\
├── apps/
│   ├── server/          # 后端服务 (Fastify API Server)
│   └── web/             # 前端应用 (React SPA)
├── packages/
│   └── shared/          # 共享类型定义
├── docs/                # 项目文档
├── skills/              # Cursor Skills
├── scripts/             # 辅助脚本
├── test/                # 测试相关
└── [配置文件]
```

### 技术栈

| 层次 | 技术 |
|------|------|
| **前端** | React 19 + TypeScript + TailwindCSS 4 + Vite + React Router 7 + PWA |
| **后端** | Node.js + Fastify 5 + TypeScript + Drizzle ORM + libSQL |
| **数据库** | SQLite (通过 libSQL) |
| **AI 服务** | OpenRouter API (支持多种 LLM 模型) |
| **通知服务** | SMTP (Nodemailer) |
| **包管理** | pnpm + Turborepo monorepo |
| **代理支持** | global-agent + proxy-agent (系统代理自动检测) |

---

## apps/server 后端

### 目录结构

```
apps/server/
├── src/
│   ├── index.ts           # 服务入口 (代理检测 + 启动)
│   ├── app.ts             # Fastify 应用构建 + 全部 API 路由
│   ├── config.ts          # 配置加载 (环境变量验证)
│   ├── types/
│   │   └── global-agent.d.ts
│   ├── db/
│   │   ├── client.ts      # 数据库连接 (libSQL)
│   │   ├── schema.ts      # Drizzle ORM 表定义
│   │   └── migrate.ts     # 数据库迁移脚本
│   ├── lib/
│   │   ├── event-bus.ts   # SSE 事件总线
│   │   └── utils.ts       # 工具函数
│   └── services/
│       ├── repositories.ts      # 数据访问层 (CRUD)
│       ├── sources.ts           # 多源数据采集服务
│       ├── ai-service.ts        # AI 分析服务 (OpenRouter)
│       ├── scan-runner.ts       # 扫描执行器
│       ├── scan-jobs.ts         # 扫描任务管理
│       ├── scheduler.ts          # 定时调度器
│       └── notification-service.ts # 邮件通知服务
├── data/                    # SQLite 数据库文件
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
└── drizzle.config.ts
```

### 核心服务

#### 1. SourceService (`sources.ts`)

多源数据采集，支持以下来源：

| 数据源 | 说明 | 配置文件 |
|--------|------|----------|
| **Twitter/X** | 通过 TwitterAPI.io 搜索，需配置 `TWITTERAPI_IO_KEY` | 质量过滤：点赞≥50、转发≥20 |
| **DuckDuckGo** | 网页搜索 + Google News RSS | 自动提取可读内容 |
| **官方博客 RSS** | OpenAI、HuggingFace、DeepMind 等 | `OFFICIAL_FEEDS` 配置 |
| **GitHub Releases** | 追踪 40+ 主流 AI 项目 | `GITHUB_RELEASE_FEEDS` 配置 |
| **Hacker News** | Algolia API 搜索 | 48 小时内高赞内容 |
| **知乎** | 热榜 API | 中文内容 |
| **百度搜索** | 抓取搜索结果 | 中文内容 |
| **Reddit** | r/MachineLearning、r/LocalLLaMA 等 | 热门帖 + 搜索 |

#### 2. AiService (`ai-service.ts`)

调用 OpenRouter API 进行 AI 分析：

| 功能 | 说明 |
|------|------|
| `verifyKeywordCandidate()` | 单条内容相关性+真实性判定 |
| `checkRelevance()` | 内容相关性分析 |
| `checkAuthenticity()` | 内容真实性验证 |
| `discoverHotspots()` | 热点聚类发现 |
| **降级机制** | AI 服务不可用时使用 Heuristic 启发式算法 |

#### 3. ScanRunner (`scan-runner.ts`)

执行监控扫描的核心逻辑：

```
候选采集 → 预过滤 → AI 验证 → 事件/热点创建 → 通知
```

**两种监控模式**：
- `keyword` (关键词模式)：直接创建命中事件
- `topic` (主题模式)：AI 聚类生成热点

#### 4. Scheduler (`scheduler.ts`)

定时调度器，30 秒轮询一次：

| 功能 | 说明 |
|------|------|
| 监控任务调度 | 根据 `intervalMinutes` 执行定时扫描 |
| 订阅定时简报 | Daily/Weekly Digest 生成 |
| 静默期管理 | 22:00-08:00 静默期，08:00 批量释放 |

#### 5. NotificationService (`notification-service.ts`)

邮件通知与订阅分流引擎：

| 功能 | 说明 |
|------|------|
| `notifyEvent()` | 关键词命中通知 |
| `notifyHotspot()` | 热点通知 + 订阅分流 |
| `dispatchSubscription()` | 核心订阅路由引擎 |
| `matchSubscriptionRule()` | 订阅规则匹配 |
| 发送模板 | 实时预警邮件、周期简报邮件 |

**订阅规则匹配逻辑**：
1. 监控任务白名单校验
2. 关键词三段逻辑 (OR/AND/NOT)
3. 热度分数阈值
4. 覆盖渠道数量
5. 信源可信度

### API 结构

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/dashboard` | GET | 仪表盘快照 |
| `/api/monitors` | GET/POST | 监控任务列表/创建 |
| `/api/monitors/:id` | PATCH/DELETE | 更新/删除监控 |
| `/api/monitors/:id/run` | POST | 手动触发扫描 |
| `/api/events` | GET | 事件列表 (支持排序/筛选) |
| `/api/hotspots` | GET | 热点列表 (分页) |
| `/api/scan-jobs` | GET | 扫描任务列表 |
| `/api/scan-jobs/:id` | GET/DELETE | 获取/取消任务 |
| `/api/settings` | GET/PATCH | 设置获取/更新 |
| `/api/settings/test-notification` | POST | 测试通知 |
| `/api/subscriptions` | GET/POST | 订阅规则列表/创建 |
| `/api/subscriptions/:id` | PATCH/DELETE | 更新/删除规则 |
| `/api/subscriptions/:id/test-notification` | POST | 测试订阅通知 |
| `/api/notifications/stats` | GET | 通知统计 |
| `/api/events/batch-read` | POST | 批量标记已读 |
| `/api/events/batch` | DELETE | 批量删除 |
| `/api/feedback` | GET | 用户反馈接口 (邮件内链接) |
| `/api/stream` | GET | SSE 实时事件流 |

### 数据库表结构

| 表名 | 说明 |
|------|------|
| `monitors` | 监控任务配置 |
| `events` | 命中的事件记录 |
| `hotspots` | 热点聚类 |
| `settings` | SMTP 等设置 |
| `notification_logs` | 通知发送日志 |
| `subscription_rules` | 订阅分流规则 |
| `subscription_cooldowns` | 订阅冷却期记录 |
| `subscription_silent_queue` | 静默期暂存队列 |

---

## apps/web 前端

### 目录结构

```
apps/web/
├── src/
│   ├── main.tsx           # React 入口
│   ├── app.tsx            # 主应用组件 (SPA 路由)
│   ├── styles.css         # TailwindCSS + CSS 变量
│   ├── sw.ts              # Service Worker (PWA)
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── FilterBar.tsx         # 事件/热点筛选栏
│   │   ├── EventCard.tsx         # 事件卡片
│   │   ├── EventBatchActions.tsx  # 批量操作
│   │   ├── EventsPanel.tsx       # 事件面板
│   │   ├── HotspotCard.tsx       # 热点卡片 (增强版)
│   │   ├── HotspotPanel.tsx      # 热点面板
│   │   ├── HotspotPagination.tsx # 分页组件
│   │   └── NotificationHealthDashboard.tsx # 健康看板
│   └── lib/
│       └── api.ts         # API 客户端
├── public/
│   └── favicon.svg
├── index.html
├── package.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
└── test/
    └── api.test.ts
```

### 页面路由

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | 总览页 | 仪表盘 + 事件列表 + 热点快照 + 扫描任务 |
| `/monitors` | 任务管理 | 监控任务 CRUD + 手动扫描触发 |
| `/hotspots` | 热点发现 | 分页热点列表 + 筛选排序 |
| `/settings` | 通知设置 | SMTP 配置 + 订阅规则管理 |

### 核心组件

#### FilterBar (`FilterBar.tsx`)
- 快捷时间筛选（全部/今日/本周）
- 排序选择器
- 高级筛选（监控任务、数据源、评分范围）
- localStorage 持久化用户偏好

#### HotspotCard (`HotspotCard.tsx`)
- 互动数据聚合展示
- 来源图标菜单
- 事件摘要列表
- 来源类型统计

#### NotificationHealthDashboard (`NotificationHealthDashboard.tsx`)
- 通知送达率统计
- 每日趋势图表
- 用户反馈噪音比

---

## packages/shared 共享类型

共享类型定义，被 server 和 web 共同引用：

```
packages/shared/src/index.ts
```

包含类型：
- `MonitorRecord` / `MonitorFormInput` - 监控任务类型
- `VerifiedEvent` - 验证后的事件
- `HotspotCluster` - 热点聚类
- `SourceItem` - 来源采集项
- `SubscriptionRuleRecord` / `SubscriptionRuleInput` - 订阅规则
- `SettingsRecord` / `SettingsFormInput` - 设置
- `NotificationStats` - 通知统计
- 排序/筛选类型定义

---

## 模块依赖关系

```
┌─────────────────────────────────────────────────────────┐
│                    apps/web (前端)                        │
│  React + TailwindCSS + Vite + React Router + PWA        │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP API / SSE
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  apps/server (后端)                       │
│     Fastify + Drizzle ORM + libSQL (SQLite)              │
└──────┬──────────┬──────────┬──────────┬────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────────────┐
│ Scheduler│ │Sources │ │ AI Service│ │Notification Svc │
│ (定时扫描)│ │(多源采集)│ │(OpenRouter)│ │(SMTP Email)   │
└──────────┘ └────────┘ └──────────┘ └──────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────┐
│                    Repository (DAL)                      │
│              数据库访问层 (Drizzle ORM)                   │
└─────────────────────┬───────────────────────────────────┘
                      │ SQL
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   SQLite Database                         │
│        (monitors/events/hotspots/settings/rules)        │
└─────────────────────────────────────────────────────────┘
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | - |
| `OPENROUTER_MODEL` | AI 模型 | `openai/gpt-4.1-mini` |
| `TWITTERAPI_IO_KEY` | Twitter API 密钥 | - |
| `SMTP_HOST` | SMTP 服务器 | - |
| `SMTP_PORT` | SMTP 端口 | - |
| `SMTP_USER` | SMTP 用户名 | - |
| `SMTP_PASS` | SMTP 密码 | - |
| `SMTP_FROM` | 发件人地址 | - |
| `HOT_MONITOR_PORT` | 服务端口 | `8787` |
| `HOT_MONITOR_DB_PATH` | 数据库路径 | `file:./apps/server/data/hot-monitor.db` |
| `PRE_FILTER_THRESHOLD` | 预过滤阈值 | `0.2` |
| `RELEVANCE_THRESHOLD` | 相关性阈值 | `0.4` |
| `AUTHENTICITY_THRESHOLD` | 真实性阈值 | `0.35` |

---

## 项目特点

1. **代理自动检测**：Windows 系统代理自动检测并配置
2. **AI 降级机制**：OpenRouter 不可用时自动切换 Heuristic 算法
3. **AI 宏微观双层分流**：事件级微观硬隔离与热点级宏观聚类的双重把关机制，实现最高程度的防噪音控制
4. **订阅智能路由**：多维度规则引擎 + 冷却期 + 静默期
5. **实时推送**：SSE 事件总线 + Service Worker PWA
6. **闭环反馈**：邮件内 👍/👎 用户反馈收集
7. **健康监控**：通知送达率 + 噪音比统计

---

## 🧠 核心机制：AI 宏微观双层研判分流设计

在系统的运行中，经常会出现**“有些热点簇（Cluster）下方挂载了丰富的关联事件（Events），而有些热点簇下方却没有关联事件”**的现象。这并不是 Bug，而是本系统所独创的**高纯度降噪分流设计**：

### 1. 微观事件把关（事件级过滤）
在第一阶段，AI (`verifyKeywordCandidate`) 针对每一个候选文章进行**微观审计**。只有当文章包含“新兴技术动态”、“真实事件驱动”或“实质性行业新闻”时，才会被判定为匹配（`isMatch = true`）并落库为 `Event`。
如果内容仅仅是“百科常识介绍”、“使用说明”或“陈旧科普”，微观研判会将其**强行拦截过滤**，不在数据库中为它创建任何事件，从源头上杜绝了背景噪音污染。

### 2. 宏观热点聚类（热点级提炼）
在第二阶段，AI (`discoverHotspots`) 从**宏观视角**对本次扫描到的所有候选内容（包括在第一关被微观拦截掉的科普文章）进行聚类。AI 仍然能感应到这些候选文章的共性，并在大局观上把它们归纳为一个基础常识热点簇。

### 3. 分流结果
当 AI 聚类提炼出了一个热点，但该热点所依托的全部支持文章在第一阶段微观研判时**全部因为“缺乏时效性与事件驱动”被拦截过滤了**（未落库生成 Event）：
* 最终该热点关联的事件 ID 列表长度为 0。
* 前端 UI 渲染时，该热点下便不会展示任何“关联事件”列表。
* 这极好地满足了：**宏观上不错过技术主题轮廓，微观上严格拦截低价值噪音文章，只为您呈现有干货支撑的高纯度情报。**

