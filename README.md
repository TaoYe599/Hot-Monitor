# Hot Monitor

AI 领域热点监控服务，支持关键词精确监控与热点聚类发现。

## 技术栈

| 层级 | 技术 | 核心特征 |
|------|------|----------|
| **前端** | React 19、Vite 7、Tailwind CSS 4 | iOS 级系统拟物与毛玻璃高斯模糊微动画交互，基于“奥卡姆剃刀”原则的极简排版流 |
| **后端** | Fastify 5、SQLite、Drizzle ORM | 高性能异步调度服务，支持 Heuristic 启发式降级与 SSE 实时同步 |
| **AI** | OpenRouter (deepseek/deepseek-v4-flash) | 多模态与结构化 JSON Schema 聚类判别，自动化可信度与关键数据摘要提取 |
| **通知** | Web Push、Webhook、SMTP | 实时全端通知送达（支持事件的触发、高热点自动报警） |
| **测试** | Vitest、Playwright | 单元与端到端自动化健壮性验证 |

## UI/UX 核心美学与设计原则

Hot Monitor 前端交互与视觉设计深度借鉴了 **Apple 系统级设计语言**，打破了传统监控后台堆砌表单与硬边框的“教条感”，致力于提供**高信息密度、极低视觉疲劳**的无感监控体验。

### 1. 极致呼吸感的卡片流 (`HotSignalCard`)
- **空气感排版**：卡片抛弃了生硬的嵌套边框与复杂的背景色块，统一采用纯白或微空气感极浅灰（`border-radius: 16px`）底色，辅以极轻的环境投影（`box-shadow: 0 4px 24px rgba(0,0,0,0.02)`），依靠字体粗细与行间距的留白（`padding: 24px`）塑造视觉层级。
- **一键极简操作**：移除了传统的多级展开 Accordion Tab 结构，将“微型快捷复制（标题+主要信源）”与“一键直达原著”合并在卡片底层，确保无状态纯排版的干练。

### 2. 精致的高斯模糊悬浮窗 (`Popover Menu`)
- **毛玻璃视效**：所有的下拉和单选菜单（如：排序方式、任务过滤、分数过滤）均重构为具有 20px 高斯模糊（`backdrop-blur-[20px]`）与 85% 不透明白色的微悬浮窗（`SortDropdown` 和 `CustomSelect`）。
- **细腻交互微动效**：菜单带有一层 `border-white/40` 的高光描边和柔和大投影，选项 Hover 时背景底色柔和地划过一层极浅灰，选中的选项前优雅亮起高对比度品牌色（`var(--ember)`）圆点指示灯，交互流畅高级。
- **高级过滤呼吸指示器**：当“更多筛选”面板中有任意过滤项生效时，筛选按钮上会优雅地亮起一个**红色事件呼吸指示灯**（`animate-pulse`），对已选条件给予即时的视觉确立。

### 3. 渐进式信任锚点 (`Trust Anchor Line`)
- **信源微型下拉菜单**：卡片顶部的可信度背书与信源渠道完全收纳在紧凑的微型链条区。若有多条原著链接，点击图标组不会直接跳转，而是渐进式在图标下方弹出一个精致的高斯模糊微型悬浮菜单，让用户自由选择跳转路径，净化卡片的静态视觉干扰。

## 核心热点指标体系

系统彻底摒弃了冗余低效的“多样性”指标，将聚类分析后的指标精简至如下三个核心维度：

- **热点评分 (Score)**：利用大语言模型综合域名信任度（权重 40%）、互动热度分（权重 30%）与新鲜度衰减分（权重 30%）结构化计算得出的 0.0 - 1.0 的百分比数值。当 AI 故障时启用 Heuristic 启发式最大信任加权公式进行容灾防错。
- **新鲜度评分 (Freshness Score)**：事件创建时间距离当前时间的科学衰减曲线分数。随着时间流逝，新鲜度呈指数衰减，帮助用户第一波捕获“超新鲜爆料”。
- **互动热度评分 (Engagement Score)**：抓取各平台或社交管道原始的点赞、转发、浏览、评论等交互量，经由对数压缩算法与区间归一化转换而成。
- **覆盖规模 (Coverage)**：该热点簇包含的底层原始事件数与唯一数据源渠道数，越广的渠道覆盖说明事件在全网可信度越高。

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
    ├── implementation.md   # 实施文档
    └── data-sources.md     # 数据源与打分细节
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
