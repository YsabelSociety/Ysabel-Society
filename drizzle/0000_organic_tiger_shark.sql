CREATE TABLE `platform_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`unit` text NOT NULL,
	`external_id` text NOT NULL,
	`enabled` integer DEFAULT 1,
	`last_sync` text,
	`status` text DEFAULT 'Disconnected' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_accounts_owner` ON `platform_accounts` (`owner`);--> statement-breakpoint
CREATE TABLE `annotations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`text` text NOT NULL,
	`unit` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `content_items` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_media_owner` ON `media_assets` (`owner`);--> statement-breakpoint
CREATE TABLE `account_metrics_daily` (
	`account_id` text NOT NULL,
	`date` text NOT NULL,
	`normalized` text NOT NULL,
	`source_metrics` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`message` text
);
--> statement-breakpoint
CREATE INDEX `idx_sync_owner` ON `sync_runs` (`owner`);