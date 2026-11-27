-- Combat splits into Attack and Strength (#88, melee rework spec §4): each takes a full copy of Combat's experience, with no Mastery share, and Combat's column goes.
-- A pinned Combat becomes a pinned Attack in the same place, with Strength beside it when the bar has room. Everyone starts in the Balanced stance.
-- Hand-edited from drizzle-kit's rebuild, which changes the pins column's default, so the copy and the pin swap ride on its copy.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_players` (
	`account_id` integer PRIMARY KEY,
	`attack_xp` integer DEFAULT 0 NOT NULL,
	`strength_xp` integer DEFAULT 0 NOT NULL,
	`defense_xp` integer NOT NULL,
	`herblaw_xp` integer NOT NULL,
	`hitpoints_xp` integer NOT NULL,
	`mining_xp` integer DEFAULT 0 NOT NULL,
	`smithing_xp` integer DEFAULT 0 NOT NULL,
	`woodcutting_xp` integer DEFAULT 0 NOT NULL,
	`fishing_xp` integer DEFAULT 0 NOT NULL,
	`cooking_xp` integer DEFAULT 0 NOT NULL,
	`firemaking_xp` integer DEFAULT 0 NOT NULL,
	`crafting_xp` integer DEFAULT 0 NOT NULL,
	`fletching_xp` integer DEFAULT 0 NOT NULL,
	`runecrafting_xp` integer DEFAULT 0 NOT NULL,
	`leatherworking_xp` integer DEFAULT 0 NOT NULL,
	`jewelsmithing_xp` integer DEFAULT 0 NOT NULL,
	`thieving_xp` integer DEFAULT 0 NOT NULL,
	`blocking_xp` integer DEFAULT 0 NOT NULL,
	`mastery_xp` integer DEFAULT 0 NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`health` integer NOT NULL,
	`inventory` text NOT NULL,
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
	`pinned_skills` text DEFAULT '["Attack","Strength","Defense","Herblaw","Hitpoints","Mining"]' NOT NULL,
	`bank` text DEFAULT '[]' NOT NULL,
	`bank_counts` text DEFAULT '[]' NOT NULL,
	`quests` text DEFAULT '{}' NOT NULL,
	`quest_points` integer DEFAULT 0 NOT NULL,
	`identifies_essence` integer DEFAULT false NOT NULL,
	`stance` text DEFAULT 'balanced' NOT NULL,
	CONSTRAINT `fk_players_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_players`(`account_id`, `attack_xp`, `strength_xp`, `defense_xp`, `herblaw_xp`, `hitpoints_xp`, `mining_xp`, `smithing_xp`, `woodcutting_xp`, `fishing_xp`, `cooking_xp`, `firemaking_xp`, `crafting_xp`, `fletching_xp`, `runecrafting_xp`, `leatherworking_xp`, `jewelsmithing_xp`, `thieving_xp`, `blocking_xp`, `mastery_xp`, `x`, `y`, `health`, `inventory`, `mastery_hundredths`, `inventory_counts`, `weapon`, `shield`, `head`, `body`, `legs`, `hands`, `feet`, `cape`, `neck`, `ring`, `tools`, `pinned_skills`, `bank`, `bank_counts`, `quests`, `quest_points`, `identifies_essence`) SELECT `account_id`, `combat_xp`, `combat_xp`, `defense_xp`, `herblaw_xp`, `hitpoints_xp`, `mining_xp`, `smithing_xp`, `woodcutting_xp`, `fishing_xp`, `cooking_xp`, `firemaking_xp`, `crafting_xp`, `fletching_xp`, `runecrafting_xp`, `leatherworking_xp`, `jewelsmithing_xp`, `thieving_xp`, `blocking_xp`, `mastery_xp`, `x`, `y`, `health`, `inventory`, `mastery_hundredths`, `inventory_counts`, `weapon`, `shield`, `head`, `body`, `legs`, `hands`, `feet`, `cape`, `neck`, `ring`, `tools`, CASE WHEN json_array_length(`pinned_skills`) < 6 THEN replace(`pinned_skills`, '"Combat"', '"Attack","Strength"') ELSE replace(`pinned_skills`, '"Combat"', '"Attack"') END, `bank`, `bank_counts`, `quests`, `quest_points`, `identifies_essence` FROM `players`;--> statement-breakpoint
DROP TABLE `players`;--> statement-breakpoint
ALTER TABLE `__new_players` RENAME TO `players`;--> statement-breakpoint
PRAGMA foreign_keys=ON;