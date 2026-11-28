import {
  BURY_TICKS,
  burialXp,
  EMPTY_SLOT,
  regeneratePrayerPoints,
} from "@runic/shared";
import type { World } from "./worldContext.ts";

/** Starts a burial on the player's own tile, replacing their current action. */
export function startBurial(
  world: World,
  id: string,
  slot: number,
  item: string,
) {
  const player = world.player(id);
  if (player.inventory[slot] !== item || !player.inventoryCounts[slot]) return;
  world.clearAction(id);
  world.unsynced(id).action = {
    kind: "burying",
    slot,
    item,
    doneTick: world.state.tick + BURY_TICKS,
  };
}

/** Recovers prayer points and completes a living player's burial if its bone is still there. */
export function advancePrayer(world: World, id: string) {
  const player = world.player(id);
  const { tick } = world.state;
  player.prayerPoints = regeneratePrayerPoints(
    player.prayerPoints,
    player.prayerXp,
    tick,
  );
  if (player.dead) return;
  const { action } = world.unsynced(id);
  if (action?.kind !== "burying" || tick < action.doneTick) return;

  world.clearAction(id);
  const { slot, item } = action;
  const xp = burialXp(item);
  if (
    xp === undefined ||
    player.inventory[slot] !== item ||
    !player.inventoryCounts[slot]
  )
    return;
  if (--player.inventoryCounts[slot]! === 0)
    player.inventory[slot] = EMPTY_SLOT;
  world.earnXp(player, "prayerXp", xp);
}
