import { rollPlayerHit } from "./combat.ts";
import { gearOf, type GearSlot } from "./gear.ts";
import { heldCount, type ItemId } from "./items.ts";
import { rangedAttackRefusal, rangedWeaponOf } from "./ranged.ts";
import { levelFor, type XpField } from "./skills.ts";
import { hitCurvesOf } from "./stats.ts";
import type { Style } from "./triangle.ts";
import { virtueOf } from "./virtues.ts";

type Worn = Partial<Record<GearSlot, string>>;
type Bag = { inventory: Iterable<string>; inventoryCounts: Iterable<number> };

/** A combat spell's row: its Magic gate, the hit bonus a landed cast adds, the Magic experience every cast pays, the runes each cast spends, and what it will do beyond damage (Magic spec §5, #318). */
type CombatSpellRow = {
  name: string;
  gate: number;
  hitBonus: number;
  baseXp: number;
  runes: Partial<Record<ItemId, number>>;
  effect: string;
};

/** The spellbook's eight combat spells, a dart and a surge per element, keyed by id (Magic spec §5, #318). */
export const COMBAT_SPELLS = {
  airDart: {
    name: "Air dart",
    gate: 1,
    hitBonus: 100,
    baseXp: 2,
    runes: { airRune: 1, focusRune: 1 },
    effect: "5 points off Accuracy for 20 ticks",
  },
  waterDart: {
    name: "Water dart",
    gate: 5,
    hitBonus: 150,
    baseXp: 3,
    runes: { waterRune: 1, airRune: 1, focusRune: 1 },
    effect: "Next swing 4 ticks late",
  },
  earthDart: {
    name: "Earth dart",
    gate: 10,
    hitBonus: 200,
    baseXp: 4,
    runes: { earthRune: 2, airRune: 1, focusRune: 1 },
    effect: "Held for 6 ticks",
  },
  airSurge: {
    name: "Air surge",
    gate: 15,
    hitBonus: 250,
    baseXp: 5,
    runes: { airRune: 1, furyRune: 1 },
    effect: "10 points off Accuracy for 20 ticks",
  },
  fireDart: {
    name: "Fire dart",
    gate: 20,
    hitBonus: 300,
    baseXp: 6,
    runes: { fireRune: 3, airRune: 2, focusRune: 1 },
    effect: "Burns for 3 hits of 10% over 6 ticks",
  },
  waterSurge: {
    name: "Water surge",
    gate: 25,
    hitBonus: 350,
    baseXp: 7,
    runes: { waterRune: 1, airRune: 1, furyRune: 1 },
    effect: "Next swing 8 ticks late",
  },
  earthSurge: {
    name: "Earth surge",
    gate: 30,
    hitBonus: 400,
    baseXp: 8,
    runes: { earthRune: 2, airRune: 1, furyRune: 1 },
    effect: "Held for 12 ticks",
  },
  fireSurge: {
    name: "Fire surge",
    gate: 35,
    hitBonus: 450,
    baseXp: 9,
    runes: { fireRune: 3, airRune: 2, furyRune: 1 },
    effect: "Burns for 3 hits of 20% over 6 ticks",
  },
} as const satisfies Record<string, CombatSpellRow>;

export type CombatSpell = keyof typeof COMBAT_SPELLS;

/** Whether a value off the network names a combat spell. */
export const isCombatSpell = (spell: unknown): spell is CombatSpell =>
  typeof spell === "string" && Object.hasOwn(COMBAT_SPELLS, spell);

/** The combat spells lowest gate first, as the Spellbook tab lists them (Magic spec §5). */
export const combatSpellsInGateOrder = () =>
  (Object.keys(COMBAT_SPELLS) as CombatSpell[]).sort(
    (a, b) => COMBAT_SPELLS[a].gate - COMBAT_SPELLS[b].gate,
  );

/** Each rune a cast of `spell` spends, with how many. */
export const runesOf = (spell: CombatSpell) =>
  Object.entries(COMBAT_SPELLS[spell].runes) as [ItemId, number][];

/** A spell's runes as the Spellbook tab reads them: "3 fire, 2 air, 1 focus". */
export const runesLine = (spell: CombatSpell) =>
  runesOf(spell)
    .map(([rune, count]) => `${count} ${rune.replace(/Rune$/, "")}`)
    .join(", ");

/** How far a cast reaches, in 8-way tiles (Magic spec §5, #317). */
export const MAGIC_REACH_TILES = 8;
/** Ticks between a player's casts (Magic spec §5, #317). */
export const CAST_INTERVAL_TICKS = 10;

