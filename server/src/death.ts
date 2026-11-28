import {
  GEAR_SLOTS,
  PLAYER_DEAD_TICKS,
  respawnTile,
  wornCountOf,
} from "@runic/shared";
import { dropFromSlot } from "./dropping.ts";
import { wear } from "./gear.ts";
import { endPrayers } from "./prayers.ts";
import type { SyncedPlayer, World } from "./worldContext.ts";

export function die(world: World, id: string, player: SyncedPlayer) {
  player.dead = true;
  world.clearAction(id);
  world.stopFollowersOf(id);
  // Drop on death (#119): the Toolbelt stays.
  player.inventory.forEach((_, slot) => dropFromSlot(world, id, slot));
  for (const gearSlot of GEAR_SLOTS) {
    const worn = player[gearSlot];
    if (!worn) continue;
    // A stacking slot drops its whole stack as one ground item (Ranged spec §2).
    world.groundItems.spawn(
      player,
      worn,
      wornCountOf(player, gearSlot),
      player.username,
      world.state.tick,
    );
    wear(player, gearSlot, "", 0);
  }
  const unsynced = world.unsyncedPlayers.get(id)!;
  unsynced.ranDryAgainst = undefined;
  unsynced.healingPool.length = 0;
  unsynced.delicious = undefined;
  unsynced.potion = undefined;
  unsynced.busy = undefined;
  endPrayers(player);
  world.fitHealth(id);
  unsynced.respawnTick = world.state.tick + PLAYER_DEAD_TICKS;
  world.events.push({ type: "playerDied", player: id });
}

/** What dying changes, once it's over. */
export function respawned(world: World, player: SyncedPlayer) {
  return { ...respawnTile(world.tiles), health: player.maxHealth };
}

/** Brings a dead player back on the respawn tile once their death is over. */
export function respawnIfDue(world: World, id: string) {
  const player = world.player(id);
  const unsynced = world.unsynced(id);
  if (world.state.tick < unsynced.respawnTick) return;
  Object.assign(player, respawned(world, player), { dead: false });
  unsynced.lockEndTick = 0;
  world.events.push({ type: "playerRespawned", player: id });
}
