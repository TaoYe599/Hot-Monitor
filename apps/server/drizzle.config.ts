import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.HOT_MONITOR_DB_PATH ?? "file:./data/hot-monitor.db",
  },
});
