import {
  addXp,
  BANK_SLOTS,
  COMBAT_LOCK_TICKS,
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  MASTERY_SHARE_PERCENT,
  maxHealthOf,
  type GearSlot,
  type StationKind,
  type Tile,
  type TileKind,
  type VillagerId,
  type WorldEvent,
  type XpField,
} from "@runic/shared";
import { isBusy } from "./busy.ts";
import { GroundItems } from "./groundItems.ts";
import type { UnsyncedPlayer } from "./playerActions.ts";
import { Player, WorldState } from "./worldState.ts";

/** A player's synced entry in the world state. */
export type SyncedPlayer = InstanceType<typeof Player>;

export const isInventorySlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < INVENTORY_SLOTS;
export const isBankSlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < BANK_SLOTS;
export const isAmount = (amount: number) =>
  Number.isInteger(amount) && amount > 0;

/** The Hitpoints level × 100, plus the Fortitude of every worn piece (spec §2). */
export const maxHealthTotal = (
  player: { hitpointsXp: number } & Partial<Record<GearSlot, string>>,
) => {
  const { skill, gear } = maxHealthOf(player);
  return skill + gear;
};

/**
 * The state every part of the game shares, and the rules about a player that more than one
 * part needs. `Simulation` owns one and hands it to each module it runs.
 */
export class World {
  readonly state = new WorldState();
  /** What each player's action and timers need that clients don't, by session id. */
  readonly unsyncedPlayers = new Map<string, UnsyncedPlayer>();
  /** Apart from the action, which eating doesn't replace (spec §4). */
  readonly queuedEats = new Map<string, number>();
  /** Apart from the action too, which dropping doesn't replace (spec §4). */
  readonly queuedDrops = new Map<string, { slot: number; amount: number }>();
  readonly groundItems = new GroundItems(this.state.groundItems);
  /** This tick's one-shot moments, for the room to broadcast after the patch and empty. */
  readonly events: WorldEvent[] = [];
  readonly villagers = new Map<VillagerId, Tile>();
  /** Each station's tiles: the furnace covers four. */
  readonly stations: Partial<Record<StationKind, Tile[]>> = {};
  /** The region's tiles, copied so that a pooled site can block its spot only while it's there. */
  readonly tiles: TileKind[][];

  constructor(
    tiles: TileKind[][],
    readonly random: () => number,
  ) {
    this.tiles = tiles.map((row) => row.map((tile) => ({ ...tile })));
  }

  /** A player known to be in the region. */
  player(id: string) {
    return this.state.players.get(id)!;
  }

  /** The unsynced side of a player known to be in the region. */
  unsynced(id: string) {
    return this.unsyncedPlayers.get(id)!;
  }

  tell(id: string, line: string) {
    this.events.push({ type: "told", player: id, line });
  }

  /** Mastery's share is of what lands, so experience lost to the cap earns none. */
  earnXp(player: SyncedPlayer, field: XpField, gained: number) {
    const before = player[field];
    player[field] = addXp(before, gained);
    const hundredths =
      player.masteryHundredths +
      (player[field] - before) * MASTERY_SHARE_PERCENT;
    player.masteryXp = addXp(player.masteryXp, Math.floor(hundredths / 100));
    player.masteryHundredths = hundredths % 100;
  }

  /** After gear changes or a Fortitude potion starts or ends: max health follows worn Fortitude and an active potion's, and health drops to it but never rises (spec §2, #222). */
  fitHealth(id: string) {
    const player = this.player(id);
    player.maxHealth =
      maxHealthTotal(player) + (this.unsynced(id).potion?.bonus ?? 0);
    player.health = Math.min(player.health, player.maxHealth);
  }

  clearAction(id: string) {
    const unsynced = this.unsynced(id);
    unsynced.path = [];
    unsynced.action = undefined;
    Object.assign(this.player(id), { target: "", action: "" });
  }

  /** Death or logout on the target's side ends following too. */
  stopFollowersOf(target: string) {
    for (const [id, { action }] of this.unsyncedPlayers) {
      if (action?.kind === "following" && action.player === target)
        this.clearAction(id);
    }
  }

  /** Checked as an intent arrives. Enough, since death comes after intents apply in a tick. */
  alive(id: string) {
    const player = this.state.players.get(id);
    return player !== undefined && !player.dead;
  }

  /**
   * Alive and not busy: a busy player's clicks are ignored, not saved for later (#236). Checked as
   * an intent arrives, like `alive`, against the next tick, the one it would apply on: not the
   * current one, or a click sent just after the stun's last tick would be lost too.
   */
  canAct(id: string) {
    const busy = this.unsyncedPlayers.get(id)?.busy;
    return this.alive(id) && !isBusy(busy, this.state.tick + 1);
  }

  /** Whether the player is busy this tick: stunned, or later crossing an Agility obstacle (#236). */
  isBusy(id: string) {
    return isBusy(this.unsyncedPlayers.get(id)?.busy, this.state.tick);
  }

  /** Makes the player busy for `ticks` from now: whatever they were doing stops, and their clicks are ignored until it ends (#236). */
  makeBusy(id: string, ticks: number, { hittable }: { hittable: boolean }) {
    this.clearAction(id);
    this.unsynced(id).busy = { endTick: this.state.tick + ticks, hittable };
  }

  lockRunning(id: string) {
    return this.state.tick < (this.unsyncedPlayers.get(id)?.lockEndTick ?? 0);
  }

  /** Not refreshed while dropped, or an enemy's swings would hold them here until killed (Q3). */
  lock(id: string) {
    const unsynced = this.unsynced(id);
    if (!unsynced.dropped)
      unsynced.lockEndTick = this.state.tick + COMBAT_LOCK_TICKS;
  }

  /** A drop waiting on this slot meant what was there before, so it no longer stands. */
  forgetDropOn(id: string, slot: number) {
    if (this.queuedDrops.get(id)?.slot === slot) this.queuedDrops.delete(id);
  }

  /** A part drop is one ground item, and the rest stays in the slot. */
  dropSlot(id: string, slot: number, amount = Infinity) {
    const player = this.state.players.get(id)!;
    const item = player.inventory[slot]!;
    if (!item) return;
    const count = Math.min(amount, player.inventoryCounts[slot]!);
    const { username } = player;
    this.groundItems.spawn(player, item, count, username, this.state.tick);
    player.inventoryCounts[slot]! -= count;
    if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
  }
}
