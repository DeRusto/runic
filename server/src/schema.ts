import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: integer().primaryKey({ autoIncrement: true }),
  username: text().notNull().unique(),
  usernameLower: text("username_lower").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  cutOff: integer("cut_off", { mode: "boolean" }).notNull().default(false),
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
});
