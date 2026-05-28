# Hot-Monitor 生产环境打包与单进程合体部署指南

本指南旨在详细说明 `Hot-Monitor` 项目在生产环境下的打包构建、依赖提取、一键部署机制及常见问题排除。

---

## 一、 一体化运行机制原理 (合体单进程部署)

`Hot-Monitor` 采用 **前后端合体单进程运行** 的精妙设计，极大简化了生产环境部署的复杂度：
1. **静态资源自动挂载**：后端的 Fastify 框架中集成了 `@fastify/static` 插件。在启动时，如果检测到前端的构建产物目录 `apps/web/dist` 存在，后端服务器会自动将该目录挂载为 `/` 根路由静态服务。
2. **前端路由优雅回退**：Fastify 配置了未匹配路由的 404 处理机制。凡是除 `/api/` 之外的所有 404 请求，均会回退并读取返回 `apps/web/dist/index.html`。这为 React SPA（如 React Router 单页应用）提供了无缝的运行支持。
3. **数据库冷启动与自动迁移**：后端在引导时会自动连接 SQLite 并执行 Drizzle ORM 的 `migrateDatabase` 迁移。这意味着在生产机上，系统会在开机时自动冷启动建表并补齐字段，无需您在部署时手动运行迁移命令。

**核心结论**：您**无需**额外配置 nginx 等反向代理或单独启动前端服务。**仅需运行一个 Node.js 后端进程，即可同时向外提供完整的前端雷达盘与后端 API 支撑。**

---

## 二、 打包构建步骤 (Build Pipeline)

在执行全量打包前，请确保本地已配置好 Node.js >= 20，并使用 pnpm 包管理器。

### 1. 全量编译
在项目根目录下，执行以下打包编译命令：
```bash
pnpm build
```
该命令会自动完成整个 Monorepo 编译管道的级联构建：
- **第一步 (Shared)**：编译 `@hot-monitor/shared` 共享类库。
- **第二步 (Web)**：调用 Vite 压缩前端项目代码并引入 TailwindCSS 4 样式，全量产出在 `apps/web/dist/` 下，同时自动生成 PWA 离线 Service Worker。
- **第三步 (Server)**：使用 Tsc 编译后端 TypeScript 源码，产出 JavaScript 运行码部署在 `apps/server/dist/` 下。

---

## 三、 最小生产产物提取 (Production Artifacts)

当项目打包完成后，如需将系统传输至生产机部署，您**不需要**拷贝任何开发源码和类型检测工具，仅需提取以下最小生产运行集：

```
G:\Projects\Hot-Monitor\ [部署包根目录]
├── apps/
│   ├── server/
│   │   └── dist/              # 后端运行时 JS 编译代码
│   └── web/
│       └── dist/              # 前端静态托管 HTML/JS/CSS 产物
├── packages/
│   └── shared/                # 软链共享包的源码
├── package.json               # 根目录依赖管理
├── pnpm-workspace.yaml        # Monorepo 声明
├── pnpm-lock.yaml             # 锁定依赖树，加速安装
└── .env                       # 生产环境环境变量配置文件
```

在生产服务器的部署包根目录下，执行以下命令安装仅限于生产的最小依赖库：
```bash
pnpm install --prod
```

---

## 四、 生产环境 `.env` 配置最佳实践

在生产机的部署包根目录下创建或编辑 `.env` 文件。以下是核心配置项及防错指南：

### 1. 核心环境变量
```env
# 基础服务端口与外网访问基准地址（用于邮件内 👍/👎 反馈链路回传）
HOT_MONITOR_PORT=8787
HOT_MONITOR_PUBLIC_URL=http://your-domain.com:8787

# AI 研判密钥配置 (OpenRouter 或 小米 MiMo)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxx
OPENROUTER_MODEL=deepseek/deepseek-v4-flash

# SMTP 邮件发信服务器参数
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@qq.com
SMTP_PASSWORD=your-smtp-auth-code
SMTP_FROM=your-email@qq.com

# 物理 SQLite 数据库路径 (⚠️ 极其重要)
HOT_MONITOR_DB_PATH=file:C:/HotMonitor/data/hot-monitor.db
```

### 2. 数据库路径防错警告
> [!WARNING]
> **关于 `HOT_MONITOR_DB_PATH` 的定位陷阱**：
> 如果您在 `.env` 中使用相对路径（如默认的 `file:./apps/server/data/hot-monitor.db`），系统会相对于**当前 Node 进程启动时的 `process.cwd()`** 进行解析。
> - 在根目录下通过 `pnpm start` 启动时，数据库会被写在根目录下。
> - 若直接在 `apps/server` 目录下启动，则数据库文件会被错误嵌套地写在 `apps/server/apps/server/data/hot-monitor.db` 目录下。
> - **建议**：在生产环境中**强烈建议配置绝对路径**（例如 Linux 下的 `file:/var/lib/hot-monitor/data.db`，Windows 下的 `file:C:/HotMonitor/data/hot-monitor.db`），以此消除 cwd 变化所引发的数据库路径多份分裂、历史数据“凭空消失”或静默免打扰队列未被 08:00 定时释放的隐形 Bug。

---

## 五、 生产环境一键运行

我们在根目录的 `package.json` 中已集成了一键生产模式启动脚本：
```bash
pnpm start
```
该命令在后台本质上是执行了 `node apps/server/dist/index.js`。
服务启动后，您即可通过浏览器直接访问您在 `.env` 中指定的配置地址，完美使用 AI 情报雷达。

---

## 六、 常见部署与发信问题排除 (Troubleshooting)

### 1. 本地网络代理/VPN 劫持发信端口 (Unexpected socket close / ETIMEDOUT)
- **现象**：后台或邮件发送日志 `notification_logs` 中不断抛出 `Unexpected socket close` 或是连接外部发信服务器（如 `smtp.qq.com:587`）发生 `connect ETIMEDOUT 198.18.0.x`。
- **原因**：由于本地运行着 Clash 等代理软件的 **TUN 模式** 或 **系统代理**，发信所专用的纯 TCP 587/465 握手协议包被代理软件的网卡强行劫持（如进入 `198.18.0.x` Fake-IP 段）。但代理软件对其转发不当导致超时或被强制切断。
- **一键解法**：
  - **方法一**：在生产机上运行时，请彻底关闭本地代理软件的 **TUN 模式** 或 **系统代理**；
  - **方法二**：在代理软件的配置文件中，将您的 SMTP 域名（如 `smtp.qq.com`, `smtp.gmail.com`）明确配置在 `DIRECT`（直连）或 Bypass（绕过代理）黑名单中。

### 2. 邮件服务商频控超限 (Rate Limit)
- **现象**：通知日志报错 `Message submission rate for this client has exceeded the configured limit`。
- **原因**：短时间内频繁向外部发信触发了发信商频控安全锁。
- **解法**：系统已对发信通道进行了 To-Cc 合并抄送重构，如若仍旧触发，请适当微调订阅规则的匹配阈值，降低推送的频次。
