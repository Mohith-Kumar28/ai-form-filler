CREATE TABLE `fill_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`origin` text NOT NULL,
	`adapter` text NOT NULL,
	`field_count` integer NOT NULL,
	`tier0_count` integer DEFAULT 0 NOT NULL,
	`tier1_count` integer DEFAULT 0 NOT NULL,
	`tier2_count` integer DEFAULT 0 NOT NULL,
	`tier3_count` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cache_read_tokens` integer DEFAULT 0 NOT NULL,
	`cache_write_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micro_usd` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`models` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `fill_log_user_idx` ON `fill_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `fill_log_created_idx` ON `fill_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `profile_docs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`doc` text NOT NULL,
	`hash` text NOT NULL,
	`structured_json` text DEFAULT '{}' NOT NULL,
	`estimated_tokens` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profile_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`memory_id` text,
	`r2_key` text,
	`media_type` text,
	`size_bytes` integer,
	`url` text,
	`extracted_text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `profile_sources_user_idx` ON `profile_sources` (`user_id`);--> statement-breakpoint
CREATE TABLE `quota_usage` (
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `period`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text,
	`status` text NOT NULL,
	`current_period_end` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subscriptions_customer_idx` ON `subscriptions` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_sub` text NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`avatar_url` text,
	`plan` text DEFAULT 'free' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_idx` ON `users` (`google_sub`);