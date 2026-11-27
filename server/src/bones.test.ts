import {
  GROUND_ITEM_OWNER_TICKS,
  itemName,
  parseRegion,
  type EnemyKind,
} from "@runic/shared";
import { expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;
const SWING = [0, 0, MISS];

const SAVE: PlayerSave = {
  x: 7,
  y: 1,
  defenseXp: 0,
  herblawXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  inventory: Array<string>(30).fill(""),
};

function fight(kind: EnemyKind, players: number, lootRolls: number[]) {
  const rolls: number[] = [];
  const region = parseRegion("TTTTTTTTTTT\nTR........T\nTTTTTTTTTTT");
  region[1]![8] = { ...region[1]![8]!, enemy: kind };
  const simulation = new Simulation(region, () => rolls.shift() ?? MISS);
  simulation.addPlayer("a", SAVE, "a");
  simulation.queueTarget("a", "0");
  if (players === 2) {
    simulation.addPlayer("b", { ...SAVE, x: 9 }, "b");
    simulation.queueTarget("b", "0");
  }
  const enemy = simulation.state.enemies.get("0")!;
  enemy.health = players * 100;
  rolls.push(...SWING, ...(players === 2 ? SWING : []), ...lootRolls);
  simulation.tick();
  expect(enemy.state).toBe("dead");
  return simulation;
}

const groundItems = (s: Simulation) => [...s.state.groundItems.values()];

test.each([
  ["Skeleton", "skeleton", "bones", "emberbone", [0]],
  ["Skeleton Mage", "skeletonMage", "heavyBones", undefined, [0]],
  ["Tarn Ox", "tarnOx", "bones", "tarnHide", []],
  ["Bristleback", "bristleback", "bones", "bristleHide", []],
  ["Cinderhorn", "cinderhorn", "heavyBones", "cinderHide", []],
] as const)(
  "%s leaves its bone kind with a two-in-three chance",
  (_, tile, bone, other, rolls) => {
    for (const boneRoll of [2 / 3 - 0.0001, 2 / 3]) {
      const s = fight(tile, 1, [...rolls, boneRoll]);
      const expected = [
        ...(other ? [other] : []),
        ...(boneRoll < 2 / 3 ? [bone] : []),
      ].map((item) => ({ item, count: 1, owner: "a", x: 8, y: 1 }));
      expect(
        groundItems(s).map(({ item, count, owner, x, y }) => ({
          item,
          count,
          owner,
          x,
          y,
        })),
      ).toEqual(expected);
    }
  },
);

test("each damager rolls for their own bones and only the winner sees the drop for a minute", () => {
  for (const [a, b, winner, other] of [
    [0, MISS, "a", "b"],
    [MISS, 0, "b", "a"],
  ] as const) {
    const s = fight("skeleton", 2, [MISS, a, MISS, b]);
    expect(groundItems(s)).toEqual([
      expect.objectContaining({
        item: "bones",
        owner: winner,
        x: 8,
        y: 1,
        count: 1,
      }),
    ]);
    expect(s.events.filter((event) => event.type === "told")).toEqual([
      expect.objectContaining({
        player: winner,
        line: "You find [Bones]. It is on the ground.",
      }),
    ]);
    const [id] = s.state.groundItems.keys();
    expect(s.canSee(winner, id!)).toBe(true);
    for (let i = 0; i < GROUND_ITEM_OWNER_TICKS - 1; i++) s.tick();
    expect(s.canSee(other, id!)).toBe(false);
    s.tick();
    expect(s.canSee(other, id!)).toBe(true);
  }
});

test.each(["a", "b"])(
  "both Fenwing damagers get feathers and %s wins their own bone roll",
  (winner) => {
    const low = 2 / 3 - 0.0001;
    const high = 2 / 3;
    const s = fight("fenwing", 2, [
      0,
      winner === "a" ? low : high,
      MISS,
      winner === "b" ? low : high,
    ]);
    const drops = [...s.state.groundItems];
    expect(drops.map(([, drop]) => drop)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item: "feather",
          count: 3,
          owner: "a",
          x: 8,
          y: 1,
        }),
        expect.objectContaining({
          item: "feather",
          count: 6,
          owner: "b",
          x: 8,
          y: 1,
        }),
        expect.objectContaining({
          item: "bones",
          count: 1,
          owner: winner,
          x: 8,
          y: 1,
        }),
      ]),
    );
    expect(drops).toHaveLength(3);
    for (let i = 0; i < GROUND_ITEM_OWNER_TICKS - 1; i++) s.tick();
    for (const [id, drop] of drops) {
      expect(s.canSee(drop.owner, id)).toBe(true);
      expect(s.canSee(drop.owner === "a" ? "b" : "a", id)).toBe(false);
    }
    s.tick();
    for (const [id] of drops) {
      expect(s.canSee("a", id)).toBe(true);
      expect(s.canSee("b", id)).toBe(true);
    }
  },
);

test.each([
  ["spider", ["spiderSilk"]],
  ["imp", []],
] as const)("%s leaves no bones even on a winning roll", (kind, expected) => {
  expect(groundItems(fight(kind, 1, [0, 0])).map(({ item }) => item)).toEqual(
    expected,
  );
});

test.each([
  ["bones", "Bones"],
  ["heavyBones", "Heavy bones"],
] as const)(
  "%s has its own name and stacks when withdrawn, banked and saved",
  (item, name) => {
    const region = parseRegion("TTTTTT\nTR.$.T\nTTTTTT");
    const s = new Simulation(region, () => MISS);
    const inventory = [...SAVE.inventory];
    inventory[0] = item;
    s.addPlayer("a", {
      ...SAVE,
      x: 2,
      inventory,
      inventoryCounts: [19],
      bank: [item],
      bankCounts: [2],
    });
    s.queueVisit("a", "aldous", "openBank");
    s.tick();
    s.withdraw("a", 0, 2);
    expect(itemName(item)).toBe(name);
    const player = s.state.players.get("a")!;
    expect([...player.inventory].slice(0, 2)).toEqual([item, item]);
    expect([...player.inventoryCounts].slice(0, 2)).toEqual([20, 1]);
    s.depositInventory("a");
    expect(player.bank[0]).toBe(item);
    expect(player.bankCounts[0]).toBe(21);
    expect(player.inventory[0]).toBe("");
    const saved = s.saveOf("a")!;
    s.removePlayer("a");
    s.addPlayer("a", saved);
    expect(s.state.players.get("a")!.bank[0]).toBe(item);
    expect(s.state.players.get("a")!.bankCounts[0]).toBe(21);
  },
);
