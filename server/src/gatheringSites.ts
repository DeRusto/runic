import {
  GATHERING,
  GATHERING_SKILLS,
  gatheringSource,
  gatherRefusal,
  groundBlocks,
  siteId,
  type GatheringLeftField,
  type GatheringSkill,
  type SitePool,
  type Tile,
} from "@runic/shared";
import { legalSteps } from "./pathfinding.ts";
import type { QueuedAction } from "./playerActions.ts";
import type { SyncedPlayer, World } from "./worldContext.ts";
import { SITE_SCHEMAS } from "./worldState.ts";

/** A site pool, with the ticks its run-out sites come back on, soonest first. */
type SitePoolState = SitePool & { comebackTicks: number[] };

/** A gathering site: where it is and what it is, its synced entry, and when it grows back or which pool it comes back in. */
export type GatheringSite = Tile & {
  skill: GatheringSkill;
  kind: string;
  synced: Partial<Record<GatheringLeftField, number>>;
  regrowTick?: number;
  pool?: SitePoolState;
};

/** Every gathering site in the region: bushes, veins, trees and fishing spots, how much each has left, and the pools whose sites move when they run out. */
export class GatheringSites {
  /** Every gathering site, by the tile that keys it. */
  private sites = new Map<string, GatheringSite>();
  /** Each site pool, with the ticks its run-out sites come back on, soonest first. Not saved: a restart picks again. */
  private pools: SitePoolState[] = [];

  /** Adds the region's fixed sites, which block their tiles. */
  constructor(private readonly world: World) {
    world.tiles.forEach((row, y) =>
      row.forEach((kind, x) => {
        for (const skill of GATHERING_SKILLS) {
          const siteKind = kind[GATHERING[skill].site];
          if (siteKind) this.addSite(skill, siteKind, { x, y });
        }
      }),
    );
  }

  /** Places each pool's first sites, once the enemies stand where they start. */
  placePools(pools: SitePool[]) {
    this.pools = pools.map((pool) => ({ ...pool, comebackTicks: [] }));
    for (const pool of this.pools)
      for (let i = 0; i < pool.active; i++) this.placePooledSite(pool);
  }

  get(id: string) {
    return this.sites.get(id);
  }

  has(id: string) {
    return this.sites.has(id);
  }

  /** The gathering a click asks for. `site` comes straight off the network, so anything but the id of this skill's site is ignored, as is a click the rules refuse. */
  gatherIntent(
    id: string,
    skill: GatheringSkill,
    site: string,
  ): QueuedAction | undefined {
    const player = this.world.state.players.get(id);
    const found = this.sites.get(site);
    if (!player || found?.skill !== skill) return undefined;
    if (this.siteRefusal(found, player)) return undefined;
    return { kind: "gathering", skill, site };
  }

  siteRefusal({ skill, kind, synced }: GatheringSite, player: SyncedPlayer) {
    const left = synced[GATHERING[skill].leftField]!;
    return gatherRefusal(skill, kind, left, player);
  }

  /** A full site on `tile`, which blocks while it's there. */
  private addSite(
    skill: GatheringSkill,
    kind: string,
    { x, y }: Tile,
    pool?: SitePoolState,
  ) {
    const { site, stateField, leftField } = GATHERING[skill];
    const id = siteId({ x, y });
    const synced = Object.assign(new SITE_SCHEMAS[stateField](), {
      [leftField]: gatheringSource(skill, kind).holds,
    });
    // The row keeps the schema and its map together, which the types can't follow.
    this.world.state[stateField].set(id, synced as never);
    this.sites.set(id, { x, y, skill, kind, synced, pool });
    Object.assign(this.world.tiles[y]![x]!, { [site]: kind, blocks: true });
  }

  /** A full site on a free spot of `pool`, picked at random: false if every spot has a site, a player, an enemy or a ground item on it. */
  private placePooledSite(pool: SitePoolState) {
    const standing = [
      ...this.world.state.players.values(),
      ...this.world.state.enemies.values(),
      ...this.world.state.groundItems.values(),
    ];
    const free = pool.spots.filter(
      (spot) =>
        !this.sites.has(siteId(spot)) &&
        !standing.some(({ x, y }) => x === spot.x && y === spot.y),
    );
    if (!free.length) return false;
    const spot = free[Math.floor(this.world.random() * free.length)]!;
    this.addSite(pool.skill, pool.kind, spot, pool);
    return true;
  }

  /** Takes a run-out pooled site off its spot, to come back somewhere in its pool after its regrow time. */
  removePooledSite(site: GatheringSite, pool: SitePoolState) {
    const { site: field, stateField } = GATHERING[site.skill];
    const id = siteId(site);
    this.sites.delete(id);
    this.world.state[stateField].delete(id);
    const tile = this.world.tiles[site.y]![site.x]!;
    delete tile[field];
    tile.blocks = groundBlocks(tile.ground);
    pool.comebackTicks.push(
      this.world.state.tick +
        gatheringSource(site.skill, site.kind).regrowTicks,
    );
  }

  /** The fewest steps from `from` to a walkable tile, walking through sites as if they had run out: undefined if nothing else is in reach. */
  nearestPastSites(from: Tile): Tile | undefined {
    const throughSites = this.world.tiles.map((row, y) =>
      row.map((tile, x) =>
        this.sites.has(siteId({ x, y })) ? { ...tile, blocks: false } : tile,
      ),
    );
    const seen = new Set([siteId(from)]);
    const queue = [from];
    // Breadth-first, so the first walkable tile found is the fewest steps away.
    for (const tile of queue) {
      if (!this.world.tiles[tile.y]![tile.x]!.blocks) return tile;
      for (const next of legalSteps(throughSites, tile)) {
        if (seen.has(siteId(next))) continue;
        seen.add(siteId(next));
        queue.push(next);
      }
    }
    return undefined;
  }

  /** Run-out sites grow back, and pooled ones come back where a spot is free. */
  advance() {
    for (const site of this.sites.values()) {
      if (this.world.state.tick !== site.regrowTick) continue;
      const { leftField } = GATHERING[site.skill];
      site.synced[leftField] = gatheringSource(site.skill, site.kind).holds;
      site.regrowTick = undefined;
    }
    // One with no free spot waits, and tries again next tick.
    for (const pool of this.pools)
      while (
        pool.comebackTicks[0]! <= this.world.state.tick &&
        this.placePooledSite(pool)
      )
        pool.comebackTicks.shift();
  }
}
