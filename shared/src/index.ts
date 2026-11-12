import type { GatheringSkill, GatheringVerb } from "./gathering.ts";
import type { VillagerId } from "./dialogue.ts";
import type { ItemId } from "./items.ts";
import type { StationKind } from "./region.ts";

export const SERVER_PORT = 2567;
export const WORLD_ROOM = "world";

/** The walk intent's message type; its payload is the clicked Tile. */
export const WALK_INTENT = "walk";
/** The target intent's message type; its payload is the clicked enemy's id in state. */
export const TARGET_INTENT = "target";
/** The make intent's message type; its payload is `{ item, all }`, with `all` false for Make 1. */
export const MAKE_INTENT = "make";
/**
 * The visit intent's message type, for clicking a villager; its payload is `{ villager, then }`.
 * Arriving opens the conversation, or with `then`, a `DialogueAction` the conversation offers, runs that instead.
 */
export const VISIT_INTENT = "visit";
/** The choose intent's message type; its payload is the picked choice's index among the conversation's current choices. */
export const CHOOSE_INTENT = "choose";
/** The end talk intent's message type, for closing a conversation; it has no payload. */
export const END_TALK_INTENT = "endTalk";
/** The deal intent's message type, for the store window's Deal button; its payload is a `Deal`. */
export const DEAL_INTENT = "deal";
/** The close store intent's message type, for closing the store window; it has no payload. */
export const CLOSE_STORE_INTENT = "closeStore";
/** The eat intent's message type; its payload is the clicked inventory slot's index. */
export const EAT_INTENT = "eat";
/** The drop intent's message type; its payload is `{ slot, amount }`, and an amount over the stack drops it all. */
export const DROP_INTENT = "drop";
/** The move intent's message type, for a drag in the inventory; its payload is `{ from, to }`, two slots' indexes. */
export const MOVE_INTENT = "move";
/** The deposit intent's message type; its payload is `{ slot, amount }` for an inventory slot, and an amount over the stack deposits it all. */
export const DEPOSIT_INTENT = "deposit";
/** The withdraw intent's message type; its payload is `{ slot, amount }` for a bank slot, and the server takes as many as fit. */
export const WITHDRAW_INTENT = "withdraw";
/** The deposit inventory intent's message type; it has no payload. */
export const DEPOSIT_INVENTORY_INTENT = "depositInventory";
/** The bank move intent's message type, for a drag in the bank; its payload is `{ from, to }`, two bank slots' indexes. */
export const BANK_MOVE_INTENT = "bankMove";
/** The close bank intent's message type; it has no payload. */
export const CLOSE_BANK_INTENT = "closeBank";
/** The take intent's message type; its payload is the ground item's id. */
export const TAKE_INTENT = "take";
/** The equip intent's message type; its payload is the inventory slot's index. */
export const EQUIP_INTENT = "equip";
/** The take off intent's message type; its payload is the `GearSlot`. */
export const TAKE_OFF_INTENT = "takeOff";
/** The pin intent's message type; its payload is `{ skill, pinned }`, with `pinned` false to unpin. */
export const PIN_INTENT = "pin";
/** The log out intent's message type; it has no payload. */
export const LOGOUT_INTENT = "logout";
/** The chat intent's message type, payload the line; the server broadcasts a `ChatLine` under it too. */
export const CHAT = "chat";
export const MAX_CHAT_LENGTH = 120;
/** How long a chat line stays over the speaker's head. */
export const CHAT_OVERHEAD_MS = 3000;
/** `emote` marks a line from `/e`, which reads `<username> <text>` in bold. */
export type ChatLine = {
  id: string;
  username: string;
  text: string;
  emote: boolean;
};
/** A chat-box line the server sends to one player only, payload the finished line: a private message or a chat command's error. */
export const PRIVATE_LINE = "privateLine";
/** The longest username an account can have. */
export const MAX_USERNAME_LENGTH = 12;
/** The longest chat command line: `/pm`, the longest username and a full-length message. */
export const MAX_CHAT_LINE_LENGTH =
  "/pm ".length + MAX_USERNAME_LENGTH + " ".length + MAX_CHAT_LENGTH;
/** A player asks for their friends list, with no payload. The server answers with `FRIENDS_LIST`. */
export const LIST_FRIENDS_INTENT = "listFriends";
/** The server sends a player their whole `Friend[]` in name order when asked, and whenever it or a friend's status changes. */
export const FRIENDS_LIST = "friendsList";
export type Friend = { username: string; online: boolean };
/** A player asks for their ignore list, with no payload. The server answers with `IGNORE_LIST`. */
export const LIST_IGNORES_INTENT = "listIgnores";
/** The server sends a player the usernames on their ignore list in name order when asked, and whenever it changes. */
export const IGNORE_LIST = "ignoreList";

/** Closes the old connection when the same account logs in again. */
export const TAKEN_OVER_CLOSE_CODE = 4011;

export const INVENTORY_SLOTS = 30;
/** An inventory slot with no item in it. */
export const EMPTY_SLOT = "";
/** Level 10; every other skill starts at 0 XP, level 1 (spec §5). */
export const STARTING_HITPOINTS_XP = 4050;
/** Health and damage are in hundredths of a Hitpoints level, so armour percentages leave whole numbers. Also the smallest hit. */
export const HEALTH_PER_HITPOINTS_LEVEL = 100;
export const STARTING_HEALTH = 1000;

export const TICK_MS = 300;
/** How often the server checks whether a tick is due; ticks land within this of on time. */
export const TICK_DRIVER_MS = 20;

