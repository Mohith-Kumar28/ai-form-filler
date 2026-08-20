CREATE TABLE `learned_pointers` (
	`user_id` text NOT NULL,
	`question_hash` text NOT NULL,
	`question` text NOT NULL,
	`memory_id` text,
	`answer_hash` text,
	`rejected_values` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `question_hash`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
