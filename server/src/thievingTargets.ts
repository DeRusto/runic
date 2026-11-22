import {
  addItems,
  isPickpocketTarget,
  isStallKind,
  isStrongboxKind,
  PICKPOCKET_INTERVAL_TICKS,
  PICKPOCKETS,
  pickpocketRefusal,
  stallRefusal,
  strongboxRefusal,
  type ItemId,
  type MarkId,
  type PickpocketTarget,
  type StallKind,
  type StrongboxKind,
  type Tile,
  type VillagerId,
  type WorldEvent,
} from "@runic/shared";
import type { Fighting } from "./fighting.ts";
import type { QueuedAction, UnsyncedAction } from "./playerActions.ts";
import { PlayerTimers } from "./playerTimers.ts";
import { openStrongbox, pickpocket, stealFromStall } from "./thieving.ts";
import type { World } from "./worldContext.ts";

/** Where the region's marks, stalls and strongboxes stand, and players' Thieving attempts on them; the rules of each attempt are in thieving.ts. */
export class ThievingTargets {
  private marks = new Map<MarkId, Tile>();
  /** Each of Marta's stalls by its kind: the region has one of each (#252). */
  private stalls = new Map<StallKind, Tile>();
  /** The stalls each player has emptied, and those Marta has closed to them, by username (#252). Not saved: a restart refills and reopens them. */
  private stallsEmptied = new PlayerTimers();
  private stallsClosed = new PlayerTimers();
  /** Each strongbox by its kind: the region has at most one of each (#253). */
  private strongboxes = new Map<StrongboxKind, Tile>();
  /** The strongboxes each player has emptied, by username (#253). Not saved: a restart refills them. */
  private strongboxesEmptied = new PlayerTimers();

  constructor(
    private readonly world: World,
    private readonly fighting: Fighting,
  ) {
    world.tiles.forEach((row, y) =>
      row.forEach(({ mark, stall, strongbox }, x) => {
        if (mark) this.marks.set(mark, { x, y });
        if (stall) this.stalls.set(stall, { x, y });
        if (strongbox) this.strongboxes.set(strongbox, { x, y });
      }),
    );
  }

  /** The pickpocket a click asks for. `target` comes straight off the network, so anything but a mark or pickpocketable villager standing in this region is ignored, as is a click the rules refuse (#250, #251). */
  pickpocketIntent(id: string, target: unknown): QueuedAction | undefined {
    const player = this.world.state.players.get(id);
    if (!player || typeof target !== "string") return undefined;
    if (!isPickpocketTarget(target) || !this.standingAt(target))
      return undefined;
    if (pickpocketRefusal(PICKPOCKETS[target], player.thievingXp))
      return undefined;
    return { kind: "pickpocketing", target };
  }

  /** The theft a click asks for. `stall` comes straight off the network, so anything but a stall standing in this region is ignored, as is a click the rules refuse (#252). */
  stealIntent(id: string, stall: unknown): QueuedAction | undefined {
    const player = this.world.state.players.get(id);
    if (!player || typeof stall !== "string") return undefined;
    if (!isStallKind(stall) || !this.stalls.has(stall)) return undefined;
    if (stallRefusal(stall, player.thievingXp)) return undefined;
    return { kind: "stealing", stall };
  }

  /** The attempt a click asks for. `strongbox` comes straight off the network, so anything but a strongbox standing in this region is ignored, as is a click the rules refuse (#253). */
  openIntent(id: string, strongbox: unknown): QueuedAction | undefined {
    const player = this.world.state.players.get(id);
    if (!player || typeof strongbox !== "string") return undefined;
    if (!isStrongboxKind(strongbox) || !this.strongboxes.has(strongbox))
      return undefined;
    if (strongboxRefusal(strongbox, player.thievingXp)) return undefined;
    return { kind: "opening", strongbox };
  }

  /** Where a thieving action's walk ends next to, or undefined for any other action. */
  nextToOf(action: UnsyncedAction): Tile | undefined {
    if (action.kind === "pickpocketing") return this.standingAt(action.target);
    if (action.kind === "stealing") return this.stalls.get(action.stall);
    if (action.kind === "opening")
      return this.strongboxes.get(action.strongbox);
    return undefined;
  }

