ALTER TABLE `players` ADD `mining_xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `smithing_xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `blocking_xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `inventory_counts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `weapon` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `shield` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `tools` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `pinned_skills` text DEFAULT '["Combat","Defense","Foraging","Hitpoints","Mining","Smithing"]' NOT NULL;