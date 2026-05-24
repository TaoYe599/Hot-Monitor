CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monitor_id` integer NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`original_excerpt` text,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`source_label` text NOT NULL,
	`author` text,
	`published_at` text,
	`authenticity_score` real NOT NULL,
	`relevance_score` real NOT NULL,
	`evidence` text NOT NULL,
	`cluster_id` integer,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`engagement_details` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_monitor_source_url_idx` ON `events` (`monitor_id`,`source_url`);--> statement-breakpoint
CREATE TABLE `hotspots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`monitor_id` integer NOT NULL,
	`label` text NOT NULL,
	`summary` text NOT NULL,
	`score` real NOT NULL,
	`diversity_score` real NOT NULL,
	`freshness_score` real NOT NULL,
	`engagement_score` real NOT NULL,
	`status` text NOT NULL,
	`supporting_urls` text NOT NULL,
	`reason` text,
	`engagement_aggregates` text,
	`earliest_published_at` text,
	`latest_published_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `monitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`query` text NOT NULL,
	`description` text,
	`interval_minutes` integer NOT NULL,
	`cooldown_minutes` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sources` text NOT NULL,
	`notify_channels` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_run_at` text
);
--> statement-breakpoint
CREATE TABLE `notification_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`target` text NOT NULL,
	`payload` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`email_to` text NOT NULL,
	`smtp_host` text,
	`smtp_port` integer,
	`smtp_secure` integer DEFAULT false NOT NULL,
	`smtp_user` text,
	`smtp_password` text,
	`smtp_from` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_cooldowns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`hotspot_id` integer NOT NULL,
	`last_notified_at` text NOT NULL,
	`score` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`monitor_ids` text,
	`include_keywords` text NOT NULL,
	`and_keywords` text NOT NULL,
	`exclude_keywords` text NOT NULL,
	`min_score` real DEFAULT 0.7 NOT NULL,
	`min_trust_score` real DEFAULT 0.55 NOT NULL,
	`min_supporting_sources` integer DEFAULT 1 NOT NULL,
	`delivery_frequency` text DEFAULT 'instant' NOT NULL,
	`delivery_time` text,
	`recipients` text NOT NULL,
	`last_dispatched_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscription_silent_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rule_id` integer NOT NULL,
	`hotspot_id` integer NOT NULL,
	`created_at` text NOT NULL
);
