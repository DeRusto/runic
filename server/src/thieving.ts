import {
  PICKPOCKETS,
  STUN_TICKS,
  pickpocketFails,
  pickpocketLoot,
  type ItemId,
  type PickpocketTarget,
} from "@runic/shared";

/** What one pickpocket attempt reads from and changes in the world, so Thieving's rules stay out of the simulation. */
export type PickpocketWorld = {
  random: () => number;
  thievingXp: number;
  health: number;
  earnXp(gained: number): void;
  /** Puts the loot in the inventory, and returns how many didn't fit. */
  give(item: ItemId, count: number): number;
  /** Puts what didn't fit on the ground at the player's feet. */
  drop(item: ItemId, count: number): void;
  hurt(damage: number): void;
  stun(ticks: number): void;
  tell(line: string): void;
};

const capitalised = (words: string) => words[0]!.toUpperCase() + words.slice(1);

/**
 * One attempt on a target the player stands beside and has the level for (#250). A success pays
 * its loot and experience; a failure hits, never fatally, then stuns.
 */
export function pickpocket(target: PickpocketTarget, world: PickpocketWorld) {
  const { called, xp, failHit } = PICKPOCKETS[target];
  if (pickpocketFails(target, world.thievingXp, world.random)) {
    world.hurt(Math.max(0, Math.min(failHit, world.health - 1)));
    world.stun(STUN_TICKS);
    world.tell(
      `${capitalised(called)} catches you and shoves you. You're stunned.`,
    );
    return;
  }
  const { item, count } = pickpocketLoot(target, world.random);
  world.earnXp(xp);
  const left = world.give(item, count);
  if (left) world.drop(item, left);
  world.tell(
    `You pick ${called}'s pocket.${left ? " It is on the ground." : ""}`,
  );
}
