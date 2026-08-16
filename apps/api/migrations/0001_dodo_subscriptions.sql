DROP TABLE `subscriptions`;

CREATE TABLE `subscriptions` (
  `user_id` text PRIMARY KEY NOT NULL,
  `dodo_customer_id` text NOT NULL,
  `dodo_subscription_id` text,
  `plan` text NOT NULL,
  `status` text NOT NULL,
  `on_hold_at` integer,
  `current_period_end` integer,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `subscriptions_dodo_customer_idx` ON `subscriptions` (`dodo_customer_id`);