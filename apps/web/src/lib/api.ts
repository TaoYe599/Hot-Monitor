import type {
  DashboardSnapshot,
  EventFilter,
  EventSortConfig,
  HotspotFilter,
  HotspotSortConfig,
  MonitorFormInput,
  MonitorRecord,
  ScanJobRecord,
  SettingsFormInput,
  SettingsRecord,
  SubscriptionRuleRecord,
  SubscriptionRuleInput,
} from "@hot-monitor/shared";

export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
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
  cancelScanJob(id: string) {
    return request<{ ok: boolean }>(`/api/scan-jobs/${id}`, {
      method: "DELETE",
    });
  },
  updateSettings(body: SettingsFormInput) {
    return request<SettingsRecord>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  testNotification(channels: Array<"email">) {
    return request("/api/settings/test-notification", {
      method: "POST",
      body: JSON.stringify({ channels }),
    });
  },

  // ============== 排序和筛选 API ==============

  listEvents(params?: {
    sort?: EventSortConfig;
    filter?: EventFilter;
    limit?: number;
  }) {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.sort) {
      queryParams.sortField = params.sort.field;
      queryParams.sortOrder = params.sort.order;
    }
    if (params?.filter) {
      const f = params.filter;
      if (f.monitorId !== undefined) queryParams.monitorId = f.monitorId;
      if (f.sourceTypes && f.sourceTypes.length > 0) {
        queryParams.sourceTypes = f.sourceTypes.join(",");
      }
      if (f.minAuthenticityScore !== undefined) {
        queryParams.minAuthenticityScore = f.minAuthenticityScore;
      }
      if (f.minRelevanceScore !== undefined) {
        queryParams.minRelevanceScore = f.minRelevanceScore;
      }
      if (f.status) queryParams.status = f.status;
      if (f.timeRange) queryParams.timeRange = f.timeRange;
      if (f.timeFrom) queryParams.timeFrom = f.timeFrom;
      if (f.timeTo) queryParams.timeTo = f.timeTo;
    }
    if (params?.limit !== undefined) queryParams.limit = params.limit;

    const queryString = buildQueryString(queryParams);
    return request<import("@hot-monitor/shared").VerifiedEvent[]>(
      `/api/events${queryString}`,
    );
  },

  listHotspots(params?: {
    sort?: HotspotSortConfig;
    filter?: HotspotFilter;
    limit?: number;
    offset?: number;
  }) {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.sort) {
      queryParams.sortField = params.sort.field;
      queryParams.sortOrder = params.sort.order;
    }
    if (params?.filter) {
      const f = params.filter;
      if (f.monitorId !== undefined) queryParams.monitorId = f.monitorId;
      if (f.minScore !== undefined) queryParams.minScore = f.minScore;
      if (f.minCoverage !== undefined) queryParams.minCoverage = f.minCoverage;
      if (f.timeRange) queryParams.timeRange = f.timeRange;
      if (f.timeFrom) queryParams.timeFrom = f.timeFrom;
      if (f.timeTo) queryParams.timeTo = f.timeTo;
    }
    if (params?.limit !== undefined) queryParams.limit = params.limit;
    if (params?.offset !== undefined) queryParams.offset = params.offset;

    const queryString = buildQueryString(queryParams);
    return request<import("@hot-monitor/shared").HotspotsResponse>(
      `/api/hotspots${queryString}`,
    );
  },

  // ============== 批量操作 API ==============

  batchMarkEventsRead(eventIds: number[]) {
    return request<{ ok: boolean; count: number }>("/api/events/batch-read", {
      method: "POST",
      body: JSON.stringify({ eventIds }),
    });
  },

  batchDeleteEvents(eventIds: number[]) {
    return request<{ ok: boolean; count: number }>("/api/events/batch", {
      method: "DELETE",
      body: JSON.stringify({ eventIds }),
    });
  },

  listSubscriptionRules(): Promise<SubscriptionRuleRecord[]> {
    return request<SubscriptionRuleRecord[]>("/api/subscriptions");
  },
  createSubscriptionRule(body: SubscriptionRuleInput): Promise<SubscriptionRuleRecord> {
    return request<SubscriptionRuleRecord>("/api/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateSubscriptionRule(id: number, body: Partial<SubscriptionRuleInput>): Promise<SubscriptionRuleRecord> {
    return request<SubscriptionRuleRecord>(`/api/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  deleteSubscriptionRule(id: number): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/subscriptions/${id}`, {
      method: "DELETE",
    });
  },
  testSubscriptionRuleNotification(id: number): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/subscriptions/${id}/test-notification`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
