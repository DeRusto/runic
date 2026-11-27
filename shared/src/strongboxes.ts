import type { ItemId } from "./items.ts";
import { RUNES } from "./runecrafting.ts";
import { levelFor } from "./skills.ts";
import {
  evenPick,
  pickByWeight,
  thievingFails,
  type LootRow,
} from "./thieving.ts";

/** All six runes, the elementals and Magic's focus and fury, an even pick, `fewest` to `most` of one (Magic spec §4). */
const runes = (fewest: number, most: number): LootRow[] =>
  RUNES.map((item) => ({
    item,
    fewest,
    most,
    weight: 1,
  }));

/**
 * What opening each strongbox needs and pays (#253, Thieving spec §8): the Thieving level, the
 * experience a success pays, its coins, the gem table and the rune table one roll each picks a row
 * from by weight, how long it stays empty for that player after, and the hit its trap deals on a
 * failure, in hundredths of a Hitpoints level. `place` is where it stands, as messages name it.
 */
export const STRONGBOXES = {
  boneyard: {
    place: "Boneyard",
    level: 40,
    xp: 56,
    coins: { fewest: 25, most: 60 },
    gems: [
      { item: "ashstone", fewest: 1, most: 1, weight: 6 },
      { item: "cinderglass", fewest: 1, most: 1, weight: 3 },
      { item: "heartflame", fewest: 1, most: 1, weight: 1 },
    ],
    runes: runes(2, 5),
    emptyTicks: 1000,
    trapHit: 800,
  },
  hollow: {
    place: "Runestone Hollow",
    level: 55,
    xp: 74,
    coins: { fewest: 50, most: 120 },
    gems: [
      { item: "ashstone", fewest: 1, most: 1, weight: 2 },
      { item: "cinderglass", fewest: 1, most: 1, weight: 5 },
      { item: "heartflame", fewest: 1, most: 1, weight: 3 },
    ],
    runes: runes(4, 10),
    emptyTicks: 2000,
    trapHit: 1200,
  },
} as const satisfies Record<
  string,
  {
    place: string;
    level: number;
    xp: number;
    coins: { fewest: number; most: number };
    gems: LootRow[];
    runes: LootRow[];
    emptyTicks: number;
    trapHit: number;
  }
>;
export type StrongboxKind = keyof typeof STRONGBOXES;

/** Whether `kind`, off the network or a map, names one of the strongboxes. */
export const isStrongboxKind = (kind: string): kind is StrongboxKind =>
  Object.hasOwn(STRONGBOXES, kind);

/** A strongbox as messages name it: "the Boneyard strongbox". */
export const strongboxName = (kind: StrongboxKind) =>
  `the ${STRONGBOXES[kind].place} strongbox`;

/** Whether one attempt on `kind` fails, on the same curve as a pickpocket (Thieving spec §1). */
export const strongboxFails = (
  kind: StrongboxKind,
  thievingXp: number,
  random: () => number,
) => thievingFails(STRONGBOXES[kind].level, thievingXp, random);

/** What one success takes: an even pick of the coins, then one roll each on the gem and rune tables. */
export function strongboxLoot(
  kind: StrongboxKind,
  random: () => number,
): { item: ItemId; count: number }[] {
  const box = STRONGBOXES[kind];
  return [
    { item: "coins", count: evenPick(box.coins, random) },
    pickByWeight(box.gems, random),
    pickByWeight(box.runes, random),
  ];
}

/** Why a player can't open this strongbox, or undefined if they can. */
export const strongboxRefusal = (kind: StrongboxKind, thievingXp: number) =>
  levelFor(thievingXp) < STRONGBOXES[kind].level
    ? `You need Thieving ${STRONGBOXES[kind].level} to open ${strongboxName(kind)}.`
    : undefined;
