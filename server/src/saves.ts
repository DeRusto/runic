import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import { players } from "./schema.ts";

/** Columns with a default may be left out, and a save leaves alone any it doesn't name. */
export type PlayerSave = Omit<typeof players.$inferInsert, "accountId">;

export function readSave(accountId: number): PlayerSave | undefined {
  return db
    .select()
    .from(players)
    .where(eq(players.accountId, accountId))
    .get();
}

export function writeSave(accountId: number, save: PlayerSave) {
  db.insert(players)
    .values({ accountId, ...save })
    .onConflictDoUpdate({ target: players.accountId, set: save })
    .run();
}
