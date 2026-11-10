import { and, asc, eq } from "drizzle-orm";
import { db } from "./db.ts";
import { accounts, ignores } from "./schema.ts";

const pair = (accountId: number, ignoredId: number) =>
  and(eq(ignores.accountId, accountId), eq(ignores.ignoredId, ignoredId));

/** The usernames on this account's ignore list, in name order. */
export function ignoresOf(accountId: number) {
  return db
    .select({ username: accounts.username })
    .from(ignores)
    .innerJoin(accounts, eq(accounts.id, ignores.ignoredId))
    .where(eq(ignores.accountId, accountId))
    .orderBy(asc(accounts.usernameLower))
    .all()
    .map(({ username }) => username);
}

/** Whether `accountId` has `otherId` on their ignore list. */
export function isIgnoring(accountId: number, otherId: number) {
  return (
    db.select().from(ignores).where(pair(accountId, otherId)).get() !==
    undefined
  );
}

/** The ids of the accounts that have this one on their ignore list. */
export function ignoredBy(ignoredId: number) {
  return new Set(
    db
      .select({ id: ignores.accountId })
      .from(ignores)
      .where(eq(ignores.ignoredId, ignoredId))
      .all()
      .map(({ id }) => id),
  );
}

/** False if they were already on the list. */
export function addIgnore(accountId: number, ignoredId: number) {
  return (
    db
      .insert(ignores)
      .values({ accountId, ignoredId })
      .onConflictDoNothing()
      .run().changes > 0
  );
}

/** False if they were not on the list. */
export function removeIgnore(accountId: number, ignoredId: number) {
  return db.delete(ignores).where(pair(accountId, ignoredId)).run().changes > 0;
}
