/** The two lists of other accounts a player keeps, by the chat command that adds to each. */
export const SOCIAL_LISTS = {
  friend: "friends list",
  ignore: "ignore list",
} as const;
export type SocialList = keyof typeof SOCIAL_LISTS;

/** The account a chat command names; each refusal takes undefined when there is none. */
export type NamedAccount = { username: string; self: boolean };

/** Why a chat command's name is unknown, or undefined for one the server has. */
export const commandRefusal = (name: string, known: boolean) =>
  known ? undefined : `Unknown command: /${name}`;

/** Why `/pm` sends nothing, or undefined. `to` is the online player named, if any. */
export function pmRefusal(
  name: string,
  message: string,
  to: NamedAccount | undefined,
): string | undefined {
  if (!name || !message) return "Usage: /pm <name> <message>";
  if (!to) return `${name} is not online.`;
  if (to.self) return "You can't send a private message to yourself.";
}

/** Why `/friend` or `/ignore` (or, when not `adding`, their `/un…` command) changes nothing, or undefined. */
export function listRefusal(
  list: SocialList,
  adding: boolean,
  name: string,
  account: NamedAccount | undefined,
  listed: boolean,
): string | undefined {
  if (!name) return `Usage: /${adding ? "" : "un"}${list} <name>`;
  if (!account) return `There is no account named ${name}.`;
  const where = `your ${SOCIAL_LISTS[list]}`;
  if (adding && account.self) return `You can't add yourself to ${where}.`;
  if (adding && listed) return `${account.username} is already on ${where}.`;
  if (!adding && !listed) return `${account.username} is not on ${where}.`;
}

/**
 * Why `/follow` starts nothing, or undefined. `barred` is a target who is dead or ignores the
 * follower: one generic sentence for both, so the follower can't tell they are ignored.
 */
export function followRefusal(
  name: string,
  target:
    | (NamedAccount & {
        online: boolean;
        barred: boolean;
        alreadyFollowed: boolean;
      })
    | undefined,
): string | undefined {
  if (!name) return "Usage: /follow <name>";
  if (!target) return `There is no account named ${name}.`;
  const { username } = target;
  if (target.self) return "You can't follow yourself.";
  if (!target.online) return `${username} is not online.`;
  if (target.barred) return `You can't follow ${username}.`;
  if (target.alreadyFollowed) return `You are already following ${username}.`;
}

/** Why `/unfollow` stops nothing, or undefined. */
export const unfollowRefusal = (following: boolean) =>
  following ? undefined : "You are not following anyone.";
