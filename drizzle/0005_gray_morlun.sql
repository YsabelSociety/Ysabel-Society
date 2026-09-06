CREATE TABLE `history_imports` (
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`payload` text NOT NULL,
	`lease` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `source`)
);
