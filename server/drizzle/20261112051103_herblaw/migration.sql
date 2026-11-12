-- Foraging becomes Herblaw (#102): its experience moves over unchanged, with no Mastery share, and a pinned Foraging becomes a pinned Herblaw in the same slot.
-- Hand-edited from drizzle-kit's rebuild, which changes the pins column's default, so the rename and the pin swap ride on its copy.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`account_id` integer PRIMARY KEY,
	`combat_xp` integer NOT NULL,
	`defense_xp` integer NOT NULL,
	`herblaw_xp` integer NOT NULL,
	`hitpoints_xp` integer NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`health` integer NOT NULL,
	`inventory` text NOT NULL,
	`mining_xp` integer DEFAULT 0 NOT NULL,
	`smithing_xp` integer DEFAULT 0 NOT NULL,
	`blocking_xp` integer DEFAULT 0 NOT NULL,
	`mastery_xp` integer DEFAULT 0 NOT NULL,
	`mastery_hundredths` integer DEFAULT 0 NOT NULL,
	`inventory_counts` text DEFAULT '[]' NOT NULL,
	`weapon` text DEFAULT '' NOT NULL,
	`shield` text DEFAULT '' NOT NULL,
	`head` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`legs` text DEFAULT '' NOT NULL,
	`hands` text DEFAULT '' NOT NULL,
	`feet` text DEFAULT '' NOT NULL,
	`cape` text DEFAULT '' NOT NULL,
	`neck` text DEFAULT '' NOT NULL,
	`ring` text DEFAULT '' NOT NULL,
	`tools` text DEFAULT '[]' NOT NULL,
	`pinned_skills` text DEFAULT '["Combat","Defense","Herblaw","Hitpoints","Mining","Smithing"]' NOT NULL,
	`bank` text DEFAULT '[]' NOT NULL,
	`bank_counts` text DEFAULT '[]' NOT NULL,
	CONSTRAINT `fk_players_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_players`(`account_id`, `combat_xp`, `defense_xp`, `herblaw_xp`, `hitpoints_xp`, `x`, `y`, `health`, `inventory`, `mining_xp`, `smithing_xp`, `blocking_xp`, `mastery_xp`, `mastery_hundredths`, `inventory_counts`, `weapon`, `shield`, `head`, `body`, `legs`, `hands`, `feet`, `cape`, `neck`, `ring`, `tools`, `pinned_skills`, `bank`, `bank_counts`) SELECT `account_id`, `combat_xp`, `defense_xp`, `foraging_xp`, `hitpoints_xp`, `x`, `y`, `health`, `inventory`, `mining_xp`, `smithing_xp`, `blocking_xp`, `mastery_xp`, `mastery_hundredths`, `inventory_counts`, `weapon`, `shield`, `head`, `body`, `legs`, `hands`, `feet`, `cape`, `neck`, `ring`, `tools`, replace(`pinned_skills`, '"Foraging"', '"Herblaw"'), `bank`, `bank_counts` FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