  /** Where a pickpocket target stands in this region, a mark or a villager, if they do. */
  private standingAt(target: PickpocketTarget) {
    return (
      this.marks.get(target as MarkId) ??
      this.world.villagers.get(target as VillagerId)
    );
  }

  /** Restores the stalls and strongboxes this player emptied before leaving, as the events that emptied them. */
  emptiedFor(
    id: string,
  ): Extract<WorldEvent, { type: "stallEmptied" | "strongboxEmptied" }>[] {
    const player = this.world.state.players.get(id);
    if (!player) return [];
    const { username } = player;
    const { tick } = this.world.state;
    return [
      ...[...this.stalls.keys()].map((stall) => ({
        type: "stallEmptied" as const,
        player: id,
        stall,
        ticks: this.stallsEmptied.remaining(username, stall, tick),
      })),
      ...[...this.strongboxes.keys()].map((strongbox) => ({
        type: "strongboxEmptied" as const,
        player: id,
        strongbox,
        ticks: this.strongboxesEmptied.remaining(username, strongbox, tick),
      })),
    ].filter(({ ticks }) => ticks > 0);
  }

  /**
   * After the steps, so a pickpocket, a theft from a stall or a strongbox attempt lands on the tick
   * of arrival, or as soon after as the attempt interval allows (#250, #252, #253). All three share
   * the interval.
   */
  advance() {
    const { tick } = this.world.state;
    this.stallsEmptied.forgetEnded(tick);
    this.stallsClosed.forgetEnded(tick);
    this.strongboxesEmptied.forgetEnded(tick);
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (
        action?.kind !== "pickpocketing" &&
        action?.kind !== "stealing" &&
        action?.kind !== "opening"
      )
        continue;
      if (unsynced.path.length || tick < unsynced.nextAttemptTick) continue;
      unsynced.action = undefined;
      unsynced.nextAttemptTick = tick + PICKPOCKET_INTERVAL_TICKS;
      const player = this.world.state.players.get(id)!;
      const world = {
        random: this.world.random,
        thievingXp: player.thievingXp,
        earnXp: (gained: number) =>
          this.world.earnXp(player, "thievingXp", gained),
        give: (item: ItemId, count: number) =>
          addItems(player.inventory, player.inventoryCounts, item, count),
        drop: (item: ItemId, count: number) =>
          this.world.groundItems.spawn(
            player,
            item,
            count,
            player.username,
            tick,
          ),
        tell: (line: string) =>
          this.world.events.push({ type: "told", player: id, line }),
      };
      if (action.kind === "pickpocketing") {
        pickpocket(action.target, {
          ...world,
          health: player.health,
          stun: (ticks, damage) => {
            player.health -= damage;
            this.world.makeBusy(id, ticks, { hittable: true });
            this.world.events.push({ type: "stunned", player: id, damage });
          },
        });
        continue;
      }
      const { username } = player;
      if (action.kind === "opening") {
        const { strongbox } = action;
        openStrongbox(strongbox, {
          ...world,
          emptied: this.strongboxesEmptied.running(username, strongbox, tick),
          empty: (ticks) => {
            this.strongboxesEmptied.start(username, strongbox, tick, ticks);
            this.world.events.push({
              type: "strongboxEmptied",
              player: id,
              strongbox,
              ticks,
            });
          },
          springTrap: (ticks, hit) => {
            const damage = Math.min(hit, player.health);
            player.health -= damage;
            this.world.events.push({ type: "trapSprung", player: id, damage });
            if (player.health === 0) this.fighting.die(id, player);
            else this.world.makeBusy(id, ticks, { hittable: true });
          },
        });
        continue;
      }
      const { stall } = action;
      stealFromStall(stall, {
        ...world,
        emptied: this.stallsEmptied.running(username, stall, tick),
        closed: this.stallsClosed.running(username, stall, tick),
        empty: (ticks) => {
          this.stallsEmptied.start(username, stall, tick, ticks);
          this.world.events.push({
            type: "stallEmptied",
            player: id,
            stall,
            ticks,
          });
        },
        close: (ticks) => this.stallsClosed.start(username, stall, tick, ticks),
      });
    }
  }
}
