import {
  AUGMENTATIONS,
  FIRES,
  make,
  makeRefusal,
  makingOf,
  makingSkillOf,
  RECIPES,
  siteId,
  stationOf,
  stationRefusal,
  type MakeItem,
  type Tile,
} from "@runic/shared";
import type { QueuedAction } from "./playerActions.ts";
import type { World } from "./worldContext.ts";

/** Making at a station or over a fire: recipes and augmentations, one item or Make all (spec §4, #224, #225). */
export class Making {
  constructor(private readonly world: World) {}

  /**
   * The making a click asks for. It comes straight off the network, so anything but a
   * recipe's product or an augmentation is ignored, as is choosing an anvil recipe with no
   * hammer. `at` names the fire to cook at
   * instead of the range, and is refused unless one burns there. Level and materials wait for
   * arrival (spec §4, #225).
   */
  makeIntent(
    id: string,
    intent: { item: string; all: boolean; at?: Tile },
  ): QueuedAction | undefined {
    const player = this.world.state.players.get(id);
    const { item, all, at } = intent ?? {};
    // A string first: an array of one would pass hasOwn by turning into its element.
    if (!player || typeof item !== "string") return undefined;
    if (!Object.hasOwn(RECIPES, item) && !Object.hasOwn(AUGMENTATIONS, item))
      return undefined;
    const wanted = item as MakeItem;
    const station = stationOf(wanted);
    // `at` names the fire to make at, for a Making skill made over one (#224).
    let fire: Tile | undefined;
    if (at) {
      const { x, y } = at as Partial<Tile>;
      if (
        !makingSkillOf(wanted).places.includes("fire") ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        !this.world.state.fires.has(siteId({ x, y } as Tile))
      )
        return undefined;
      fire = { x: x!, y: y! };
    } else if (
      !this.world.stations[station] ||
      stationRefusal(station, player)
    ) {
      return undefined;
    }
    return { kind: "making", item: wanted, all: all === true, at: fire };
  }

  /** After the steps, so the first wait starts on the tick of arrival. */
  advance() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action: making } = unsynced;
      if (making?.kind !== "making" || unsynced.path.length) continue;
      // A fire can burn out mid-job, ending the cooking on it (#224).
      if (making.at && !this.world.state.fires.has(siteId(making.at))) {
        unsynced.action = undefined;
        continue;
      }
      if (making.doneTick !== undefined) {
        if (this.world.state.tick < making.doneTick) continue;
        if (!this.finishItem(id, making) || !making.all) {
          unsynced.action = undefined;
          continue;
        }
      }
      const player = this.world.state.players.get(id)!;
      const refusal = makeRefusal(making.item, player);
      if (refusal) {
        unsynced.action = undefined;
        this.world.events.push({ type: "told", player: id, line: refusal });
        continue;
      }
      const { ticks } = makingOf(making.item);
      making.doneTick = this.world.state.tick + ticks;
      this.world.events.push({
        type: "make",
        player: id,
        station: stationOf(making.item),
        ticks,
      });
    }
  }

  /** Swaps materials for the item and experience, all at once or, with a line saying why, not at all. */
  private finishItem(id: string, { item, at }: { item: MakeItem; at?: Tile }) {
    const player = this.world.state.players.get(id)!;
    // A fire burns more than the range, by the points of the log it burns (#224).
    const fire = at ? this.world.state.fires.get(siteId(at)) : undefined;
    const outcome = make(
      item,
      player,
      this.world.random,
      fire ? FIRES[fire.log].burnPercent : 0,
    );
    if ("refused" in outcome) {
      this.world.events.push({
        type: "told",
        player: id,
        line: outcome.refused,
      });
      return false;
    }
    outcome.inventory.forEach((held, i) => {
      player.inventory[i] = held;
      player.inventoryCounts[i] = outcome.inventoryCounts[i]!;
    });
    for (const [field, gained] of outcome.xp)
      this.world.earnXp(player, field, gained);
    if (outcome.told)
      this.world.events.push({ type: "told", player: id, ...outcome.told });
    if (outcome.made)
      this.world.events.push({ type: "made", player: id, item: outcome.made });
    return true;
  }
}
