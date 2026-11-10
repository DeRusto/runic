import { and, asc, eq } from "drizzle-orm";
import { db } from "./db.ts";
import { accounts, friends } from "./schema.ts";

/** The accounts on this account's friends list, in name order. */
export function friendsOf(accountId: number) {
  return db
    .select({ id: accounts.id, username: accounts.username })
    .from(friends)
    .innerJoin(accounts, eq(accounts.id, friends.friendId))
    .where(eq(friends.accountId, accountId))
    .orderBy(asc(accounts.usernameLower))
    .all();
}

/** The ids of the accounts that have this one on their friends list. */
export function friendedBy(friendId: number) {
  return new Set(
    db
      .select({ id: friends.accountId })
      .from(friends)
      .where(eq(friends.friendId, friendId))
      .all()
      .map(({ id }) => id),
  );
}

/** False if they were already on the list. */
export function addFriend(accountId: number, friendId: number) {
  return (
    db
      .insert(friends)
      .values({ accountId, friendId })
      .onConflictDoNothing()
      .run().changes > 0
  );
}

/** False if they were not on the list. */
export function removeFriend(accountId: number, friendId: number) {
  return (
    db
      .delete(friends)
      .where(
        and(eq(friends.accountId, accountId), eq(friends.friendId, friendId)),
      )
      .run().changes > 0
  );
}
