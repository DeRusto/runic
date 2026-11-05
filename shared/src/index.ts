export const SERVER_PORT = 2567;
export const WORLD_ROOM = "world";

/** The walk intent's message type; its payload is the clicked Tile. */
export const WALK_INTENT = "walk";
/** The target intent's message type; its payload is the clicked Spider's id in state. */
export const TARGET_INTENT = "target";
/** The forage intent's message type; its payload is the clicked bush's id in state. */
export const FORAGE_INTENT = "forage";
/** One broadcast per tick, right after the patch, when there is anything to report; its payload is `GameEvent[]`. */
export const EVENTS = "events";
export type GameEvent = { type: "pick"; id: string; success: boolean };
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
export const SAVE_INTERVAL_TICKS = 100;

export const SPIDER_HEALTH = 8;
export const SPIDER_WANDER_CHANCE = 0.1;
export const SPIDER_WANDER_TILES = 5;

export * from "./foraging.ts";
export * from "./region.ts";
export * from "./skills.ts";
