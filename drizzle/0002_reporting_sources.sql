CREATE TABLE `source_posts` (
	`account_id` text NOT NULL,
	`post_id` text NOT NULL,
	`published_date` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `post_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_source_posts_date` ON `source_posts` (`account_id`,`published_date`);--> statement-breakpoint
CREATE TABLE `source_reports` (
	`account_id` text NOT NULL,
	`report_key` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`account_id`, `report_key`, `period_start`, `period_end`)
);