/** What the chat says when a staff attacks with no combat spell picked (Magic spec §5). */
export const NO_SPELL_LINE = "Choose a combat spell first.";
/** What the chat says when the picked spell's runes run out, at the click or mid-fight (Magic spec §5). */
export const OUT_OF_RUNES_LINE = "You have run out of runes.";

/** Why the player can't pick `spell`: their Magic level is below its gate (Magic spec §5). */
export function spellPickRefusal(
  player: { magicXp: number },
  spell: CombatSpell,
) {
  const { gate, name } = COMBAT_SPELLS[spell];
  return levelFor(player.magicXp) < gate
    ? `You need Magic level ${gate} to cast ${name}.`
    : undefined;
}

/** Whether the weapon in hand is a staff, the only weapon gated on Magic (Magic spec §2). */
export const wieldsStaff = (player: Worn) =>
  gearOf(player.weapon ?? "")?.gate === "Magic";

/** A staff's reach and cast rate, which no stance changes; undefined for any other weapon (Magic spec §5). */
export const castOf = (player: Worn) =>
  wieldsStaff(player)
    ? { reachTiles: MAGIC_REACH_TILES, intervalTicks: CAST_INTERVAL_TICKS }
    : undefined;

/** The reach and rate of a weapon that attacks from afar, a bow, knives or a staff; undefined for a sword or bare hands, which fight next to their target (Ranged spec §4, Magic spec §5). */
export const atRangeOf = (player: Parameters<typeof rangedWeaponOf>[0]) =>
  rangedWeaponOf(player) ?? castOf(player);

/** The picked spell, if it is one; a save's "" is none. */
export const pickedSpellOf = (player: { combatSpell?: string }) =>
  isCombatSpell(player.combatSpell) ? player.combatSpell : undefined;

/** Whether the bag holds every rune one cast of `spell` spends. */
export const hasRunesFor = (player: Bag, spell: CombatSpell) => {
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  return runesOf(spell).every(
    ([rune, count]) => heldCount(items, counts, rune) >= count,
  );
};

/** Why a staff can't cast now: no spell picked, or not its runes (Magic spec §5). Undefined for any other weapon. */
export function magicAttackRefusal(
  player: Worn & Partial<Bag> & { combatSpell?: string },
) {
  if (!wieldsStaff(player)) return undefined;
  const spell = pickedSpellOf(player);
  if (!spell) return NO_SPELL_LINE;
  // Read field by field: a synced player's fields are accessors, which a spread would drop.
  const bag = {
    inventory: player.inventory ?? [],
    inventoryCounts: player.inventoryCounts ?? [],
  };
  return hasRunesFor(bag, spell) ? undefined : OUT_OF_RUNES_LINE;
}

/** Why the weapon in hand can't attack now: a bow with no arrows, or a staff with no spell or runes. */
export const attackRefusal = (
  player: Worn & Partial<Bag> & { combatSpell?: string },
) => rangedAttackRefusal(player) ?? magicAttackRefusal(player);

/**
 * A cast's chance (0..1) to land, its min and max, and its bonus: the shared curves read from
 * Magic, with worn Accuracy (the staff's and the ring's) on the chance, and the picked spell's
 * hit bonus plus worn Might on a landed hit (Magic spec §5, #317).
 */
export function magicHitOf(
  player: { magicXp: number; combatSpell?: string } & Worn,
) {
  const level = levelFor(player.magicXp);
  const spell = pickedSpellOf(player);
  return {
    ...hitCurvesOf(level, level, player),
    gear:
      (spell ? COMBAT_SPELLS[spell].hitBonus : 0) + virtueOf(player, "might"),
  };
}

/**
 * One cast of the picked spell at an enemy with `enemyHealth` left, which fights in
 * `targetStyle`, rolled as a swing is (see `rollPlayerHit`). Magic gets the spell's base
 * experience, hit or miss, plus the damage part; Hitpoints gets the damage part again
 * (Magic spec §5).
 */
export function magicHit(
  player: { magicXp: number; agilityXp: number; combatSpell?: string } & Worn,
  targetStyle: Style,
  mightBonus: number,
  enemyHealth: number,
  random: () => number,
  accuracyBonus = 0,
) {
  const { damage, critical, xp } = rollPlayerHit(
    magicHitOf(player),
    { style: "magic", against: targetStyle },
    player.agilityXp,
    mightBonus,
    enemyHealth,
    random,
    accuracyBonus,
  );
  const spell = pickedSpellOf(player);
  const base = spell ? COMBAT_SPELLS[spell].baseXp : 0;
  return {
    damage,
    critical,
    xp: [
      ["magicXp", base + xp],
      ["hitpointsXp", xp],
    ] as [XpField, number][],
  };
}
