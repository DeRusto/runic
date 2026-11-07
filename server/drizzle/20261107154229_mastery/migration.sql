ALTER TABLE `players` ADD `mastery_xp` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `mastery_hundredths` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- The one-time backfill: 7% of the experience held in the seven skills so far. SQLite divides integers as whole numbers.
UPDATE `players` SET
  `mastery_xp` = (`combat_xp` + `defense_xp` + `foraging_xp` + `hitpoints_xp` + `mining_xp` + `smithing_xp` + `blocking_xp`) * 7 / 100,
  `mastery_hundredths` = (`combat_xp` + `defense_xp` + `foraging_xp` + `hitpoints_xp` + `mining_xp` + `smithing_xp` + `blocking_xp`) * 7 % 100;
