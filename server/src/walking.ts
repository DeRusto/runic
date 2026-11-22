import {
  stationOf,
  tilesApart,
  WALK_TICKS_PER_TILE,
  type Tile,
} from "@runic/shared";
import type { Firemaking } from "./firemaking.ts";
import type { GatheringSites } from "./gatheringSites.ts";
import { findPath, legalSteps, pathNextTo } from "./pathfinding.ts";
import type { QueuedAction, UnsyncedAction } from "./playerActions.ts";
import type { ThievingTargets } from "./thievingTargets.ts";
import type { World } from "./worldContext.ts";

/** Starting each player's action from their click, walking them toward its target a step at a time, and showing what they are doing. */
export class Walking {
  constructor(
    private readonly world: World,
    private readonly sites: GatheringSites,
    private readonly thieving: ThievingTargets,
    private readonly firemaking: Firemaking,
  ) {}

  /** Starts the action a queued click asks for, and the walk toward its target. */
  start(id: string, intent: QueuedAction) {
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    const player = this.world.state.players.get(id)!;
    // With no way there, the old action still ends, and nothing replaces it.
    const goNextTo = (action: UnsyncedAction) => {
      const path = pathNextTo(this.world.tiles, player, this.nextToOf(action)!);
      unsynced.path = path ?? [];
      unsynced.action = path && action;
    };
    switch (intent.kind) {
      case "fighting":
        unsynced.action = { kind: "fighting", enemy: intent.enemy };
        break;
      case "making": {
        const { kind, item, all, at } = intent;
        const action: UnsyncedAction = { kind, item, all, at };
        // A fire the player is standing on or beside needs no walk (#224).
        if (at && tilesApart(player, at) <= 1) {
          unsynced.action = action;
          unsynced.path = [];
        } else {
          goNextTo(action);
        }
        break;
      }
      case "lighting":
        this.firemaking.startLighting(id, intent.slot);
        break;
      case "visiting":
      case "pickpocketing":
      case "stealing":
      case "opening":
        goNextTo(intent);
        break;
      case "taking": {
        // Onto its tile, not next to it. It may have gone since the intent arrived.
        const groundItem = this.world.state.groundItems.get(intent.groundItem);
        unsynced.path = groundItem
          ? findPath(this.world.tiles, player, groundItem)
          : [];
        unsynced.action = groundItem && intent;
        break;
      }
      case "following":
        // The target may have left or died since the intent arrived.
        unsynced.action = this.world.alive(intent.player) ? intent : undefined;
        unsynced.path = [];
        break;
      case "gathering":
        goNextTo({ kind: intent.skill, site: intent.site });
        break;
      case "walking":
        unsynced.action = undefined;
        unsynced.path = findPath(this.world.tiles, player, intent.to);
        break;
      default:
        intent satisfies never;
    }
  }

  /** The tiles a walk for this action ends next to, for the actions whose target stays put. */
  private nextToOf(action?: UnsyncedAction): Tile | Tile[] | undefined {
    if (action?.kind === "making")
      return action.at ?? this.world.stations[stationOf(action.item)];
    if (action?.kind === "visiting")
      return this.world.villagers.get(action.villager);
    const target = action && this.thieving.nextToOf(action);
    if (target) return target;
    if (action && "site" in action) return this.sites.get(action.site);
    return undefined;
  }

  /** Each player due a step takes one along their path, re-pathing toward a target that moves or a way that a site now blocks. */
  advance() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      // nextStepTick outlives each walk, so clicking again can't beat the walking speed.
      if (this.world.state.tick < unsynced.nextStepTick) continue;
      const player = this.world.state.players.get(id)!;
      if (unsynced.action?.kind === "fighting") {
        // Re-pathed every step since it can move. A path's last step lands on its tile, so
        // stopping short of that is exactly "next to" (spec D1).
        const enemy = this.world.state.enemies.get(unsynced.action.enemy)!;
        unsynced.path = findPath(this.world.tiles, player, enemy).slice(0, -1);
      } else if (unsynced.action?.kind === "following") {
        // Next to, never on, the target's tile: so a follower on it steps off.
        const target = this.world.state.players.get(unsynced.action.player)!;
        unsynced.path = pathNextTo(this.world.tiles, player, target) ?? [];
      }
      const next = unsynced.path[0];
      // A pooled site may have come back on the way since the path was found,
      // perhaps on the tile the walk ends on, so head for the target again.
      if (
        next &&
        !legalSteps(this.world.tiles, player).some(
          ({ x, y }) => x === next.x && y === next.y,
        )
      ) {
        const nextTo = this.nextToOf(unsynced.action);
        unsynced.path = nextTo
          ? (pathNextTo(this.world.tiles, player, nextTo) ?? [])
          : findPath(this.world.tiles, player, unsynced.path.at(-1)!);
      }
      if (!unsynced.path.length) continue;
      Object.assign(player, unsynced.path.shift());
      unsynced.nextStepTick = this.world.state.tick + WALK_TICKS_PER_TILE;
    }
  }

  /** After the swings, so each player's synced target and action show this tick's. */
  syncActions() {
    for (const [id, { action, path }] of this.world.unsyncedPlayers) {
      const player = this.world.state.players.get(id)!;
      player.target = action?.kind === "fighting" ? action.enemy : "";
      player.action =
        action &&
        action.kind !== "visiting" &&
        action.kind !== "taking" &&
        action.kind !== "following" &&
        action.kind !== "pickpocketing" &&
        action.kind !== "stealing" &&
        action.kind !== "opening"
          ? action.kind
          : path.length
            ? "walking"
            : "";
    }
  }
}
