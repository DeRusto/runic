CREATE TABLE `friends` (
	`account_id` integer NOT NULL,
	`friend_id` integer NOT NULL,
	CONSTRAINT `friends_pk` PRIMARY KEY(`account_id`, `friend_id`),
	CONSTRAINT `fk_friends_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`),
	CONSTRAINT `fk_friends_friend_id_accounts_id_fk` FOREIGN KEY (`friend_id`) REFERENCES `accounts`(`id`)
);--> statement-breakpoint
CREATE INDEX `friends_friend_id_idx` ON `friends` (`friend_id`);