import { STARTING_PINNED_SKILLS } from "@runic/shared";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  username: text().notNull().unique(),
  usernameLower: text("username_lower").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  cutOff: integer("cut_off", { mode: "boolean" }).notNull().default(false),
  /** A token carrying any other number was issued before the last password reset. */
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** One row per account that has ever been saved; no row means a new account. */
export const players = sqliteTable("players", {
  accountId: integer("account_id")
    .primaryKey()
    .references(() => accounts.id),
  combatXp: integer("combat_xp").notNull(),
  defenseXp: integer("defense_xp").notNull(),
  foragingXp: integer("foraging_xp").notNull(),
  hitpointsXp: integer("hitpoints_xp").notNull(),
  x: integer().notNull(),
  y: integer().notNull(),
  health: integer().notNull(),
  inventory: text({ mode: "json" }).notNull().$type<string[]>(),
  // Every column below has a default, so a row from before them needs no conversion (spec D9).
  miningXp: integer("mining_xp").notNull().default(0),
  smithingXp: integer("smithing_xp").notNull().default(0),
  blockingXp: integer("blocking_xp").notNull().default(0),
  masteryXp: integer("mastery_xp").notNull().default(0),
  /** The fraction of a point of Mastery not yet earned, so small gains add up. */
  masteryHundredths: integer("mastery_hundredths").notNull().default(0),
  /** Parallel to `inventory`. A filled slot with no count is a stack of 1. */
  inventoryCounts: text("inventory_counts", { mode: "json" })
    .notNull()
    .$type<number[]>()
    .default([]),
  weapon: text().notNull().default(""),
  shield: text().notNull().default(""),
  tools: text({ mode: "json" }).notNull().$type<string[]>().default([]),
  pinnedSkills: text("pinned_skills", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default(STARTING_PINNED_SKILLS),
});
