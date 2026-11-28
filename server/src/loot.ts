import { ENEMIES, itemTag, type LootWon, type Tile } from "@runic/shared";
import type { Enemy } from "./enemies.ts";
import type { Quests } from "./quests.ts";
import type { World } from "./worldContext.ts";

/** Places a dead enemy's loot; a quest-category drop lands only for a winner whose quest stage still asks for it. */
export function placeLootOf(
  world: World,
  quests: Quests,
  enemy: InstanceType<typeof Enemy>,
  loot: LootWon[],
) {
  const questLoot = new Set(
    ENEMIES[enemy.kind].loot
      .filter(({ category }) => category === "quest")
      .flatMap(({ items }) => items.map(({ item }) => item)),
  );
  for (const won of loot)
    if (!questLoot.has(won.item) || quests.questWants(won.player, won.item))
      placeLoot(world, enemy, won);
}

/** One winner's loot, on the enemy's tile and theirs for the first minute, with a line saying so. */
function placeLoot(
  world: World,
  at: Tile,
  { player: id, item, count }: LootWon,
) {
  const { username } = world.state.players.get(id)!;
  world.groundItems.spawn(at, item, count, username, world.state.tick);
  // shortcut: a vowel letter stands for a vowel sound, which holds for every loot item today; upgrade if one starts otherwise.
  const amount =
    count > 1 ? String(count) : /^[aeiou]/i.test(item) ? "an" : "a";
  const found =
    item === "bones" || item === "heavyBones"
      ? itemTag(item)
      : `${amount} ${itemTag(item)}`;
  world.events.push({
    type: "told",
    player: id,
    line: `You find ${found}. It is on the ground.`,
    items: [item],
  });
}
