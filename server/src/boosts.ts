import {
  AVOIDANCE_POTION_POINTS,
  MIGHT_POTION_HIT,
  type PrayerLadder,
} from "@runic/shared";
import { prayerBoost } from "./prayers.ts";
import type { World } from "./worldContext.ts";

/** What a potion's Virtue (#222) and the active prayer of a ladder (Prayer spec §5) add together. Prayers add on top of potions and gear. */
const boostOf = (
  world: World,
  id: string,
  ladder: PrayerLadder,
  potionAmount: number,
) =>
  (world.unsynced(id).potion?.virtue === ladder ? potionAmount : 0) +
  prayerBoost(world, id, ladder);

/** What a player's attack adds now: Might to a landed hit, from a potion and a prayer, and an Accuracy prayer's points to land. */
export const attackBoostsOf = (world: World, id: string) => ({
  might: boostOf(world, id, "might", MIGHT_POTION_HIT),
  accuracy: prayerBoost(world, id, "accuracy"),
});

/** The Avoidance points a potion and a prayer add to worn Avoidance against an enemy's swing. */
export const avoidanceBoostOf = (world: World, id: string) =>
  boostOf(world, id, "avoidance", AVOIDANCE_POTION_POINTS);
