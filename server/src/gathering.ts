import {
  attemptChance,
  DOUBLE_YIELD,
  EMPTY_SLOT,
  findItemOf,
  GATHERING,
  gatheringSource,
  ITEMS,
  levelFor,
  pickIntervalTicks,
  rollCatch,
  rollFinds,
  slotFor,
  type GatheringSkill,
  type ItemId,
} from "@runic/shared";
import type { GatheringSites } from "./gatheringSites.ts";
import { tilesNextTo } from "./pathfinding.ts";
import type { Quests } from "./quests.ts";
import type { SyncedPlayer, World } from "./worldContext.ts";

/** Players' gathering attempts on the sites they stand beside: what each attempt yields, and its experience. */
export class Gathering {
  constructor(
    private readonly world: World,
    private readonly sites: GatheringSites,
    private readonly quests: Quests,
  ) {}

  /** After the steps, so the first attempt lands on the tick of arrival (D5). Every skill shares one timer, so swapping between them can't beat it. */
  advance(skill: GatheringSkill) {
    const { xpField, verb, leftField } = GATHERING[skill];
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== skill || unsynced.path.length) continue;
      const player = this.world.state.players.get(id)!;
      // A pooled site that ran out is gone from its spot.
      const site = this.sites.get(action.site);
      // A site that came back may have left no way to stand next to it.
      if (
        !site ||
        this.sites.siteRefusal(site, player) ||
        !tilesNextTo(this.world.tiles, site).some(
          ({ x, y }) => x === player.x && y === player.y,
        )
      ) {
        unsynced.action = undefined;
        continue;
      }
      if (this.world.state.tick < unsynced.nextAttemptTick) continue;
      const level = levelFor(player[xpField]);
      unsynced.nextAttemptTick =
        this.world.state.tick + pickIntervalTicks(level);
      const source = gatheringSource(skill, site.kind);
      const success = this.world.random() < attemptChance(source.level, level);
      const count: 1 | 2 =
        success &&
        source.doubleChance !== undefined &&
        this.world.random() < source.doubleChance
          ? DOUBLE_YIELD
          : 1;
      const finds = success
        ? [
            ...rollFinds(source, this.world.random).map((found) =>
              findItemOf(found, player.identifiesEssence),
            ),
            ...(skill === "mining"
              ? this.quests.questVeinFinds(id, site.kind)
              : []),
          ]
        : [];
      this.world.events.push(
        success
          ? { type: verb, player: id, success, count, finds }
          : { type: verb, player: id, success },
      );
      if (!success) continue;
      // An essence rock's own item is essence, unmasked like a find for a player who identifies it.
      const caught = rollCatch(source, level, this.world.random);
      const item = findItemOf(caught.item, player.identifiesEssence);
      const { xp } = caught;
      this.world.earnXp(player, xpField, xp);
      // Room is counted before either lands, so the second ore goes on the
      // ground, owned by the miner, when the first took the last of it.
      const room = this.roomFor(item, player);
      for (let i = 0; i < count; i++) {
        if (i < room) this.addToSlot(player, slotFor(item, player), item);
        else
          this.world.groundItems.spawn(
            player,
            item,
            1,
            player.username,
            this.world.state.tick,
          );
      }
      // Each find rolls on its own; one with no room goes to the ground, owned
      // by the miner, like the second ore.
      for (const found of finds) {
        if (this.roomFor(found, player) > 0)
          this.addToSlot(player, slotFor(found, player), found);
        else
          this.world.groundItems.spawn(
            player,
            found,
            1,
            player.username,
            this.world.state.tick,
          );
      }
      if (--site.synced[leftField]! === 0) {
        if (site.pool) this.sites.removePooledSite(site, site.pool);
        else {
          site.regrowTick = this.world.state.tick + source.regrowTicks;
          this.world.tiles[site.y]![site.x]!.runOut = true;
        }
      }
      unsynced.action = undefined;
    }
  }

  /** Adds one `item` to the slot `slotFor` chose. */
  private addToSlot(player: SyncedPlayer, slot: number, item: string) {
    player.inventory[slot] = item;
    player.inventoryCounts[slot]!++;
  }

  /** How many more of `item` fit: spaces in its stacks, plus one per empty slot. Counted before any land, so a double with a single free slot and no stack leaves its second ore on the ground (#152). */
  private roomFor(item: ItemId, player: SyncedPlayer) {
    let room = 0;
    player.inventory.forEach((held, slot) => {
      if (held === EMPTY_SLOT) room++;
      else if (held === item)
        room += ITEMS[item].stack - player.inventoryCounts[slot]!;
    });
    return room;
  }
}
