import { STARTING_PINNED_SKILLS } from "@runic/shared";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

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
  herblawXp: integer("herblaw_xp").notNull(),
  hitpointsXp: integer("hitpoints_xp").notNull(),
  x: integer().notNull(),
  y: integer().notNull(),
  health: integer().notNull(),
  inventory: text({ mode: "json" }).notNull().$type<string[]>(),
  // Every column below has a default, so a row from before them needs no conversion (spec D9).
  miningXp: integer("mining_xp").notNull().default(0),
  woodcuttingXp: integer("woodcutting_xp").notNull().default(0),
  fishingXp: integer("fishing_xp").notNull().default(0),
  cookingXp: integer("cooking_xp").notNull().default(0),
  firemakingXp: integer("firemaking_xp").notNull().default(0),
  craftingXp: integer("crafting_xp").notNull().default(0),
  fletchingXp: integer("fletching_xp").notNull().default(0),
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
  head: text().notNull().default(""),
  body: text().notNull().default(""),
  legs: text().notNull().default(""),
  hands: text().notNull().default(""),
  feet: text().notNull().default(""),
  cape: text().notNull().default(""),
  neck: text().notNull().default(""),
  ring: text().notNull().default(""),
  tools: text({ mode: "json" }).notNull().$type<string[]>().default([]),
  pinnedSkills: text("pinned_skills", { mode: "json" })
    .notNull()
    .$type<string[]>()
    .default(STARTING_PINNED_SKILLS),
  /** Like `inventory`, but `BANK_SLOTS` long once a player has logged in since the bank came (village spec §6). */
  bank: text({ mode: "json" }).notNull().$type<string[]>().default([]),
  /** Parallel to `bank`. */
  bankCounts: text("bank_counts", { mode: "json" })
    .notNull()
    .$type<number[]>()
    .default([]),
});

/**
 * One row per name on a player's list, `listedId` being the name's account. Adding is
 * one-sided, so the listed account gets no row back. `name: string`, not a literal, gives
 * both tables one type, so the code over them is written once.
 */
const socialList = (name: string, listedColumn: string) =>
  sqliteTable(
    name,
    {
      accountId: integer("account_id")
        .notNull()
        .references(() => accounts.id),
      listedId: integer(listedColumn)
        .notNull()
        .references(() => accounts.id),
    },
    // The key leads with accountId, so finding who lists an account needs its own index.
    (table) => [
      primaryKey({ columns: [table.accountId, table.listedId] }),
      index(`${name}_${listedColumn}_idx`).on(table.listedId),
    ],
  );

export const friends = socialList("friends", "friend_id");
/** Ignoring is silent too: the ignored player is never told. */
export const ignores = socialList("ignores", "ignored_id");
