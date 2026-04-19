在项目根目录 `G:\Projects\Hot-Monitor` 里运行：

```powershell
pnpm install
pnpm --filter @hot-monitor/server dev
```

默认后端会启动在 `http://localhost:8787`。如果你想让前端一起跑，用另一个终端执行：

```powershell
pnpm --filter @hot-monitor/web dev
```

如果你想用“后端托管已构建前端”的方式，先构建再启动：

```powershell
pnpm build
pnpm --filter @hot-monitor/server exec tsx src/index.ts
```

启动前建议先复制一份环境变量文件：

```powershell
Copy-Item .env.example .env
```

至少可以先不填密钥直接启动；只是没有 `OPENROUTER_API_KEY`、`TWITTERAPI_IO_KEY`、SMTP、VAPID 时，AI 识别和通知功能不会完整生效。