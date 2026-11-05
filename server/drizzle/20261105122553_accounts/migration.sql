CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text NOT NULL UNIQUE,
	`username_lower` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`cut_off` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
