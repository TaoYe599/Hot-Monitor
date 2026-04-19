import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            manifest: {
                name: "Hot Monitor",
                short_name: "HotMonitor",
                description: "AI 热点监控雷达台",
                theme_color: "#f06b38",
                background_color: "#f3efe7",
                display: "standalone",
                icons: [
                    {
                        src: "/favicon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                ],
            },
        }),
    ],
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8787",
            },
        },
    },
});
