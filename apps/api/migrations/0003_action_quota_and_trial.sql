-- Metering moves from forms per month to AI actions per month, and access moves from a free tier
-- to a 14-day trial of Pro.
--
-- `used` is reused rather than replaced: the column is still "how much of this period's allowance
-- is spent", only the unit changed. The rows are cleared for the current period because the old
-- numbers are counts of forms and would read as counts of actions — a user who filled 4 forms
-- would appear to have spent 4 of 600 actions, which is wrong in the generous direction but still
-- wrong. Past periods are left alone; nothing reads them.
DELETE FROM `quota_usage` WHERE `period` >= '2026-08';--> statement-breakpoint

ALTER TABLE `quota_usage` ADD `long_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Ours, not Dodo's. Dodo reports a trialing subscription as plain `active` and documents no field
-- that distinguishes one, so the conversion date is recorded when the trial checkout is created.
ALTER TABLE `subscriptions` ADD `trial_ends_at` integer;
