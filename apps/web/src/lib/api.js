export function splitLines(value) {
    return value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}
async function request(url, init) {
    const hasBody = init?.body !== undefined && init?.body !== null;
    const response = await fetch(url, {
        headers: hasBody
            ? {
                "Content-Type": "application/json",
                ...(init?.headers ?? {}),
            }
            : init?.headers,
        ...init,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(payload.message ?? "Request failed");
    }
    return response.json();
}
export const api = {
    getDashboard() {
        return request("/api/dashboard");
    },
    createMonitor(body) {
        return request("/api/monitors", {
            method: "POST",
            body: JSON.stringify(body),
        });
    },
    updateMonitor(id, body) {
        return request(`/api/monitors/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    },
    deleteMonitor(id) {
        return request(`/api/monitors/${id}`, {
            method: "DELETE",
        });
    },
    runMonitor(id) {
        return request(`/api/monitors/${id}/run`, {
            method: "POST",
            body: JSON.stringify({}),
        });
    },
    getScanJob(id) {
        return request(`/api/scan-jobs/${id}`);
    },
    listScanJobs() {
        return request("/api/scan-jobs");
    },
    updateSettings(body) {
        return request("/api/settings", {
            method: "PATCH",
            body: JSON.stringify(body),
        });
    },
    testNotification(channels) {
        return request("/api/settings/test-notification", {
            method: "POST",
            body: JSON.stringify({ channels }),
        });
    },
    savePushSubscription(body) {
        return request("/api/push/subscribe", {
            method: "POST",
            body: JSON.stringify(body),
        });
    },
};
