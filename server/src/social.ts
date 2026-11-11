import type { Client } from "@colyseus/core";
import {
  FRIENDS_LIST,
  IGNORE_LIST,
  MAX_CHAT_LENGTH,
  PRIVATE_LINE,
  SOCIAL_LISTS,
  commandRefusal,
  followRefusal,
  listRefusal,
  pmRefusal,
  replyRefusal,
  unfollowRefusal,
  type Friend,
  type SocialList,
} from "@runic/shared";
import { accountNamed } from "./accounts.ts";
import type { Simulation } from "./simulation.ts";
import {
  addToList,
  isListed,
  listOf,
  listedBy,
  removeFromList,
} from "./socialLists.ts";

/** What the chat commands need from the room. */
export type World = {
  sim: Simulation;
  /** Every player in the world, the one definition of online: a dropped connection still counts, a login still waiting does not. */
  onlinePlayers(): Client[];
  /** Broadcasts a public chat line or an emote, as public chat does. */
  say(client: Client, text: string, emote: boolean): void;
};

/** A chat-box line for this client only. */
export const tell = (client: Client, line: string) =>
  client.send(PRIVATE_LINE, line);

export function sendFriends(world: World, client: Client) {
  const online = new Set(world.onlinePlayers().map((other) => other.auth.id));
  client.send(
    FRIENDS_LIST,
    listOf("friend", client.auth.id).map(({ id, username }): Friend => ({
      username,
      online: online.has(id),
    })),
  );
}

export const sendIgnores = (client: Client) =>
  client.send(
    IGNORE_LIST,
    listOf("ignore", client.auth.id).map(({ username }) => username),
  );

/** Tells everyone online who has this player on their friends list, and refreshes their lists. */
export function tellFriendedBy(world: World, client: Client, happened: string) {
  const friendedHere = listedBy("friend", client.auth.id);
  for (const other of world.onlinePlayers()) {
    if (!friendedHere.has(other.auth.id)) continue;
    tell(other, `${client.auth.username} has ${happened}`);
    sendFriends(world, other);
  }
}

/** Whether `accountId` has `otherId` on their ignore list. */
export const isIgnoring = (accountId: number, otherId: number) =>
  isListed("ignore", accountId, otherId);

/** The ids of the accounts that ignore this one. */
export const ignoredBy = (accountId: number) => listedBy("ignore", accountId);

/** Per login, the name of whoever's private message last reached that player. Never saved. */
const replyTo = new WeakMap<Client, string>();

const onlineNamed = (world: World, name: string) =>
  world
    .onlinePlayers()
    .find((other) => other.auth.username.toLowerCase() === name.toLowerCase());

const named = (client: Client, name: string) => {
  const account = name ? accountNamed(name) : undefined;
  return account && { ...account, self: account.id === client.auth.id };
};

/** What a list change means beyond the list itself. */
const AFTER_LIST_CHANGE: Record<
  SocialList,
  (world: World, client: Client, listedId: number, adding: boolean) => void
> = {
  friend: (world, client) => sendFriends(world, client),
  ignore: (world, client, listedId, adding) => {
    sendIgnores(client);
    if (!adding) return;
    if (removeFromList("friend", client.auth.id, listedId))
      sendFriends(world, client);
    // Ignore bars follow, so a follow already going ends too (Phase 4 map).
    for (const other of world.onlinePlayers()) {
      if (
        other.auth.id === listedId &&
        world.sim.following(other.sessionId) === client.sessionId
      )
        world.sim.unfollow(other.sessionId);
    }
  },
};

/** `/friend`, `/ignore` and their `/un…` commands. Silent: the named player is never told (Phase 4 map). */
const listCommand =
  (list: SocialList, adding: boolean) =>
  (world: World, client: Client, name: string) => {
    const account = named(client, name);
    const listed = !!account && isListed(list, client.auth.id, account.id);
    const refusal = listRefusal(list, adding, name, account, listed);
    if (refusal) return tell(client, refusal);
    if (!account) return;
    if (adding) addToList(list, client.auth.id, account.id);
    else removeFromList(list, client.auth.id, account.id);
    const now = adding ? "now on" : "no longer on";
    tell(client, `${account.username} is ${now} your ${SOCIAL_LISTS[list]}.`);
    AFTER_LIST_CHANGE[list](world, client, account.id, adding);
  };

/** Chat commands by lower-cased name; each gets the trimmed text after the name. */
const COMMANDS: Record<
  string,
  (world: World, client: Client, args: string) => void
> = {
  pm: (world, client, args) => {
    const [, name = "", message = ""] = args.match(/^(\S+)\s+(.+)$/s) ?? [];
    const to = name ? onlineNamed(world, name) : undefined;
    const refusal = pmRefusal(
      name,
      message,
      to && { username: to.auth.username, self: to.auth.id === client.auth.id },
    );
    if (refusal) return tell(client, refusal);
    if (!to) return;
    // The same limit as public chat, on the message alone.
    if (message.length > MAX_CHAT_LENGTH) return;
    // Silent: the sender still sees their own copy and no error (Phase 4 map).
    if (!isIgnoring(to.auth.id, client.auth.id)) {
      tell(to, `From ${client.auth.username}: ${message}`);
      replyTo.set(to, client.auth.username);
    }
    tell(client, `To ${to.auth.username}: ${message}`);
  },
  e: (world, client, text) => {
    if (!text) return tell(client, "Usage: /e <text>");
    world.say(client, text, true);
  },
  r: (world, client, message) => {
    const name = replyTo.get(client);
    const refusal = replyRefusal(name, message);
    if (refusal) return tell(client, refusal);
    COMMANDS.pm!(world, client, `${name} ${message}`);
  },
  friend: listCommand("friend", true),
  unfriend: listCommand("friend", false),
  ignore: listCommand("ignore", true),
  unignore: listCommand("ignore", false),
  // Silent: the target is never told (Phase 4 map). The walking is the simulation's.
  follow: (world, client, name) => {
    const account = named(client, name);
    const target = account && onlineNamed(world, name);
    const player = target && world.sim.state.players.get(target.sessionId);
    const refusal = followRefusal(
      name,
      account && {
        ...account,
        online: !!target,
        barred: !!player?.dead || isIgnoring(account.id, client.auth.id),
        alreadyFollowed:
          !!target &&
          world.sim.following(client.sessionId) === target.sessionId,
      },
    );
    if (refusal) return tell(client, refusal);
    if (!target) return;
    world.sim.follow(client.sessionId, target.sessionId);
  },
  unfollow: (world, client) => {
    const refusal = unfollowRefusal(!!world.sim.following(client.sessionId));
    if (refusal) return tell(client, refusal);
    world.sim.unfollow(client.sessionId);
  },
};

/** `line` is the chat line after its leading "/". */
export function runCommand(world: World, client: Client, line: string) {
  const [name = "", args = ""] = line.split(/\s+(.*)/s);
  const known = Object.hasOwn(COMMANDS, name.toLowerCase());
  const refusal = commandRefusal(name, known);
  if (refusal) return tell(client, refusal);
  COMMANDS[name.toLowerCase()]!(world, client, args.trim());
}
