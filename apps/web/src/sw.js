import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
// 检测到新版本时立即通知客户端
self.addEventListener("controllerchange", () => {
    // 通知所有客户端刷新页面
    self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((client) => {
            client.postMessage({ type: "SW_UPDATED" });
        });
    });
});
self.addEventListener("push", (event) => {
    const data = event.data?.json();
    event.waitUntil(self.registration.showNotification(data?.title ?? "Hot Monitor", {
        body: data?.body ?? "检测到新的热点信号。",
        icon: "/favicon.svg",
        badge: "/favicon.svg",
        tag: data?.tag ?? "hot-monitor-push",
        data: {
            url: data?.url ?? "/",
        },
    }));
});
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = String(event.notification.data?.url ?? "/");
    event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
            existing.postMessage({ type: "navigate", url: targetUrl });
            return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
    }));
});