// Everything below counts whole ticks (spec §4, §5).
export const WALK_TICKS_PER_TILE = 2;
export const SWING_INTERVAL_TICKS = 8;
export const EAT_SWING_DELAY_TICKS = 4;
export const FIGHT_BACK_DELAY_TICKS = 4;
export const EAT_INTERVAL_TICKS = 4;
export const PLAYER_DEAD_TICKS = 5;
export const COMBAT_LOCK_TICKS = 34;

/** The combat lock as players are told it, rounded to whole seconds: 34 ticks of 300 ms are 10. */
export const COMBAT_LOCK_SECONDS = Math.round(
  (COMBAT_LOCK_TICKS * TICK_MS) / 1000,
);

/** The server alone knows the lock, so only it asks. */
export function logoutRefusal(locked: boolean) {
  return locked
    ? `You can't log out until ${COMBAT_LOCK_SECONDS} seconds after a fight.`
    : undefined;
}
export const REGEN_INTERVAL_TICKS = 20;
export const REGEN_PERCENT_OF_MAX_HEALTH = 5;
export const HEALING_POOL_INTERVAL_TICKS = 4;
export const SAVE_INTERVAL_TICKS = 100;
/** How long after its drop only its owner can see a ground item: one minute (#71). */
export const GROUND_ITEM_OWNER_TICKS = 200;
/** How long after its drop a ground item vanishes: three minutes (#71). */
export const GROUND_ITEM_DESPAWN_TICKS = 600;

// Fighting (spec §5). Hit chances are 0..1, per level above 1.
export const PLAYER_HIT_CHANCE = 0.4;
export const PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL = 0.005;
export const PLAYER_BASE_DAMAGE = 200;
/** Each this many Combat levels adds 100 to the maximum hit. */
export const COMBAT_LEVELS_PER_DAMAGE = 20;
// Experience per 100 damage; each swing's rounds to the nearest whole number.
export const XP_PER_DAMAGE_DEALT = 6;
export const DEFENSE_XP_PER_ENEMY_SWING = 6;
export const DEFENSE_XP_PER_DAMAGE_TAKEN = 4;
export const BLOCKING_XP_PER_BLOCK = 40;
/** A player's landed hit, sword bonus included, is critical this often, for this many times its damage. Enemies never crit. */
export const PLAYER_CRIT_CHANCE = 0.1;
export const PLAYER_CRIT_MULTIPLIER = 1.5;

/** What a player is doing; "" for nothing. */
export type PlayerAction =
  "" | "walking" | GatheringSkill | "smithing" | "fighting";

/** The server's per-tick message, sent right after the patch when there's anything to report. Its payload is `WorldEvent[]`. */
export const EVENTS = "events";
/** A `damage` of 0 is a miss, unless `blocked` says a shield stopped it. */
export type WorldEvent =
  | {
      type: "playerSwing";
      player: string;
      enemy: string;
      damage: number;
      critical: boolean;
    }
  | {
      type: "enemySwing";
      enemy: string;
      player: string;
      damage: number;
      blocked: boolean;
    }
  | { type: "enemyDied"; enemy: string }
  | { type: "playerDied"; player: string }
  | { type: "playerRespawned"; player: string }
  | { type: "enemyReturned"; enemy: string }
  /** A success carries how many it gave and what it found; a failure carries none. */
  | {
      type: GatheringVerb;
      player: string;
      success: true;
      count: 1 | 2;
      finds: ItemId[];
    }
  | { type: GatheringVerb; player: string; success: false; count?: never }
  /** One at the start of each item's wait; `ticks` is that wait, for fitting the clip to it. */
  | { type: "make"; player: string; station: StationKind; ticks: number }
  /** An item finished at a station, by its id, so the client can name an improved one (spec §5). */
  | { type: "made"; player: string; item: string }
  | { type: "eaten"; player: string }
  /** A healing tick that restored health; `amount` is what it actually restored. */
  | { type: "healed"; player: string; amount: number }
  /** A chat-box line only the server can decide. Everyone gets it, and only `player` prints it. */
  | { type: "told"; player: string; line: string }
  /** A conversation opened or moved on: the client shows `node`'s lines, then the choices that follow them. */
  | { type: "talk"; player: string; villager: VillagerId; node: string }
  /** The server ended a conversation the client may still be showing, on a walk away or a hit. */
  | { type: "talkEnded"; player: string }
  /** The server's answer to a deal: `done` when it went through, or false when refused, with the reason told. */
  | { type: "dealAnswered"; player: string; done: boolean }
  /** The store window opens for `player`. */
  | { type: "storeOpened"; player: string }
  /** The server closed a store window, on a walk away or a hit. */
  | { type: "storeClosed"; player: string }
  /** The player's bank window opens (village spec §6). */
  | { type: "bankOpened"; player: string }
  /** The server shut the bank window, on a walk away or a hit. */
  | { type: "bankClosed"; player: string };

export * from "./bank.ts";
export * from "./dialogue.ts";
export * from "./enemies.ts";
export * from "./herblaw.ts";
export * from "./gathering.ts";
export * from "./gear.ts";
export * from "./generalStore.ts";
export * from "./items.ts";
export * from "./making.ts";
export * from "./mining.ts";
export * from "./region.ts";
export * from "./regionMap.ts";
export * from "./skills.ts";
export * from "./playerMenu.ts";
export * from "./social.ts";
export * from "./woodcutting.ts";
export * from "./fishing.ts";
