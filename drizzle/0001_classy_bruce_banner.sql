CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`alias` text NOT NULL,
	`access_token` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_access_token_unique` ON `memberships` (`access_token`);