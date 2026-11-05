import { eq } from "drizzle-orm";
import { db } from "./db.ts";
import { players } from "./schema.ts";

export type PlayerSave = Omit<typeof players.$inferSelect, "accountId">;

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
