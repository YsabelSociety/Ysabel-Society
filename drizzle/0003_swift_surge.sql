CREATE TABLE `community_records` (
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`encrypted` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `source`, `kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_community_owner_kind_time` ON `community_records` (`owner`,`kind`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `community_sync` (
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`detail` text NOT NULL,
	`updated_at` text NOT NULL,
	`cursor` text,
	`account_id` text,
	`total` integer,
	PRIMARY KEY(`owner`, `source`, `kind`)
);
