import {
  COURSE_LAP_XP,
  COURSE_ORDER,
  isObstacleKind,
  OBSTACLES,
  obstacleLanding,
  type ObstacleKind,
  type Tile,
} from "@runic/shared";
import type { QueuedAction } from "./playerActions.ts";
import type { World } from "./worldContext.ts";

/** Starts and finishes authoritative crossings and tracks each player's course lap. */
export class Agility {
  private readonly starts = new Map<ObstacleKind, Tile>();

  constructor(private readonly world: World) {
    world.tiles.forEach((row, y) =>
      row.forEach(({ obstacle }, x) => {
        if (obstacle) this.starts.set(obstacle, { x, y });
      }),
    );
  }

  crossIntent(obstacle: unknown): QueuedAction | undefined {
    if (isObstacleKind(obstacle) && this.starts.has(obstacle))
      return { kind: "approachingObstacle", obstacle };
  }

  /** The start of an obstacle already validated by the crossing intent. */
  startOf(obstacle: ObstacleKind) {
    return this.starts.get(obstacle)!;
  }

  /** Starts the crossing on arrival. The busy state holds the player until the landing tick. */
  advance() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const player = this.world.player(id);
      const { crossing, action } = unsynced;
      if (crossing) {
        if (this.world.isBusy(id)) continue;
        unsynced.crossing = undefined;
        Object.assign(player, obstacleLanding(crossing, player));
        this.awardExperience(id, crossing);
      } else if (
        action?.kind === "approachingObstacle" &&
        !unsynced.path.length
      ) {
        const start = this.startOf(action.obstacle);
        if (player.x !== start.x || player.y !== start.y) {
          this.world.clearAction(id);
          continue;
        }
        this.world.makeBusy(id, OBSTACLES[action.obstacle].ticks, {
          hittable: false,
        });
        unsynced.crossing = action.obstacle;
      }
    }
  }

  private awardExperience(id: string, obstacle: ObstacleKind) {
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
