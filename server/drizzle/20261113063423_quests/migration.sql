ALTER TABLE `players` ADD `quests` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `quest_points` integer DEFAULT 0 NOT NULL;