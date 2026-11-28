import {
  AMMO_RECOVERY_CHANCE,
  atRangeOf,
  attackRefusal,
  ENEMIES,
  enemyHit,
  FIGHT_BACK_DELAY_TICKS,
  GEAR_SLOTS,
  canShootAt,
  wornCountOf,
  isRangedStance,
  isStance,
  magicHit,
  PLAYER_DEAD_TICKS,
  playerHit,
  OUT_OF_KNIVES_LINE,
  playerStyleOf,
  rangedHit,
  rangedWeaponOf,
  respawnTile,
  SWING_INTERVAL_TICKS,
  type Style,
} from "@runic/shared";
import { attackBoostsOf, avoidanceBoostOf } from "./boosts.ts";
import { canBeHit } from "./busy.ts";
import { spendRunes } from "./casting.ts";
import { dropFromSlot } from "./dropping.ts";
import { spendArrow, spendKnife, wear } from "./gear.ts";
import type { Enemies, Enemy } from "./enemies.ts";
import { nextTo } from "./pathfinding.ts";
import { placeLootOf } from "./loot.ts";
import { lostWeaponFor } from "./playerActions.ts";
import { endPrayers } from "./prayers.ts";
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

  /**
   * Comes straight off the network, so anything but a stance is ignored. A melee stance and a
   * Ranged stance each set their own style's, so each style keeps its own (Ranged spec §6).
   * Like pins, it skips the queue: the next swing or shot reads it.
   */
  setStance(id: string, stance: string) {
    if (this.world.isCrossing(id)) return;
    const player = this.world.state.players.get(id);
    if (!player) return;
    if (isStance(stance)) player.stance = stance;
    else if (isRangedStance(stance)) player.rangedStance = stance;
  }

  /** After the moves, so the first swing or shot lands on the tick the player arrives. */
  advancePlayerSwings() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "fighting") continue;
      const player = this.world.state.players.get(id)!;
      const enemy = this.world.state.enemies.get(action.enemy)!;
      if (this.world.state.tick < unsynced.nextSwingTick) continue;
      // Rechecked before every attack, so nothing is spent on a gone target or a bow or staff
      // taken off (#277).
      if (enemy.state === "dead" || lostWeaponFor(action, player)) {
        this.world.clearAction(id);
        continue;
      }
      // Before reach and sight, so arrows or runes taken off on the way stop the attack once an attack falls due.
      if (this.stopForRefusal(id, player)) continue;
      const atRange = atRangeOf(player);
      if (
        atRange
          ? !canShootAt(this.world.tiles, player, enemy, atRange.reachTiles)
          : !nextTo(this.world.tiles, player, enemy)
      )
        continue;
      unsynced.nextSwingTick =
        this.world.state.tick +
        (atRange?.intervalTicks ?? SWING_INTERVAL_TICKS);
      this.playerSwing(id, player, action.enemy, enemy, playerStyleOf(player));
    }
  }

  /** Ends the attack and tells the player why, if the weapon in hand can't attack: a bow with no arrows, or a staff with no spell or runes (Ranged spec §4, Magic spec §5). */
  private stopForRefusal(id: string, player: SyncedPlayer) {
    const refusal = attackRefusal(player);
    if (!refusal) return false;
    this.stop(id, refusal);
    return true;
  }

  private stop(id: string, line: string) {
    this.world.clearAction(id);
    this.world.tell(id, line);
  }

  /** One swing, one ranged attack, which spends an arrow or a knife, or one cast, which spends its runes, each hit or miss (Ranged spec §4, §5, Magic spec §5). */
  private playerSwing(
    id: string,
    player: SyncedPlayer,
    enemyId: string,
    enemy: InstanceType<typeof Enemy>,
    style: Style,
  ) {
    const ranged = rangedWeaponOf(player);
    this.world.lock(id);
    const { might, accuracy } = attackBoostsOf(this.world, id);
    // The enemy's fixed style is the target's side of the combat triangle; the weapon in hand,
    // read now, picks the shot or the swing and so the player's side (#271).
    const against = ENEMIES[enemy.kind].style;
    const { random } = this.world;
    const { damage, critical, xp } =
      style === "magic"
        ? magicHit(player, against, might, enemy.health, random, accuracy)
        : ranged
          ? rangedHit(player, against, might, enemy.health, random, accuracy)
          : playerHit(
              player,
              player.stance,
              against,
              might,
              enemy.health,
              random,
              accuracy,
            );
    for (const [field, gained] of xp) this.world.earnXp(player, field, gained);
    this.world.fitHealth(id);
    this.world.events.push({
      type: "playerSwing",
      player: id,
      enemy: enemyId,
      damage,
      critical,
      ...(ranged?.thrown ? { weapon: player.weapon } : {}),
    });
    // A landed shot against a living enemy deals positive damage.
    if (ranged && damage === 0 && this.world.random() < AMMO_RECOVERY_CHANCE) {
      this.world.groundItems.recoverAmmo(
        enemy,
        ranged.thrown ? player.weapon : player.ammo,
        player.username,
        this.world.state.tick,
      );
    }
    // With none left, it stops now and says so; the enemy fights on as usual. The last knife
    // leaves the hand empty, and the attack ends rather than turning into a punch (#279).
    if (ranged?.thrown) {
      if (!spendKnife(this.world, id)) {
        this.stop(id, OUT_OF_KNIVES_LINE);
        this.world.unsynced(id).ranDryAgainst = enemyId;
      }
    } else if (ranged && !spendArrow(this.world, id)) {
      this.stopForRefusal(id, player);
    } else if (style === "magic") {
      spendRunes(this.world, id);
      this.stopForRefusal(id, player);
    }
    const loot = this.enemies.takeHit(
      this.world.state.tick,
      enemyId,
      id,
      damage,
      player,
    );
    if (!loot) return;
    this.world.events.push({ type: "enemyDied", enemy: enemyId });
    placeLootOf(this.world, this.quests, enemy, loot);
    for (const unsynced of this.world.unsyncedPlayers.values()) {
      if (unsynced.ranDryAgainst === enemyId)
        unsynced.ranDryAgainst = undefined;
      const { action } = unsynced;
      if (action?.kind !== "fighting" || action.enemy !== enemyId) continue;
      unsynced.action = undefined;
      unsynced.path = [];
    }
  }

  /** Every enemy's moves and swings; a busy player who can't be hit is left alone (#236). */
  advanceEnemies() {
    const { tick } = this.world.state;
    this.enemies.advance({
      tick,
      players: () =>
        [...this.world.unsyncedPlayers].map(([id, { dropped, busy }]) => ({
          id,
          player: this.world.player(id),
          dropped: !!dropped,
          hittable: canBeHit(busy, tick),
        })),
      player: (id) => this.world.state.players.get(id),
      swing: (enemyId, playerId) => {
        if (canBeHit(this.world.unsyncedPlayers.get(playerId)?.busy, tick))
          this.enemySwing(enemyId, playerId);
      },
    });
  }

  /** A swing an enemy is due, rolled against the player's Avoidance and shield, then applied. */
  private enemySwing(enemyId: string, playerId: string) {
    const enemy = this.world.state.enemies.get(enemyId)!;
    const player = this.world.state.players.get(playerId)!;
    this.world.lock(playerId);
    const avoidance = avoidanceBoostOf(this.world, playerId);
    const { damage, blocked, critical, hit, xp } = enemyHit(
      enemy.kind,
      player,
      avoidance,
      this.world.random,
      enemy.elite,
    );
    player.health -= damage;
    for (const [field, gained] of xp) this.world.earnXp(player, field, gained);
    this.world.events.push({
      type: "enemySwing",
      enemy: enemyId,
      player: playerId,
      damage,
      blocked,
      critical,
    });
    if (hit) this.windows.hit(playerId);
    if (player.health === 0) this.die(playerId, player);
    else if (player.action === "") this.fightBack(playerId, player, enemyId);
  }

  /** An action of "" is idle, but a dropped player has gone and shouldn't fight (spec D5). */
  private fightBack(id: string, player: SyncedPlayer, enemyId: string) {
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    if (unsynced.dropped || this.world.isBusy(id)) return;
    // A bow with nothing to fire stays idle, as does a staff with no spell or runes and a hand
    // its last knife left, against that enemy until the player's next order; the chat said so
    // when they ran out (#279).
    if (attackRefusal(player) || unsynced.ranDryAgainst === enemyId) return;
    unsynced.action = {
      kind: "fighting",
      enemy: enemyId,
      style: playerStyleOf(player),
    };
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
    player.inventory.forEach((_, slot) => dropFromSlot(this.world, id, slot));
    for (const gearSlot of GEAR_SLOTS) {
      const worn = player[gearSlot];
      if (!worn) continue;
      // A stacking slot drops its whole stack as one ground item (Ranged spec §2).
      this.world.groundItems.spawn(
        player,
        worn,
        wornCountOf(player, gearSlot),
        player.username,
        this.world.state.tick,
      );
      wear(player, gearSlot, "", 0);
    }
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    unsynced.ranDryAgainst = undefined;
    unsynced.healingPool.length = 0;
    unsynced.delicious = undefined;
    unsynced.potion = undefined;
    unsynced.busy = undefined;
    endPrayers(player);
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
