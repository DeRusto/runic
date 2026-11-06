export const SERVER_PORT = 2567;
export const WORLD_ROOM = "world";

/** The walk intent's message type; its payload is the clicked Tile. */
export const WALK_INTENT = "walk";
/** The target intent's message type; its payload is the clicked enemy's id in state. */
export const TARGET_INTENT = "target";
/** The forage intent's message type; its payload is the clicked bush's id in state. */
export const FORAGE_INTENT = "forage";
/** The eat intent's message type; its payload is the clicked inventory slot's index. */
export const EAT_INTENT = "eat";
/** The discard intent's message type; its payload is the inventory slot's index. */
export const DISCARD_INTENT = "discard";
/** The pin intent's message type; its payload is `{ skill, pinned }`, with `pinned` false to unpin. */
export const PIN_INTENT = "pin";
/** The log out intent's message type; it has no payload. */
export const LOGOUT_INTENT = "logout";
/** The chat intent's message type, payload the line; the server broadcasts a `ChatLine` under it too. */
export const CHAT = "chat";
export const MAX_CHAT_LENGTH = 120;
/** How long a chat line stays over the speaker's head. */
export const CHAT_OVERHEAD_MS = 3000;
export type ChatLine = { id: string; username: string; text: string };

/** Closes the old connection when the same account logs in again. */
export const TAKEN_OVER_CLOSE_CODE = 4011;

export const INVENTORY_SLOTS = 30;
/** An inventory slot with no item in it. */
export const EMPTY_SLOT = "";
/** Level 10; every other skill starts at 0 XP, level 1 (spec §5). */
export const STARTING_HITPOINTS_XP = 4050;
export const STARTING_HEALTH = 10;

export const TICK_MS = 300;
/** How often the server checks whether a tick is due; ticks land within this of on time. */
export const TICK_DRIVER_MS = 20;

// Everything below counts whole ticks (spec §4, §5).
export const WALK_TICKS_PER_TILE = 2;
export const SWING_INTERVAL_TICKS = 8;
export const EAT_SWING_DELAY_TICKS = 4;
export const EAT_INTERVAL_TICKS = 4;
export const PLAYER_DEAD_TICKS = 5;
export const COMBAT_LOCK_TICKS = 34;
export const REGEN_INTERVAL_TICKS = 20;
export const REGEN_PERCENT_OF_MAX_HEALTH = 5;
export const SAVE_INTERVAL_TICKS = 100;

export const LEASH_TILES = 4;

// Fighting (spec §5). Hit chances are 0..1, per level above 1.
export const PLAYER_HIT_CHANCE = 0.4;
export const PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL = 0.005;
export const PLAYER_BASE_DAMAGE = 2;
export const COMBAT_LEVELS_PER_DAMAGE = 20;
export const XP_PER_DAMAGE_DEALT = 6;
export const DEFENSE_XP_PER_ENEMY_SWING = 6;
export const DEFENSE_XP_PER_DAMAGE_TAKEN = 4;

/** What a player is doing; "" for nothing. */
export type PlayerAction = "" | "walking" | "foraging" | "fighting";

/** The server's per-tick message, sent right after the patch when there's anything to report. Its payload is `WorldEvent[]`. */
export const EVENTS = "events";
/** A `damage` of 0 is a miss. */
export type WorldEvent =
  | { type: "playerSwing"; player: string; enemy: string; damage: number }
  | { type: "enemySwing"; enemy: string; player: string; damage: number }
  | { type: "enemyDied"; enemy: string }
  | { type: "playerDied"; player: string }
  | { type: "playerRespawned"; player: string }
  | { type: "enemyReturned"; enemy: string }
  | { type: "pick"; player: string; success: boolean }
  | { type: "eaten"; player: string; healed: number };

export * from "./enemies.ts";
export * from "./foraging.ts";
export * from "./items.ts";
export * from "./region.ts";
export * from "./skills.ts";
