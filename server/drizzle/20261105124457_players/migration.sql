CREATE TABLE `players` (
	`account_id` integer PRIMARY KEY,
	`combat_xp` integer NOT NULL,
	`defense_xp` integer NOT NULL,
	`foraging_xp` integer NOT NULL,
	`hitpoints_xp` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`health` integer NOT NULL,
	`inventory` text NOT NULL,
	CONSTRAINT `fk_players_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);
