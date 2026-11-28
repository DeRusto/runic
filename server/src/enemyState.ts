import { schema, t } from "@colyseus/schema";
import type { EnemyKind, EnemyState, Tile } from "@runic/shared";

export const Enemy = schema(
  {
    x: t.uint8(),
    y: t.uint8(),
    kind: t.string<EnemyKind>(),
    health: t.uint16(),
    maxHealth: t.uint16(),
    elite: t.boolean().default(false),
    target: t.string().default(""),
    water: t.boolean().default(false),
    earth: t.boolean().default(false),
    air: t.boolean().default(false),
    state: t.string<EnemyState>().default("idle"),
  },
  "Enemy",
);
export type SyncedEnemy = InstanceType<typeof Enemy>;

/** A player as an enemy sees one: where they are and how much health they have, read live. */
type Fighter = Tile & { health: number; dead: boolean };

/** What `advance` needs from the world on one tick. */
export type EnemyWorld = {
  tick: number;
  /** Every player in join order, as noticing checks them: a tie stays with the first. */
  players(): Iterable<{
    id: string;
    player: Fighter;
    dropped: boolean;
    /** False while busy in a way enemies can't hit, such as Agility's crossing (#236). */
    hittable: boolean;
  }>;
  /** A player, live, so a swing's damage shows at once; undefined once they have left. */
  player(id: string): Fighter | undefined;
  /** Rolls a swing that is due and applies it to the player. It may change their health. */
  swing(enemyId: string, playerId: string): void;
};
