CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`stage` text DEFAULT 'queued' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`world_slug` text,
	`error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`alias` text NOT NULL,
	`selected_world` text NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`alias` text NOT NULL,
	`answer` text NOT NULL,
	`cluster_key` text DEFAULT 'unclassified' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`alias` text NOT NULL,
	`before_belief` text NOT NULL,
	`after_belief` text NOT NULL,
	`changed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`teacher_token` text NOT NULL,
	`question` text NOT NULL,
	`learning_objective` text NOT NULL,
	`canonical_model` text NOT NULL,
	`domain` text DEFAULT 'Physics' NOT NULL,
	`status` text DEFAULT 'collecting' NOT NULL,
	`world_slug` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_code_unique` ON `sessions` (`code`);--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`session_id` text,
	`manifest` text NOT NULL,
	`artifact_key` text,
	`source_model` text NOT NULL,
	`validation_status` text DEFAULT 'verified' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worlds_slug_unique` ON `worlds` (`slug`);