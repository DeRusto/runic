import {
  ENEMIES,
  type EnemyKind,
  type LootCategoryRow,
  type LootItem,
} from "./enemies.ts";
import { armourPercentOf, type GearSlot } from "./gear.ts";
import {
  BLOCKING_XP_PER_BLOCK,
  DEFENSE_XP_PER_DAMAGE_TAKEN,
  DEFENSE_XP_PER_ENEMY_SWING,
  HEALTH_PER_HITPOINTS_LEVEL,
  PLAYER_CRIT_CHANCE,
  PLAYER_CRIT_MULTIPLIER,
  XP_PER_DAMAGE_DEALT,
} from "./index.ts";
import type { XpField } from "./skills.ts";
import { avoidanceOf, blockOf, enemyHitChance, hitOf } from "./stats.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** The damage of one swing, 0 for a miss: a hit is any whole number from 100 to `maxDamage`. */
function rollDamage(
  hitChance: number,
  maxDamage: number,
  random: () => number,
) {
  const min = HEALTH_PER_HITPOINTS_LEVEL;
  return random() < hitChance
    ? min + Math.floor(random() * (maxDamage - min + 1))
    : 0;
}

/**
 * One player swing at an enemy with `enemyHealth` left. Rolls the hit, its damage, then a
 * critical. `mightBonus` is a Might potion's, added to the hit like the weapon's while its buff
 * lasts (#222). No experience for overkill: the damage is capped at the enemy's health.
 */
export function playerHit(
  player: { combatXp: number } & Worn,
  mightBonus: number,
  enemyHealth: number,
  random: () => number,
) {
  const { chance, max, gear } = hitOf(player);
  const rolled = rollDamage(chance, max, random);
  // Only on a hit, as 0 means a miss.
  const hit = rolled && rolled + gear + mightBonus;
  const critical = hit > 0 && random() < PLAYER_CRIT_CHANCE;
  const damage = Math.min(
    critical ? Math.round(hit * PLAYER_CRIT_MULTIPLIER) : hit,
    enemyHealth,
  );
  const xp = Math.round(
    (damage * XP_PER_DAMAGE_DEALT) / HEALTH_PER_HITPOINTS_LEVEL,
  );
  return {
    damage,
    critical,
    xp: [
      ["combatXp", xp],
      ["hitpointsXp", xp],
    ] as [XpField, number][],
  };
}

/**
 * One enemy swing at a player. Rolls the hit against the player's Avoidance plus
 * `avoidanceBonus` (an Avoidance potion's, #222), then a block. `hit` is whether it hit at all,
 * blocked or not. Armour never turns a landed hit into 0, and the health cap comes after it.
 */
export function enemyHit(
  kind: EnemyKind,
  player: { defenseXp: number; blockingXp: number; health: number } & Worn,
  avoidanceBonus: number,
  random: () => number,
) {
  const avoidance = avoidanceOf(player);
  const rolled = rollDamage(
    enemyHitChance(kind, avoidance.skill + avoidance.gear + avoidanceBonus),
    ENEMIES[kind].maxDamage,
    random,
  );
  const block = blockOf(player);
  const blocked =
    rolled > 0 && !!block && random() < block.shield + block.skill;
  const landed = blocked ? 0 : rolled;
  const armoured =
    landed &&
    Math.max(1, Math.round((landed * (100 - armourPercentOf(player))) / 100));
  // From the hit before armour, so better armour doesn't slow Defense training.
  const defenseXp = Math.round(
    DEFENSE_XP_PER_ENEMY_SWING +
      (Math.min(landed, player.health) * DEFENSE_XP_PER_DAMAGE_TAKEN) /
        HEALTH_PER_HITPOINTS_LEVEL,
  );
  const xp: [XpField, number][] = [
    ...(blocked
      ? [["blockingXp", BLOCKING_XP_PER_BLOCK] as [XpField, number]]
      : []),
    ["defenseXp", defenseXp],
  ];
  return {
    damage: Math.min(armoured, player.health),
    blocked,
    hit: rolled > 0,
    xp,
  };
}

/** One item of loot one player won. */
export type LootWon = { player: string; item: LootItem["item"]; count: number };

/** A whole number from `min` to `max`, inclusive; no roll when they match. */
const rollBetween = (min: number, max: number, random: () => number) =>
  min === max ? min : min + Math.floor(random() * (max - min + 1));

/** One item from a category, by weight; no roll for a category of one. */
function pick(items: readonly LootItem[], random: () => number) {
  if (items.length === 1) return items[0]!;
  const total = items.reduce((sum, { weight = 1 }) => sum + weight, 0);
  let left = random() * total;
  for (const item of items) {
    left -= item.weight ?? 1;
    if (left < 0) return item;
  }
  return items[items.length - 1]!;
}

/**
 * What each damager wins from a loot table, such as a dead enemy's: each player rolls the whole table, in
 * table order. Each of a category's picks rolls its chance, then an item by weight, then a count
 * from its range. A certain outcome (a chance of 1, one item, a fixed count) takes no roll, so
 * tables that change nothing replay the same rolls.
 */
export function rollLoot(
  table: readonly LootCategoryRow[],
  damagers: Iterable<string>,
  random: () => number,
): LootWon[] {
  const won: LootWon[] = [];
  for (const player of damagers)
    for (const { chance, picks = 1, items } of table)
      for (let i = 0; i < picks; i++) {
        if (chance < 1 && random() >= chance) continue;
        const { item, count = 1 } = pick(items, random);
        const [min, max] = typeof count === "number" ? [count, count] : count;
        won.push({ player, item, count: rollBetween(min, max, random) });
      }
  return won;
}
