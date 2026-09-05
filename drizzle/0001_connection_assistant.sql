CREATE TABLE `connector_links` (
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`label` text NOT NULL,
	`snapshot` text,
	`auto_sync` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`owner`, `source`)
);
--> statement-breakpoint
CREATE TABLE `connector_vault` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner`, `kind`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`nonce_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` integer NOT NULL
);
