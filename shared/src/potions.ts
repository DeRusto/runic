import { BUSHES } from "./herblaw.ts";
import {
  heldCount,
  removeItems,
  slotFor,
  type HasInventory,
  type ItemId,
  type Virtue,
} from "./items.ts";
import { levelFor } from "./skills.ts";

/** Mixing pays this multiple of the plant's pick experience, as cooking pays over the catch (#222). */
export const MIX_XP_PER_PICK = 1.5;

/** What one potion does and what it's mixed from (#222). */
export type Potion = {
  /** The Virtue its buff carries while it lasts. */
  virtue: Virtue;
  /** The plant one vial mixes with to make it. */
  plant: ItemId;
  /** The Herblaw level needed to mix it: the plant's pick gate. */
  level: number;
  /** What mixing one pays, in Herblaw experience: `MIX_XP_PER_PICK` of the plant's pick. */
  xp: number;
};

/** The three Virtue potions, by id (#222). The base herb makes no potion: it's Cooking material. */
export const POTIONS = {
  mightPotion: {
    virtue: "might",
    plant: "dewpetal",
    level: 5,
    xp: MIX_XP_PER_PICK * BUSHES.dewpetalBush.xp,
  },
  fortitudePotion: {
    virtue: "fortitude",
    plant: "nightbloom",
    level: 15,
    xp: MIX_XP_PER_PICK * BUSHES.nightbloomBush.xp,
  },
  avoidancePotion: {
    virtue: "avoidance",
    plant: "emberbloom",
    level: 20,
    xp: MIX_XP_PER_PICK * BUSHES.emberbloomBush.xp,
  },
} as const satisfies Record<string, Potion>;
export type PotionId = keyof typeof POTIONS;
const POTION_IDS = Object.keys(POTIONS) as PotionId[];

/** The potion with this base id, or undefined if it isn't one. */
export const potionOf = (item: string) =>
  POTION_IDS.find((potion) => potion === item);

/** The potion mixed from this plant's id, or undefined if the plant makes none. */
export const potionFromPlant = (plant: string) =>
  POTION_IDS.find((potion) => POTIONS[potion].plant === plant);

/** A Virtue potion's buff runs this many ticks, or two minutes (#222). */
export const POTION_BUFF_TICKS = 400;
/** A Might potion adds this much to the minimum and maximum hit while its buff lasts (#222). */
export const MIGHT_POTION_HIT = 100;
/** A Fortitude potion raises max health this percent while its buff lasts (#222). */
export const FORTITUDE_POTION_PERCENT = 25;
/** An Avoidance potion gives this many Avoidance points while its buff lasts: 10 tenths of gear.ts's scale (#222). */
export const AVOIDANCE_POTION_POINTS = 1;

/** Why mixing `potion` can't go through, or undefined if it can: the making engine's lines, gated on Herblaw (#222). Mixing is instant, so the potion's room is checked too. */
export function mixRefusal(
  potion: PotionId,
  player: HasInventory & { herblawXp: number },
) {
  const { level, plant } = POTIONS[potion];
  if (levelFor(player.herblawXp) < level) return `Needs Herblaw ${level}`;
  const costs: [ItemId, number][] = [
    ["vial", 1],
    [plant, 1],
  ];
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  if (costs.some(([cost, count]) => heldCount(items, counts, cost) < count))
    return "Not enough materials";
  // The mixing takes the vial and the plant, so the potion's room is counted without them.
  for (const [cost, count] of costs) removeItems(items, counts, cost, count);
  return slotFor(potion, { inventory: items, inventoryCounts: counts }) < 0
    ? "Your inventory is full."
    : undefined;
}
