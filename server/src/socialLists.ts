import type { SocialList } from "@runic/shared";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db.ts";
import { accounts, friends, ignores } from "./schema.ts";

const TABLES = { friend: friends, ignore: ignores } as const;

const pair = (list: SocialList, accountId: number, listedId: number) =>
  and(
    eq(TABLES[list].accountId, accountId),
    eq(TABLES[list].listedId, listedId),
  );

/** The accounts on this account's list, in name order. */
export function listOf(list: SocialList, accountId: number) {
  const table = TABLES[list];
  return db
    .select({ id: accounts.id, username: accounts.username })
    .from(table)
    .innerJoin(accounts, eq(accounts.id, table.listedId))
    .where(eq(table.accountId, accountId))
    .orderBy(asc(accounts.usernameLower))
    .all();
}

/** The ids of the accounts that have this one on their list. */
export function listedBy(list: SocialList, listedId: number) {
  const table = TABLES[list];
  return new Set(
    db
      .select({ id: table.accountId })
      .from(table)
      .where(eq(table.listedId, listedId))
      .all()
      .map(({ id }) => id),
  );
}

/** Whether `accountId` has `listedId` on their list. */
export function isListed(
  list: SocialList,
  accountId: number,
  listedId: number,
) {
  const table = TABLES[list];
  const row = db
    .select()
    .from(table)
    .where(pair(list, accountId, listedId))
    .get();
  return row !== undefined;
}

/** False if they were already on the list. */
export function addToList(
  list: SocialList,
  accountId: number,
  listedId: number,
) {
  return (
    db
      .insert(TABLES[list])
      .values({ accountId, listedId })
      .onConflictDoNothing()
      .run().changes > 0
  );
}

/** False if they were not on the list. */
export function removeFromList(
  list: SocialList,
  accountId: number,
  listedId: number,
) {
  return (
    db
      .delete(TABLES[list])
      .where(pair(list, accountId, listedId))
      .run().changes > 0
  );
}
