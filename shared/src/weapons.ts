import type { Gear } from "./gear.ts";

/** A sword gates on Attack and carries its hit bonus (spec §5). */
export const sword = (level: number, hitBonus: number): Gear => ({
  slot: "weapon",
  gate: "Attack",
  level,
  does: `Adds ${hitBonus} to your minimum and maximum hit`,
  hitBonus,
});

/** How far a bow shoots, in 8-way tiles (#270, Ranged spec §4). */
export const BOW_REACH_TILES = 6;
/** How often a bow fires, a melee swing's pace (#270, Ranged spec §4). */
export const BOW_INTERVAL_TICKS = 8;

/** A bow gates on Ranged and carries Accuracy, never a hit bonus: the arrow decides how hard a shot hits (Ranged spec §2). It shoots from its reach (§4). */
export const bow = (level: number, accuracy: number): Gear => ({
  slot: "weapon",
  gate: "Ranged",
  level,
  does: `Adds ${accuracy} points to your chance to hit`,
  accuracy,
  reachTiles: BOW_REACH_TILES,
  intervalTicks: BOW_INTERVAL_TICKS,
});

/** A staff gates on Magic and carries Accuracy, never a hit bonus: the spell will decide how hard a cast hits (Magic spec §2). Until casting comes it has no reach, so it fights in melee. */
export const staff = (level: number, accuracy: number): Gear => ({
  slot: "weapon",
  gate: "Magic",
  level,
  does: `Adds ${accuracy} points to your chance to hit`,
  accuracy,
});

/** How far throwing knives reach, in 8-way tiles (#270, Ranged spec §5). */
export const KNIFE_REACH_TILES = 4;
/** How often throwing knives are thrown (#270, Ranged spec §5). */
export const KNIFE_INTERVAL_TICKS = 6;

/** A stack of throwing knives is a weapon of its own: it gates on Ranged, carries the throw's hit bonus and no Accuracy, and spends itself (Ranged spec §5). */
export const throwingKnife = (level: number, hitBonus: number): Gear => ({
  slot: "weapon",
  gate: "Ranged",
  level,
  does: `Adds ${hitBonus} to a throw's minimum and maximum hit`,
  hitBonus,
  reachTiles: KNIFE_REACH_TILES,
  intervalTicks: KNIFE_INTERVAL_TICKS,
  thrown: true,
});

/** Arrows go in the ammo slot and carry a shot's hit bonus (Ranged spec §2). They do nothing unless a bow is wielded. */
export const arrow = (level: number, hitBonus: number): Gear => ({
  slot: "ammo",
  gate: "Ranged",
  level,
  does: `Adds ${hitBonus} to a bow shot's minimum and maximum hit`,
  hitBonus,
});
