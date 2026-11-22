import {
  DELICIOUS_BUFF_INTERVAL_TICKS,
  DELICIOUS_BUFF_PERCENT,
  DELICIOUS_BUFF_TICKS,
  EAT_INTERVAL_TICKS,
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  FOOD_HEALS,
  FORTITUDE_POTION_PERCENT,
  HEALING_POOL_INTERVAL_TICKS,
  itemParts,
  potionOf,
  POTIONS,
  POTION_BUFF_TICKS,
  REGEN_INTERVAL_TICKS,
  REGEN_PERCENT_OF_MAX_HEALTH,
} from "@runic/shared";
import { maxHealthTotal, type World } from "./worldContext.ts";

/** Eating food and drinking potions, and the healing and buffs that follow (spec §6, #221, #222). */
export class Eating {
  constructor(private readonly world: World) {}

  eat(id: string, slot: number) {
    const player = this.world.state.players.get(id)!;
    const unsynced = this.world.unsyncedPlayers.get(id)!;
    const parts = itemParts(player.inventory[slot]);
    const food = FOOD_HEALS.get(parts.base);
    const potion = potionOf(parts.base);
    if (
      (food === undefined && !potion) ||
      this.world.state.tick < unsynced.nextEatTick
    )
      return;
    unsynced.nextEatTick = this.world.state.tick + EAT_INTERVAL_TICKS;
    // From now if no swing is waiting, or a past timer would swallow the delay.
    unsynced.nextSwingTick =
      Math.max(unsynced.nextSwingTick, this.world.state.tick) +
      EAT_SWING_DELAY_TICKS;
    if (--player.inventoryCounts[slot]! === 0)
      player.inventory[slot] = EMPTY_SLOT;
    // Not at full health, or a swing later this tick could save it from being lost.
    if (food && player.health < player.maxHealth) {
      unsynced.healingPool.push(
        ...Array<number>(food.ticks).fill(food.perTick),
      );
    }
    // A Delicious fish heals on its own afterwards, and another one only refreshes it (#221).
    if (parts.quality === "delicious") {
      unsynced.delicious = {
        perTick: food!.perTick,
        nextHealTick: this.world.state.tick + DELICIOUS_BUFF_INTERVAL_TICKS,
        endTick: this.world.state.tick + DELICIOUS_BUFF_TICKS,
      };
      this.world.events.push({
        type: "delicious",
        player: id,
        ticks: DELICIOUS_BUFF_TICKS,
      });
    }
    // A potion's Virtue replaces the heal: two minutes of it, refreshed never stacked (#222).
    if (potion) {
      const { virtue } = POTIONS[potion];
      unsynced.potion = {
        virtue,
        endTick: this.world.state.tick + POTION_BUFF_TICKS,
        // A Fortitude potion's quarter is worked out once, on the normal max.
        bonus:
          virtue === "fortitude"
            ? Math.round(
                (maxHealthTotal(player) * FORTITUDE_POTION_PERCENT) / 100,
              )
            : 0,
      };
      this.world.fitHealth(id);
      this.world.events.push({
        type: "potion",
        player: id,
        virtue,
        ticks: POTION_BUFF_TICKS,
      });
    }
    this.world.events.push({ type: "eaten", player: id });
  }

  /** One tick of a living player's healing: regeneration outside the lock, the healing pool, the Delicious buff, and a potion running out (spec §6, #221, #222). */
  heal(id: string, tick: number) {
    const player = this.world.player(id);
    const unsynced = this.world.unsynced(id);
    if (tick % REGEN_INTERVAL_TICKS === 0 && tick >= unsynced.lockEndTick) {
      const heals = Math.ceil(
        (player.maxHealth * REGEN_PERCENT_OF_MAX_HEALTH) / 100,
      );
      player.health = Math.min(player.health + heals, player.maxHealth);
    }
    if (
      tick % HEALING_POOL_INTERVAL_TICKS === 0 &&
      unsynced.healingPool.length > 0
    ) {
      const amount = Math.min(
        unsynced.healingPool.shift()!,
        player.maxHealth - player.health,
      );
      player.health += amount;
      if (amount > 0)
        this.world.events.push({ type: "healed", player: id, amount });
    }
    // A Delicious fish heals through a fight, where regeneration pauses (#221).
    const { delicious, potion } = unsynced;
    if (delicious) {
      if (tick >= delicious.nextHealTick) {
        delicious.nextHealTick += DELICIOUS_BUFF_INTERVAL_TICKS;
        const amount = Math.min(
          Math.round((delicious.perTick * DELICIOUS_BUFF_PERCENT) / 100),
          player.maxHealth - player.health,
        );
        player.health += amount;
        if (amount > 0)
          this.world.events.push({ type: "healed", player: id, amount });
      }
      if (tick >= delicious.endTick) unsynced.delicious = undefined;
    }
    // A potion's Virtue runs out like the Delicious buff's healing does (#222): the
    // unspent Fortitude bonus is lost, and health settles on the normal max.
    if (potion && tick >= potion.endTick) {
      unsynced.potion = undefined;
      this.world.fitHealth(id);
    }
    if (player.health === player.maxHealth) unsynced.healingPool.length = 0;
  }
}
