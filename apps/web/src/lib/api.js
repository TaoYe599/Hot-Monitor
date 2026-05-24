export function splitLines(value) {
    return value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function buildQueryString(params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
            searchParams.set(key, String(value));
        }
    }
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
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
    cancelScanJob(id) {
        return request(`/api/scan-jobs/${id}`, {
            method: "DELETE",
        });
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
    // ============== 排序和筛选 API ==============
    listEvents(params) {
        const queryParams = {};
        if (params?.sort) {
            queryParams.sortField = params.sort.field;
            queryParams.sortOrder = params.sort.order;
        }
        if (params?.filter) {
            const f = params.filter;
            if (f.monitorId !== undefined)
                queryParams.monitorId = f.monitorId;
            if (f.sourceTypes && f.sourceTypes.length > 0) {
                queryParams.sourceTypes = f.sourceTypes.join(",");
            }
            if (f.minAuthenticityScore !== undefined) {
                queryParams.minAuthenticityScore = f.minAuthenticityScore;
            }
            if (f.minRelevanceScore !== undefined) {
                queryParams.minRelevanceScore = f.minRelevanceScore;
            }
            if (f.status)
                queryParams.status = f.status;
            if (f.timeRange)
                queryParams.timeRange = f.timeRange;
            if (f.timeFrom)
                queryParams.timeFrom = f.timeFrom;
            if (f.timeTo)
                queryParams.timeTo = f.timeTo;
        }
        if (params?.limit !== undefined)
            queryParams.limit = params.limit;
        const queryString = buildQueryString(queryParams);
        return request(`/api/events${queryString}`);
    },
    listHotspots(params) {
        const queryParams = {};
        if (params?.sort) {
            queryParams.sortField = params.sort.field;
            queryParams.sortOrder = params.sort.order;
        }
        if (params?.filter) {
            const f = params.filter;
            if (f.monitorId !== undefined)
                queryParams.monitorId = f.monitorId;
            if (f.minScore !== undefined)
                queryParams.minScore = f.minScore;
            if (f.minCoverage !== undefined)
                queryParams.minCoverage = f.minCoverage;
            if (f.timeRange)
                queryParams.timeRange = f.timeRange;
            if (f.timeFrom)
                queryParams.timeFrom = f.timeFrom;
            if (f.timeTo)
                queryParams.timeTo = f.timeTo;
        }
        if (params?.limit !== undefined)
            queryParams.limit = params.limit;
        if (params?.offset !== undefined)
            queryParams.offset = params.offset;
        const queryString = buildQueryString(queryParams);
        return request(`/api/hotspots${queryString}`);
    },
    // ============== 批量操作 API ==============
    batchMarkEventsRead(eventIds) {
        return request("/api/events/batch-read", {
            method: "POST",
            body: JSON.stringify({ eventIds }),
        });
    },
    batchDeleteEvents(eventIds) {
        return request("/api/events/batch", {
            method: "DELETE",
            body: JSON.stringify({ eventIds }),
        });
    },
};
