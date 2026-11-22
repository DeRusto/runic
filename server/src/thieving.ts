import {
  PICKPOCKETS,
  STALLS,
  STALL_LOCKOUT_TICKS,
  STUN_TICKS,
  pickpocketFails,
  pickpocketLoot,
  stallFails,
  stallLoot,
  stallName,
  type ItemId,
  type PickpocketTarget,
  type StallKind,
} from "@runic/shared";

/** What every Thieving attempt reads from and changes in the world, so Thieving's rules stay out of the simulation. */
type ThievingWorld = {
  random: () => number;
  thievingXp: number;
  earnXp(gained: number): void;
  /** Puts the loot in the inventory, and returns how many didn't fit. */
  give(item: ItemId, count: number): number;
  /** Puts what didn't fit on the ground at the player's feet. */
  drop(item: ItemId, count: number): void;
  tell(line: string): void;
};

/** What one pickpocket attempt reads from and changes in the world. */
export type PickpocketWorld = ThievingWorld & {
  health: number;
  /** Takes `damage` off the player's health, then makes them busy for `ticks`, enemies still able to hit them. */
  stun(ticks: number, damage: number): void;
};

/** What one theft from a stall reads from and changes in the world: the stall's per-player timers among it (#252). */
export type StallWorld = ThievingWorld & {
  /** Whether this stall is still empty for this player after their last theft. */
  emptied: boolean;
  /** Whether Marta still keeps this player away from this stall after catching them. */
  closed: boolean;
  /** Empties this stall for this player alone, for `ticks`. */
  empty(ticks: number): void;
  /** Closes this stall to this player alone, for `ticks`. */
  close(ticks: number): void;
};

/** Gives the loot, putting what doesn't fit on the ground, and says whether any went there. */
function giveOrDrop(
  world: ThievingWorld,
  loot: { item: ItemId; count: number }[],
) {
  let onGround = false;
  for (const { item, count } of loot) {
    const left = world.give(item, count);
    if (!left) continue;
    world.drop(item, left);
    onGround = true;
  }
  return onGround;
}

const ON_GROUND = " It is on the ground.";

const capitalised = (words: string) => words[0]!.toUpperCase() + words.slice(1);

/**
 * One attempt on a target the player stands beside and has the level for (#250). A success pays
 * its loot and experience; a failure hits, never fatally, then stuns.
 */
export function pickpocket(target: PickpocketTarget, world: PickpocketWorld) {
  const { called, xp, failHit } = PICKPOCKETS[target];
  if (pickpocketFails(target, world.thievingXp, world.random)) {
    world.stun(STUN_TICKS, Math.max(0, Math.min(failHit, world.health - 1)));
    world.tell(
      `${capitalised(called)} catches you and shoves you. You're stunned.`,
    );
    return;
  }
  world.earnXp(xp);
  const onGround = giveOrDrop(world, pickpocketLoot(target, world.random));
  world.tell(`You pick ${called}'s pocket.${onGround ? ON_GROUND : ""}`);
}

/**
 * One theft from a stall the player stands beside and has the level for (#252). A success pays
 * items and experience, then empties the stall for this player alone. A failure costs nothing but
 * the stall: Marta closes it to this player for a while, with no hit and no stun.
 */
export function stealFromStall(kind: StallKind, world: StallWorld) {
  const stall = stallName(kind);
  if (world.closed) return world.tell(`Marta won't let you near ${stall} yet.`);
  if (world.emptied)
    return world.tell(`${capitalised(stall)} is empty. Come back soon.`);
  if (stallFails(kind, world.thievingXp, world.random)) {
    world.close(STALL_LOCKOUT_TICKS);
    return world.tell(
      `Marta catches you at ${stall}. She won't let you near it for a while.`,
    );
  }
  world.earnXp(STALLS[kind].xp);
  const onGround = giveOrDrop(world, [stallLoot(kind, world.random)]);
  world.empty(STALLS[kind].emptyTicks);
  world.tell(`You take from ${stall}.${onGround ? ON_GROUND : ""}`);
}
