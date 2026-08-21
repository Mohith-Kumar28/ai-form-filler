-- Deleting an account must never be blocked by a billing failure.
--
-- The first cut of account deletion refused to proceed unless Dodo confirmed the subscription was
-- cancelled, and told the user to go and cancel it themselves first. That is the product handing
-- its own problem to somebody on their way out: they asked to be deleted, and got a chore and a
-- red error instead. Deletion now always completes.
--
-- Which leaves the thing the block was protecting against — a live subscription at Dodo whose
-- owner no longer exists and can no longer sign in to stop it. This table is where those land, so
-- the charge can be stopped by us instead of discovered by them on a statement.
--
-- Deliberately NOT keyed to `users`: the row it would reference is gone by the time anything is
-- written here, so a foreign key would make this table impossible to write to. It holds Dodo's own
-- identifiers and nothing about the person — no email, no name, no profile — which is what lets it
-- outlive a deletion without being a copy of what was deleted.
CREATE TABLE `abandoned_subscriptions` (
	`dodo_subscription_id` text PRIMARY KEY NOT NULL,
	`dodo_customer_id` text NOT NULL,
	-- Dodo's own refusal, verbatim. The whole point: the first version of this discarded the
	-- reason and reported a generic message, so a failure was unactionable — nobody could tell a
	-- wrong-environment id from an outage from a subscription Dodo had already ended.
	`last_error` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);--> statement-breakpoint

CREATE INDEX `abandoned_subscriptions_created_idx` ON `abandoned_subscriptions` (`created_at`);
