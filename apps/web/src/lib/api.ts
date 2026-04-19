import type {
  DashboardSnapshot,
  MonitorFormInput,
  MonitorRecord,
  ScanJobRecord,
  SettingsFormInput,
  SettingsRecord,
} from "@hot-monitor/shared";

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function request<TResponse>(url: string, init?: RequestInit): Promise<TResponse> {
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

  return response.json() as Promise<TResponse>;
}

export const api = {
  getDashboard(): Promise<DashboardSnapshot> {
    return request<DashboardSnapshot>("/api/dashboard");
  },
  createMonitor(body: MonitorFormInput) {
    return request<MonitorRecord>("/api/monitors", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateMonitor(id: number, body: Partial<MonitorFormInput>) {
    return request<MonitorRecord>(`/api/monitors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  deleteMonitor(id: number) {
    return request<{ ok: boolean }>(`/api/monitors/${id}`, {
      method: "DELETE",
    });
  },
  runMonitor(id: number) {
    return request<ScanJobRecord>(`/api/monitors/${id}/run`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  getScanJob(id: string) {
    return request<ScanJobRecord>(`/api/scan-jobs/${id}`);
  },
  listScanJobs() {
    return request<ScanJobRecord[]>("/api/scan-jobs");
  },
  updateSettings(body: SettingsFormInput) {
    return request<SettingsRecord>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  testNotification(channels: Array<"push" | "webhook" | "email">) {
    return request("/api/settings/test-notification", {
      method: "POST",
      body: JSON.stringify({ channels }),
    });
  },
  savePushSubscription(body: PushSubscriptionJSON) {
    return request("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
