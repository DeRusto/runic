import {
  drainPrayerPoints,
  isBoostPrayer,
  OUT_OF_PRAYER_LINE,
  prayerBoostOf,
  prayerRefusal,
  prayersAfterToggle,
  type PrayerLadder,
} from "@runic/shared";
import type { SyncedPlayer, World } from "./worldContext.ts";

/**
 * Turns a prayer on or off. `prayer` comes straight off the network, so anything but a boost
 * prayer is ignored, as is turning one on above the player's level or at 0 points, whose refusal
 * the client has already shown. Like a stance, it skips the queue, so it works mid-fight from the
 * next tick, but not during an Agility crossing (Prayer spec §5).
 */
export function togglePrayer(world: World, id: string, prayer: unknown) {
  if (world.isCrossing(id)) return;
  const player = world.state.players.get(id);
  if (!player || player.dead || !isBoostPrayer(prayer)) return;
  if (!player.prayers.includes(prayer) && prayerRefusal(player, prayer)) return;
  setPrayers(player, prayersAfterToggle([...player.prayers], prayer));
}

/** Switches every prayer off, as death does (Prayer spec §5). */
export const endPrayers = (player: SyncedPlayer) => setPrayers(player, []);

function setPrayers(player: SyncedPlayer, prayers: string[]) {
  player.prayers.splice(0, player.prayers.length, ...prayers);
}

/** What the player's active step of `ladder` adds, or 0. */
export const prayerBoost = (world: World, id: string, ladder: PrayerLadder) =>
  prayerBoostOf([...world.player(id).prayers], ladder);

/** One tick of drain from the active prayers; at 0 they all switch off and the chat says so. Returns whether any prayer was on this tick, which stops regeneration. */
export function drainPrayers(world: World, id: string) {
  const player = world.player(id);
  if (!player.prayers.length) return false;
  const unsynced = world.unsynced(id);
  const { points, carried } = drainPrayerPoints(
    {
      points: player.prayerPoints,
      carried: unsynced.prayerDrainCarried ?? 0,
    },
    [...player.prayers],
  );
  player.prayerPoints = points;
  unsynced.prayerDrainCarried = carried;
  if (points === 0) {
    endPrayers(player);
    world.tell(id, OUT_OF_PRAYER_LINE);
  }
  return true;
}
