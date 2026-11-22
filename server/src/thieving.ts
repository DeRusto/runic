import {
  addItems,
  articleFor,
  COINS,
  itemTag,
  levelFor,
  PICKPOCKETS,
  pickpocketRefusal,
  rollPickpocket,
  STUN_TICKS,
  type PickpocketTarget,
  type WorldEvent,
} from "@runic/shared";

/** A player as a pickpocket attempt reads and changes them. */
type Thief = {
  inventory: string[];
  inventoryCounts: number[];
  thievingXp: number;
  health: number;
};

/** What a pickpocket attempt needs from the simulation (#250). */
export type ThievingWorld = {
  random: () => number;
  /** Pays experience, with Mastery's share. */
  earnThievingXp(xp: number): void;
  /** Leaves the player busy for `ticks`, still open to hits, with whatever they were doing stopped. */
  stun(ticks: number): void;
  /** Puts what didn't fit in the inventory on the ground under the player, theirs for now. */
  placeOnGround(item: string, count: number): void;
  event(event: WorldEvent): void;
};

/**
 * One attempt at `person`'s pocket, beside them. The inventory may have filled on the walk, so the
 * refusal is checked again. A catch hits, never fatally, then stuns; a success pays coins,
 * sometimes an item, and Thieving (Thieving spec §2).
 */
export function pickpocket(
  world: ThievingWorld,
  id: string,
  player: Thief,
  person: PickpocketTarget,
) {
  const row = PICKPOCKETS[person];
  const refusal = pickpocketRefusal(row, player);
  if (refusal) {
    world.event({ type: "told", player: id, line: refusal });
    return;
  }
  const outcome = rollPickpocket(
    row,
    levelFor(player.thievingXp),
    world.random,
  );
  if (outcome.caught) {
    // Never fatal: it leaves at least the smallest scrap of health.
    const damage = Math.max(0, Math.min(outcome.damage, player.health - 1));
    player.health -= damage;
    world.stun(STUN_TICKS);
    world.event({ type: "stunned", player: id, damage, ticks: STUN_TICKS });
    world.event({
      type: "told",
      player: id,
      line: `${row.name} catches you, and you're stunned.`,
    });
    return;
  }
  const { inventory, inventoryCounts } = player;
  addItems(inventory, inventoryCounts, COINS, outcome.coins);
  for (const item of outcome.items) {
    const left = addItems(inventory, inventoryCounts, item, 1);
    if (left) world.placeOnGround(item, left);
  }
  world.earnThievingXp(outcome.xp);
  const [found] = outcome.items;
  world.event({
    type: "told",
    player: id,
    ...(found
      ? {
          line: `You pick ${row.name}'s pocket, and find ${articleFor(found)} ${itemTag(found)}.`,
          items: [found],
        }
      : { line: `You pick ${row.name}'s pocket.` }),
  });
}
