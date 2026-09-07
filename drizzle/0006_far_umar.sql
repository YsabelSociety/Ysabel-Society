CREATE TABLE `refresh_jobs` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`origin` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
