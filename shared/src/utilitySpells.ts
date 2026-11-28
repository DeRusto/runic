import { valueOf, sellRefusal, storePaysFor } from "./generalStore.ts";
import { COMBAT_LOCK_SECONDS, EMPTY_SLOT } from "./index.ts";
import { addItems, COINS, removeItems, type ItemId } from "./items.ts";
import { questDoneOf } from "./quests.ts";
import { respawnTile, type Tile, type TileKind } from "./region.ts";
import { levelFor } from "./skills.ts";
import {
  holdsRunes,
  runeCountsOf,
  runesLineOf,
  type SpellRunes,
} from "./spellRunes.ts";

/** A utility spell's row: its Magic gate, the Magic experience a cast pays, the runes it spends, and what it does (Magic spec §9, #319). */
type UtilitySpellRow = {
  name: string;
  gate: number;
  xp: number;
  runes: SpellRunes;
  does: string;
};

/** The spellbook's three utility spells, cast with any weapon in hand, keyed by id (Magic spec §9, #319). */
export const UTILITY_SPELLS = {
  villageTeleport: {
    name: "Village teleport",
    gate: 12,
    xp: 15,
    runes: { airRune: 3, furyRune: 1 },
    does: "Moves you to the village square",
  },
  coinTurn: {
    name: "Coin-turn",
    gate: 20,
    xp: 10,
    runes: { fireRune: 3, focusRune: 1 },
    does: "Turns one item into the store's price in coins",
  },
  hollowTeleport: {
    name: "Hollow teleport",
    gate: 28,
    xp: 25,
    runes: { earthRune: 3, airRune: 1, furyRune: 1 },
    does: "Moves you beside Hollis in Runestone Hollow",
  },
} as const satisfies Record<string, UtilitySpellRow>;

export type UtilitySpell = keyof typeof UTILITY_SPELLS;

/** The utility spells that move the caster, which the combat lock refuses (Magic spec §9). */
export type Teleport = Exclude<UtilitySpell, "coinTurn">;

/** Whether a value off the network names a utility spell. */
export const isUtilitySpell = (spell: unknown): spell is UtilitySpell =>
  typeof spell === "string" && Object.hasOwn(UTILITY_SPELLS, spell);

/** The utility spells lowest gate first, as the Spellbook tab lists them after the combat spells (Magic spec §9). */
export const utilitySpellsInGateOrder = () =>
  (Object.keys(UTILITY_SPELLS) as UtilitySpell[]).sort(
    (a, b) => UTILITY_SPELLS[a].gate - UTILITY_SPELLS[b].gate,
  );

/** Each rune a cast of `spell` spends, with how many. */
export const utilityRunesOf = (spell: UtilitySpell) =>
  runeCountsOf(UTILITY_SPELLS[spell].runes);

/** A utility spell's runes as the Spellbook tab reads them: "3 earth, 1 air, 1 fury". */
export const utilityRunesLine = (spell: UtilitySpell) =>
  runesLineOf(UTILITY_SPELLS[spell].runes);

type Caster = {
  magicXp: number;
  inventory: Iterable<string>;
  inventoryCounts: Iterable<number>;
  quests?: Iterable<unknown>;
  questStages?: Iterable<unknown>;
};

const runesLine = (spell: UtilitySpell) =>
  `You don't have the runes to cast ${UTILITY_SPELLS[spell].name}.`;

/**
 * Why the player can't cast `spell` now: below its gate, Hollow teleport before Hollis's quest is
 * done, a teleport while the combat lock runs (`locked`, which only the server knows), or
 * without its runes (Magic spec §9). Undefined if it casts.
 */
export function utilitySpellRefusal(
  player: Caster,
  spell: UtilitySpell,
  locked = false,
) {
  const { gate, name, runes } = UTILITY_SPELLS[spell];
  if (levelFor(player.magicXp) < gate)
    return `You need Magic level ${gate} to cast ${name}.`;
  if (spell === "hollowTeleport" && !questDoneOf(player, "hollisRunes"))
    return `You must finish Hollis's quest to cast ${name}.`;
  if (spell !== "coinTurn" && locked)
    return `You can't teleport until ${COMBAT_LOCK_SECONDS} seconds after a fight.`;
  return holdsRunes(player, runes) ? undefined : runesLine(spell);
}

/** What Coin-turn says while it waits for an item, and to a click on an empty slot (Magic spec §9). */
export const COIN_TURN_CHOOSE_LINE = "Choose an item to turn into coins.";

/** Quest items, which Coin-turn never turns: Odo's proof essences, the Hollow essence and the bone sigil (Magic spec §9). */
export const QUEST_ITEMS: ReadonlySet<string> = new Set<ItemId>([
  "copperEssence",
  "ironEssence",
  "emberiteEssence",
  "hollowEssence",
  "boneSigil",
]);

/** What Coin-turn pays for one `item`: the general store's buy price, in coins (Magic spec §9). */
export const coinTurnPrice = (item: string) => storePaysFor(valueOf(item));

/**
 * Why Coin-turn can't turn one item from inventory slot `slot`: the spell's own refusal, an empty
 * slot, anything the store doesn't buy, a quest item, the turned item being one of the runes the
 * cast needs, or no room for the coins. Tried on a copy of the bag, as a store deal is (Magic spec §9).
 */
export function coinTurnRefusal(player: Caster, slot: number) {
  const refusal = utilitySpellRefusal(player, "coinTurn");
  if (refusal) return refusal;
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  const item = items[slot] ?? EMPTY_SLOT;
  if (item === EMPTY_SLOT) return COIN_TURN_CHOOSE_LINE;
  const notBought = sellRefusal(item);
  if (notBought) return notBought;
  if (QUEST_ITEMS.has(item)) return "Coin-turn can't turn a quest item.";
  if (!coinTurnPrice(item)) return "The store doesn't buy that.";
  return turnToCoins(items, counts, slot);
}

/**
 * Turns one item from `slot` into its price in coins and spends Coin-turn's runes, in the same
 * arrays, so an `ArraySchema` works. Says why if the runes or the room run short partway, which
 * `coinTurnRefusal` finds on a copy before the server turns the real bag.
 */
export function turnToCoins(items: string[], counts: number[], slot: number) {
  const item = items[slot]!;
  counts[slot]! -= 1;
  if (!counts[slot]) items[slot] = EMPTY_SLOT;
  const bag = { inventory: items, inventoryCounts: counts };
  if (!holdsRunes(bag, UTILITY_SPELLS.coinTurn.runes))
    return runesLine("coinTurn");
  for (const [rune, count] of utilityRunesOf("coinTurn"))
    removeItems(items, counts, rune, count);
  if (addItems(items, counts, COINS, coinTurnPrice(item)))
    return "You don't have room for the coins.";
  return undefined;
}

/** Where Village teleport lands: the respawn tile, in the village square (Magic spec §9). */
export const villageTeleportTile = (tiles: TileKind[][]): Tile =>
  respawnTile(tiles);

/** Where Hollow teleport lands: the tile west of Hollis, between them and the gap into Runestone Hollow (Magic spec §9). */
export function hollowTeleportTile(tiles: TileKind[][]): Tile {
  const y = tiles.findIndex((row) =>
    row.some((tile) => tile.villager === "hollis"),
  );
  return {
    x: tiles[y]!.findIndex((tile) => tile.villager === "hollis") - 1,
    y,
  };
}

/** Where each teleport lands on this region. */
export const landingOf = (spell: Teleport, tiles: TileKind[][]) =>
  spell === "villageTeleport"
    ? villageTeleportTile(tiles)
    : hollowTeleportTile(tiles);
