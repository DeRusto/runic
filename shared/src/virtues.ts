import {
  AVOIDANCE_TENTHS_PER_POINT,
  GEAR,
  GEAR_SLOTS,
  type GearSlot,
} from "./gear.ts";
import { itemParts, type Virtue } from "./items.ts";
import { TIERS } from "./region.ts";

/** Each wood's tier number, at the metal tier its bow's gate matches (#228). */
const WOOD_TIERS = { birch: 1, oak: 3, charwood: 5 } as const;

/** Each Virtue's unit, its size on an uncommon Copper piece (spec §3), and what the Gear tab says it does at a size (spec §5). Fortitude is in health, Might in the sword bonus's units, and Avoidance in tenths of a point. */
const VIRTUE_EFFECTS: Record<
  Virtue,
  { unit: number; does: (size: number) => string }
> = {
  fortitude: { unit: 20, does: (size) => `Adds ${size} to your max health.` },
  might: {
    unit: 3,
    does: (size) => `Adds ${size} to your minimum and maximum hit.`,
  },
  avoidance: {
    unit: 1,
    does: (tenths) =>
      `Takes ${tenths / AVOIDANCE_TENTHS_PER_POINT} points off an enemy's chance to hit you.`,
  },
};

/**
 * #217's ½-uncommon Virtue ladder for capes, as whole units by tier, lowest first: a common
 * cape carries its Virtue at half the size spec §3's units give an uncommon one (Fortitude
 * 20×tier, Might 3×tier, Avoidance tier tenths), an uncommon one at full, and a rare one at
 * double. Might's half rounds down and Avoidance's up, because a cape never carries less
 * than 1 tenth — which is also all an uncommon Copper cape carries, so common and uncommon
 * meet at 1 there; at every other Virtue and tier common is strictly below uncommon.
 */
const CAPE_COMMON_VIRTUES: Record<
  Virtue,
  [number, number, number, number, number]
> = {
  fortitude: [10, 20, 30, 40, 50],
  might: [1, 3, 4, 6, 7],
  avoidance: [1, 1, 2, 2, 3],
};

/** The size of `item`'s Virtue, 0 for a common piece. Its unit is multiplied by the tier number, read from the base id's prefix, and rare is double uncommon (spec §3). A bow is sized by the wood tier at the metal tier its gate matches (#228), and a cape carries its Virtue at every Quality, on the ½-uncommon ladder above (#217). */
function virtueSize(item: string) {
  const { base, quality, virtue } = itemParts(item);
  if (!virtue) return 0;
  const wood = Object.entries(WOOD_TIERS).find(([name]) =>
    base.startsWith(name),
  );
  const tier = wood
    ? wood[1]
    : TIERS.findIndex((name) => base.startsWith(name)) + 1;
  const uncommon = VIRTUE_EFFECTS[virtue].unit * tier;
  if (GEAR.get(base)?.slot === "cape")
    return quality === "common"
      ? CAPE_COMMON_VIRTUES[virtue][tier - 1]!
      : uncommon * (quality === "rare" ? 2 : 1);
  return uncommon * (quality === "rare" ? 2 : 1);
}

/** The total of one Virtue over every worn piece, as armour adds up, in that Virtue's unit. */
export const virtueOf = (
  player: Partial<Record<GearSlot, string>>,
  virtue: Virtue,
) =>
  GEAR_SLOTS.reduce((total, slot) => {
    const item = player[slot] ?? "";
    return total + (itemParts(item).virtue === virtue ? virtueSize(item) : 0);
  }, 0);

/** What the Gear tab says `item`'s Virtue does, after its base stat, or undefined for a common piece (spec §5). */
export function virtueDoes(item: string) {
  const { virtue } = itemParts(item);
  return virtue ? VIRTUE_EFFECTS[virtue].does(virtueSize(item)) : undefined;
}

/** The tenths of Avoidance a gossamer cloak adds to its cape (§217, tunable at build). */
export const GOSSAMER_AVOIDANCE_TENTHS = 2;

/** The tenths of Avoidance `item`'s reagent variant adds, 0 for a plain id (#217). */
export const variantAvoidanceTenths = (item: string) =>
  itemParts(item).variant === "gossamer" ? GOSSAMER_AVOIDANCE_TENTHS : 0;

/** The total of every worn piece's reagent variant's Avoidance, in tenths of a point (#217). */
export const variantAvoidanceOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + variantAvoidanceTenths(player[slot] ?? ""),
    0,
  );

/** What the Gear tab says `item`'s reagent variant adds, or undefined for a plain one (#217). */
export function variantDoes(item: string) {
  const tenths = variantAvoidanceTenths(item);
  return tenths ? VIRTUE_EFFECTS.avoidance.does(tenths) : undefined;
}

/** The id of `cape`'s gossamer cloak: the cape's full id with the `gossamer` variant on the end, which keeps its Quality and Virtue (#217, ADR 0004). */
export const gossamerItem = (cape: string) => `${cape}:gossamer`;

/** The cape `item`'s gossamer cloak was made from, without the variant, or undefined if it isn't one (ADR 0004). */
export const capeOfGossamer = (item: string) =>
  itemParts(item).variant === "gossamer"
    ? item.split(":").slice(0, -1).join(":")
    : undefined;
