CREATE TABLE `marketing_login_limits` (
	`key` text NOT NULL,
	`window` integer NOT NULL,
	`attempts` integer NOT NULL,
	PRIMARY KEY(`key`, `window`)
);
--> statement-breakpoint
CREATE TABLE `marketing_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
