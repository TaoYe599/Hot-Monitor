#!/usr/bin/env python3
import argparse
import json
import os
import sys
import urllib.error
import urllib.request


DEFAULT_BASE_URL = os.environ.get("HOT_MONITOR_BASE_URL", "http://127.0.0.1:8787")


def request(path, method="GET", payload=None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        f"{DEFAULT_BASE_URL}{path}",
        data=data,
        method=method,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Request failed: {exc}") from exc


def csv_list(value):
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def add_common_monitor_args(parser):
    parser.add_argument("--name", required=True)
    parser.add_argument("--mode", choices=["keyword", "topic"], required=True)
    parser.add_argument("--query", required=True)
    parser.add_argument("--description", default="")
    parser.add_argument("--interval", type=int, default=15)
    parser.add_argument("--cooldown", type=int, default=60)
    parser.add_argument("--sources", default="twitter,search,rss,github")
    parser.add_argument("--channels", default="push,webhook,email")


def monitor_payload(args):
    sources = set(csv_list(args.sources))
    return {
        "name": args.name,
        "mode": args.mode,
        "query": args.query,
        "description": args.description,
        "intervalMinutes": args.interval,
        "cooldownMinutes": args.cooldown,
        "enabled": getattr(args, "enabled", True),
        "sources": {
            "twitter": "twitter" in sources,
            "search": "search" in sources,
            "rss": "rss" in sources,
            "github": "github" in sources,
        },
        "notifyChannels": csv_list(args.channels),
    }


def main():
    parser = argparse.ArgumentParser(description="Interact with a running Hot Monitor service.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health")
    subparsers.add_parser("dashboard")
    subparsers.add_parser("monitors")
    subparsers.add_parser("events")
    subparsers.add_parser("hotspots")

    create_monitor = subparsers.add_parser("create-monitor")
    add_common_monitor_args(create_monitor)

    update_monitor = subparsers.add_parser("update-monitor")
    update_monitor.add_argument("--id", type=int, required=True)
    add_common_monitor_args(update_monitor)
    update_monitor.add_argument("--disabled", action="store_true")

    run_monitor = subparsers.add_parser("run-monitor")
    run_monitor.add_argument("--id", type=int, required=True)

    update_settings = subparsers.add_parser("update-settings")
    update_settings.add_argument("--webhooks", default="")
    update_settings.add_argument("--emails", default="")
    update_settings.add_argument("--smtp-host")
    update_settings.add_argument("--smtp-port", type=int)
    update_settings.add_argument("--smtp-user")
    update_settings.add_argument("--smtp-password")
    update_settings.add_argument("--smtp-from")
    update_settings.add_argument("--smtp-secure", action="store_true")
    update_settings.add_argument("--vapid-public-key")
    update_settings.add_argument("--vapid-private-key")
    update_settings.add_argument("--vapid-subject")

    test_notification = subparsers.add_parser("test-notification")
    test_notification.add_argument("--channels", default="push,webhook,email")

    args = parser.parse_args()

    if args.command == "health":
        result = request("/api/health")
    elif args.command == "dashboard":
        result = request("/api/dashboard")
    elif args.command == "monitors":
        result = request("/api/monitors")
    elif args.command == "events":
        result = request("/api/events")
    elif args.command == "hotspots":
        result = request("/api/hotspots")
    elif args.command == "create-monitor":
        result = request("/api/monitors", method="POST", payload=monitor_payload(args))
    elif args.command == "update-monitor":
        payload = monitor_payload(args)
        payload["enabled"] = not args.disabled
        result = request(f"/api/monitors/{args.id}", method="PATCH", payload=payload)
    elif args.command == "run-monitor":
        result = request(f"/api/monitors/{args.id}/run", method="POST", payload={})
    elif args.command == "update-settings":
        result = request(
            "/api/settings",
            method="PATCH",
            payload={
                "webhookUrls": csv_list(args.webhooks),
                "emailTo": csv_list(args.emails),
                "smtpHost": args.smtp_host,
                "smtpPort": args.smtp_port,
                "smtpSecure": args.smtp_secure,
                "smtpUser": args.smtp_user,
                "smtpPassword": args.smtp_password,
                "smtpFrom": args.smtp_from,
                "vapidPublicKey": args.vapid_public_key,
                "vapidPrivateKey": args.vapid_private_key,
                "vapidSubject": args.vapid_subject,
            },
        )
    elif args.command == "test-notification":
        result = request(
            "/api/settings/test-notification",
            method="POST",
            payload={"channels": csv_list(args.channels)},
        )
    else:
        raise SystemExit(f"Unsupported command: {args.command}")

    json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
