export const SERVER_PORT = 2567;
export const WORLD_ROOM = "world";

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
