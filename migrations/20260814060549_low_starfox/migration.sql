CREATE TABLE `config` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`user_id` text PRIMARY KEY,
	`role_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`is_autorenew` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` text PRIMARY KEY,
	`points` integer DEFAULT 0 NOT NULL
);
