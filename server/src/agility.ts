import {
  COURSE_LAP_XP,
  COURSE_ORDER,
  crossingFrom,
  crossRefusal,
  isObstacleKind,
  OBSTACLES,
  removeItems,
  RIGGING_ITEM,
  shortcutFailPercent,
  type ObstacleKind,
  type Tile,
} from "@runic/shared";
import { findPath } from "./pathfinding.ts";
import type { Crossing, QueuedAction } from "./playerActions.ts";
import type { World } from "./worldContext.ts";

const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;

/** Starts and finishes authoritative crossings, rigs shortcuts and tracks each player's course lap. */
export class Agility {
  /** Where each obstacle can be crossed from: its start, and a shortcut's far end too. */
  private readonly ends = new Map<ObstacleKind, Tile[]>();

  constructor(private readonly world: World) {
    world.tiles.forEach((row, y) =>
      row.forEach(({ obstacle, obstacleEnd }, x) => {
        const kind = obstacle ?? obstacleEnd;
        if (kind)
          this.ends.set(kind, [...(this.ends.get(kind) ?? []), { x, y }]);
      }),
    );
  }

  /**
   * A click on an obstacle, straight off the network. It walks to the nearer end the player can
   * reach, unless the client should already have refused it.
   */
  crossIntent(id: string, obstacle: unknown): QueuedAction | undefined {
    if (!isObstacleKind(obstacle) || !this.ends.has(obstacle)) return;
    const player = this.world.player(id);
    if (crossRefusal(obstacle, player)) return;
    const from = this.nearestEnd(obstacle, player);
    if (from) return { kind: "approachingObstacle", obstacle, from };
  }

  /** The end of the obstacle the player stands on or reaches in the fewest steps, if any. */
  private nearestEnd(obstacle: ObstacleKind, player: Tile) {
    let best: { end: Tile; steps: number } | undefined;
    for (const end of this.ends.get(obstacle)!) {
      const path = findPath(this.world.tiles, player, end);
      if (!sameTile(path.at(-1) ?? player, end)) continue;
      if (!best || path.length < best.steps) best = { end, steps: path.length };
    }
    return best?.end;
  }

  /** Starts the crossing on arrival, and finishes it on the landing tick once the busy state ends. */
  advance() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { crossing, action } = unsynced;
      if (crossing) {
        if (this.world.isBusy(id)) continue;
        unsynced.crossing = undefined;
        this.land(id, crossing);
      } else if (
        action?.kind === "approachingObstacle" &&
        !unsynced.path.length
      ) {
        this.begin(id, action.obstacle, action.from);
      }
    }
  }

  private begin(id: string, obstacle: ObstacleKind, from: Tile) {
    const player = this.world.player(id);
    const crossing = crossingFrom(this.world.tiles[from.y]![from.x]!, from);
    if (!sameTile(player, from) || crossing?.obstacle !== obstacle) {
      this.world.clearAction(id);
      return;
    }
    // A rope dropped on the way, say: the client's check came too early.
    const refusal = crossRefusal(obstacle, player);
    if (refusal) {
      this.world.clearAction(id);
      this.world.tell(id, refusal);
      return;
    }
    this.rigIfNeeded(id, obstacle);
    this.world.makeBusy(id, OBSTACLES[obstacle].ticks, { hittable: false });
    this.world.unsynced(id).crossing = { ...crossing, from: { ...from } };
  }

  /** The first crossing of a rope shortcut ties a rope there for this player, for good. */
  private rigIfNeeded(id: string, obstacle: ObstacleKind) {
    const player = this.world.player(id);
    if (
      !OBSTACLES[obstacle].shortcut?.rope ||
      player.riggedShortcuts.includes(obstacle)
    )
      return;
    removeItems(player.inventory, player.inventoryCounts, RIGGING_ITEM, 1);
    player.riggedShortcuts.push(obstacle);
    this.world.tell(
      id,
      `You tie a rope to the ${OBSTACLES[obstacle].name.toLowerCase()}. It stays rigged for you.`,
    );
  }

  private land(id: string, { obstacle, from, landing }: Crossing) {
    const player = this.world.player(id);
    const { name, shortcut } = OBSTACLES[obstacle];
    if (
      shortcut &&
      this.world.random() * 100 <
        shortcutFailPercent(obstacle, player.agilityXp)
    ) {
      // Never fatal (#234): the hit stops at 1 health.
      const damage = Math.max(0, Math.min(shortcut.failHit, player.health - 1));
      player.health -= damage;
      Object.assign(player, from);
      this.world.events.push({ type: "slipped", player: id, damage });
      this.world.tell(
        id,
        `You slip on the ${name.toLowerCase()} and land back where you started.`,
      );
      return;
    }
    Object.assign(player, landing);
    if (shortcut)
      this.world.earnXp(player, "agilityXp", OBSTACLES[obstacle].xp);
    else this.awardCourseExperience(id, obstacle);
  }

  private awardCourseExperience(id: string, obstacle: ObstacleKind) {
    const unsynced = this.world.unsynced(id);
    const progress = unsynced.courseProgress ?? 0;
    const next =
      obstacle === COURSE_ORDER[progress]
        ? progress + 1
        : obstacle === COURSE_ORDER[0]
          ? 1
          : 0;
    const finished = next === COURSE_ORDER.length;
    unsynced.courseProgress = finished ? 0 : next;
    this.world.earnXp(
      this.world.player(id),
      "agilityXp",
      OBSTACLES[obstacle].xp + (finished ? COURSE_LAP_XP : 0),
    );
    if (finished)
      this.world.tell(
        id,
        `You finish the Southfield course and earn ${COURSE_LAP_XP} bonus Agility experience.`,
      );
  }
}
