import {
  AVOIDANCE_POTION_POINTS,
  ENEMIES,
  enemyHit,
  FIGHT_BACK_DELAY_TICKS,
  GEAR_SLOTS,
  itemTag,
  MIGHT_POTION_HIT,
  PLAYER_DEAD_TICKS,
  playerHit,
  respawnTile,
  SWING_INTERVAL_TICKS,
  type LootWon,
  type Tile,
} from "@runic/shared";
import type { Enemies, Enemy } from "./enemies.ts";
import { nextTo } from "./pathfinding.ts";
import type { Quests } from "./quests.ts";
import type { VillagerWindows } from "./villagerWindows.ts";
import type { SyncedPlayer, World } from "./worldContext.ts";

/** Players' swings at enemies and enemies' at players, loot, and death and respawn. Enemies decide for themselves when to swing; this applies what each swing does. */
export class Fighting {
  constructor(
    private readonly world: World,
    private readonly enemies: Enemies,
    private readonly windows: VillagerWindows,
    private readonly quests: Quests,
  ) {}

  /** After the moves, so the first swing lands on the tick the player arrives. */
  advancePlayerSwings() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "fighting") continue;
      const player = this.world.state.players.get(id)!;
      const enemy = this.world.state.enemies.get(action.enemy)!;
      if (this.world.state.tick < unsynced.nextSwingTick) continue;
      if (!nextTo(this.world.tiles, player, enemy)) continue;
      unsynced.nextSwingTick = this.world.state.tick + SWING_INTERVAL_TICKS;
      this.playerSwing(id, player, action.enemy, enemy);
    }
  }

  private playerSwing(
    id: string,
    player: SyncedPlayer,
    enemyId: string,
    enemy: InstanceType<typeof Enemy>,
  ) {
    this.world.lock(id);
    // A Might potion adds to the hit like the sword bonus does, while its buff lasts (#222).
    const might =
      this.world.unsyncedPlayers.get(id)!.potion?.virtue === "might"
        ? MIGHT_POTION_HIT
        : 0;
    const { damage, critical, xp } = playerHit(
      player,
      might,
      enemy.health,
      this.world.random,
    );
    for (const [field, gained] of xp) this.world.earnXp(player, field, gained);
    this.world.fitHealth(id);
    this.world.events.push({
      type: "playerSwing",
      player: id,
      enemy: enemyId,
      damage,
      critical,
    });
    const loot = this.enemies.takeHit(
      this.world.state.tick,
      enemyId,
      id,
      damage,
    );
    if (!loot) return;
    this.world.events.push({ type: "enemyDied", enemy: enemyId });
    // A quest-category drop lands only for a winner whose quest stage still asks for it.
    const questLoot = new Set(
      ENEMIES[enemy.kind].loot
        .filter(({ category }) => category === "quest")
        .flatMap(({ items }) => items.map(({ item }) => item)),
    );
    for (const won of loot)
      if (
        !questLoot.has(won.item) ||
        this.quests.questWants(won.player, won.item)
      )
        this.placeLoot(enemy, won);
    for (const unsynced of this.world.unsyncedPlayers.values()) {
      const { action } = unsynced;
      if (action?.kind !== "fighting" || action.enemy !== enemyId) continue;
      unsynced.action = undefined;
      unsynced.path = [];
    }
  }

  /** One winner's loot, on the enemy's tile and theirs for the first minute, with a line saying so. */
  private placeLoot(at: Tile, { player: id, item, count }: LootWon) {
    const { username } = this.world.state.players.get(id)!;
    this.world.groundItems.spawn(
      at,
      item,
      count,
      username,
      this.world.state.tick,
    );
    // shortcut: a vowel letter stands for a vowel sound, which holds for every loot item today; upgrade if one starts otherwise.
    const amount =
      count > 1 ? String(count) : /^[aeiou]/i.test(item) ? "an" : "a";
    this.world.events.push({
      type: "told",
      player: id,
      line: `You find ${amount} ${itemTag(item)}. It is on the ground.`,
      items: [item],
    });
  }

  /** A swing an enemy is due, rolled against the player's Avoidance and shield, then applied. */
  enemySwing(enemyId: string, playerId: string) {
    const enemy = this.world.state.enemies.get(enemyId)!;
    const player = this.world.state.players.get(playerId)!;
    this.world.lock(playerId);
    // Worn Avoidance and a potion's point add up per the Virtue rules (#222).
    const avoidance =
      this.world.unsyncedPlayers.get(playerId)!.potion?.virtue === "avoidance"
        ? AVOIDANCE_POTION_POINTS
        : 0;
    const { damage, blocked, hit, xp } = enemyHit(
      enemy.kind,
      player,
      avoidance,
      this.world.random,
    );
    player.health -= damage;
    for (const [field, gained] of xp) this.world.earnXp(player, field, gained);
    this.world.events.push({
      type: "enemySwing",
      enemy: enemyId,
      player: playerId,
      damage,
      blocked,
    });
    if (hit) this.windows.hit(playerId);
    if (player.health === 0) this.die(playerId, player);
    else if (player.action === "") this.fightBack(playerId, player, enemyId);
  }

  /** An action of "" is idle, but a dropped player has gone and shouldn't fight (spec D5). */
  private fightBack(id: string, player: SyncedPlayer, enemyId: string) {
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    if (unsynced.dropped || this.world.isBusy(id)) return;
    unsynced.action = { kind: "fighting", enemy: enemyId };
    unsynced.nextSwingTick = Math.max(
      unsynced.nextSwingTick,
      this.world.state.tick + FIGHT_BACK_DELAY_TICKS,
    );
    // Now, as a second enemy swinging this tick must find them busy.
    Object.assign(player, { target: enemyId, action: "fighting" });
  }

  die(id: string, player: SyncedPlayer) {
    player.dead = true;
    this.world.clearAction(id);
    this.world.stopFollowersOf(id);
    // Drop on death (#119): the Toolbelt stays.
    player.inventory.forEach((_, slot) => this.world.dropSlot(id, slot));
    for (const gearSlot of GEAR_SLOTS) {
      const worn = player[gearSlot];
      if (!worn) continue;
      this.world.groundItems.spawn(
        player,
        worn,
        1,
        player.username,
        this.world.state.tick,
      );
      player[gearSlot] = "";
    }
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    unsynced.healingPool.length = 0;
    unsynced.delicious = undefined;
    unsynced.potion = undefined;
    unsynced.busy = undefined;
    this.world.fitHealth(id);
    unsynced.respawnTick = this.world.state.tick + PLAYER_DEAD_TICKS;
    this.world.events.push({ type: "playerDied", player: id });
  }

  /** What dying changes, once it's over. */
  respawned(player: SyncedPlayer) {
    return { ...respawnTile(this.world.tiles), health: player.maxHealth };
  }

  /** Brings a dead player back on the respawn tile once their death is over. */
  respawnIfDue(id: string) {
    const player = this.world.player(id);
    const unsynced = this.world.unsynced(id);
    if (this.world.state.tick < unsynced.respawnTick) return;
    Object.assign(player, this.respawned(player), { dead: false });
    unsynced.lockEndTick = 0;
    this.world.events.push({ type: "playerRespawned", player: id });
  }
}
