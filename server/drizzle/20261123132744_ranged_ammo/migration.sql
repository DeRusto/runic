ALTER TABLE `players` ADD `ranged_xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `ammo` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `weapon_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `ammo_count` integer DEFAULT 0 NOT NULL;