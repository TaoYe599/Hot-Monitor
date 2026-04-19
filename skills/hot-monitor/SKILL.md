---
name: hot-monitor
description: Operate a running Hot Monitor service to create or update monitor tasks, trigger scans, and inspect verified AI hotspots or notification settings. Use when another Codex instance needs to manage hotspot monitoring through HTTP instead of manually using the web UI.
---

# Hot Monitor

## Quick Start

- Confirm the local service is reachable before doing anything:
  - `python skills/hot-monitor/scripts/hot_monitor_client.py health`
- Read the current dashboard snapshot:
  - `python skills/hot-monitor/scripts/hot_monitor_client.py dashboard`
- Create a monitor:
  - `python skills/hot-monitor/scripts/hot_monitor_client.py create-monitor --name "OpenAI updates" --mode keyword --query "OpenAI GPT-5.4"`
- Trigger a scan:
  - `python skills/hot-monitor/scripts/hot_monitor_client.py run-monitor --id 1`

## Capabilities

### Create or update monitors
- Use `create-monitor` to add a new task.
- Use `update-monitor` when the user wants to enable, disable, retarget, or change intervals on an existing task.
- Prefer `keyword` mode for exact hits and `topic` mode for periodic hotspot discovery.

### Trigger scans and inspect results
- Use `run-monitor --id <id>` for an immediate scan.
- Use `events`, `hotspots`, or `dashboard` after a scan to summarize the latest verified results.
- When reporting results back to the user, prefer the structured JSON returned by the script and cite monitor ids, titles, scores, and source URLs.

### Update notification settings
- Use `update-settings` to manage webhook URLs, email recipients, SMTP fields, or VAPID keys.
- Use `test-notification` after changing notification settings to confirm the channel is wired correctly.

## Workflow

1. Check `health` or `dashboard` first.
2. If no suitable monitor exists, create one with `create-monitor`.
3. If the user wants a fresh answer now, run `run-monitor --id <id>`.
4. Read `events` or `hotspots`, then summarize the strongest signals.
5. When notifications are relevant, use `update-settings` and `test-notification`.

## Script Reference

- Base URL resolution:
  - Uses `HOT_MONITOR_BASE_URL` when set.
  - Otherwise defaults to `http://127.0.0.1:8787`.
- Main commands:
  - `health`
  - `dashboard`
  - `monitors`
  - `events`
  - `hotspots`
  - `create-monitor`
  - `update-monitor`
  - `run-monitor`
  - `update-settings`
  - `test-notification`

## Notes

- This skill does not implement monitoring logic itself; it always talks to the existing Hot Monitor service.
- If the service is down, tell the user that the Hot Monitor server must be started before the skill can operate.
