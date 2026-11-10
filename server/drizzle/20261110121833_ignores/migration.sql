CREATE TABLE `ignores` (
	`account_id` integer NOT NULL,
	`ignored_id` integer NOT NULL,
	CONSTRAINT `ignores_pk` PRIMARY KEY(`account_id`, `ignored_id`),
	CONSTRAINT `fk_ignores_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`),
	CONSTRAINT `fk_ignores_ignored_id_accounts_id_fk` FOREIGN KEY (`ignored_id`) REFERENCES `accounts`(`id`)
);--> statement-breakpoint
CREATE INDEX `ignores_ignored_id_idx` ON `ignores` (`ignored_id`);