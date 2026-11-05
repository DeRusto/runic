export const SERVER_PORT = 2567;
export const WORLD_ROOM = "world";

/** The walk intent's message type; its payload is the clicked Tile. */
export const WALK_INTENT = "walk";
/** The target intent's message type; its payload is the clicked Spider's id in state. */
export const TARGET_INTENT = "target";
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
export const SPIDER_FIRST_SWING_DELAY_TICKS = 4;
export const EAT_SWING_DELAY_TICKS = 4;
export const EAT_INTERVAL_TICKS = 4;
export const SPIDER_RESPAWN_TICKS = 100;
export const PLAYER_DEAD_TICKS = 5;
export const COMBAT_LOCK_TICKS = 34;
export const REGEN_INTERVAL_TICKS = 20;
export const BERRY_REGROW_TICKS = 50;
export const HERB_REGROW_TICKS = 100;
export const SAVE_INTERVAL_TICKS = 100;

export const SPIDER_HEALTH = 8;
export const SPIDER_WANDER_CHANCE = 0.1;
export const SPIDER_WANDER_TILES = 5;

// Fighting (spec §5). Hit chances are 0..1, per level above 1.
export const PLAYER_HIT_CHANCE = 0.4;
export const PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL = 0.005;
export const PLAYER_BASE_DAMAGE = 2;
export const COMBAT_LEVELS_PER_DAMAGE = 20;
export const SPIDER_HIT_CHANCE = 0.35;
export const SPIDER_HIT_CHANCE_PER_DEFENSE_LEVEL = -0.002;
export const SPIDER_MAX_DAMAGE = 2;
export const XP_PER_DAMAGE_DEALT = 6;
export const DEFENSE_XP_PER_SPIDER_SWING = 6;
export const DEFENSE_XP_PER_DAMAGE_TAKEN = 4;

/** The server's per-tick message, sent right after the patch when there's anything to report. Its payload is `WorldEvent[]`. */
export const EVENTS = "events";
/** A `damage` of 0 is a miss. */
export type WorldEvent =
  | { type: "playerSwing"; player: string; spider: string; damage: number }
  | { type: "spiderSwing"; spider: string; player: string; damage: number }
  | { type: "spiderDied"; spider: string }
  | { type: "spiderReturned"; spider: string };

export * from "./region.ts";
export * from "./skills.ts";
