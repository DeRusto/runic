import { INVENTORY_SLOTS, parseRegion } from "@runic/shared";
import { expect, test, vi } from "vitest";
import { Simulation } from "./simulation.ts";

const OX = ["TTTTTTTTTT", "TR...X...T", "TTTTTTTTTT"];
const BOW = {
  weapon: "birchBow",
  weaponCount: 1,
  ammo: "copperArrow",
  ammoCount: 1,
};
const KNIVES = { weapon: "copperThrowingKnife", weaponCount: 1 };

/** Alice starts in reach of a docile Tarn Ox by default. Once scripted rolls run out, 0.99 misses and loses the ammo. */
function shooter(gear: typeof BOW | typeof KNIVES, rolls: number[], rows = OX) {
  const random = vi.fn(() => rolls.shift() ?? 0.99);
  const sim = new Simulation(parseRegion(rows.join("\n")), random);
  sim.addPlayer(
    "a",
    {
      x: 1,
      y: 1,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 1000,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
      ...gear,
    },
    "alice",
  );
  return { sim, random };
}

const drops = (sim: Simulation) =>
  [...sim.state.groundItems.values()].map(({ x, y, item, count, owner }) => ({
    x,
    y,
    item,
    count,
    owner,
  }));

test.each([
  { gear: BOW, item: "copperArrow" },
  { gear: KNIVES, item: "copperThrowingKnife" },
])(
  "a missed $item is recoverable on one side of the half-chance boundary",
  ({ gear, item }) => {
    const recovered = shooter(gear, [0.99, 0.499]);
    recovered.sim.queueTarget("a", "0");
    recovered.sim.tick();
    expect(recovered.random).toHaveBeenCalledTimes(2);
    expect(drops(recovered.sim)).toEqual([
      { x: 5, y: 1, item, count: 1, owner: "alice" },
    ]);

    const lost = shooter(gear, [0.99, 0.5]);
    lost.sim.queueTarget("a", "0");
    lost.sim.tick();
    expect(lost.random).toHaveBeenCalledTimes(2);
    expect(drops(lost.sim)).toEqual([]);
  },
);

const advanceTo = (sim: Simulation, tick: number) => {
  while (sim.state.tick < tick) sim.tick();
};

test("a hit spends the arrow without rolling for recovery", () => {
  const { sim, random } = shooter(
    BOW,
    [0, 0, 0.99, 0],
    ["TTTTTTTTTT", "TR....S..T", "TTTTTTTTTT"],
  );
  sim.queueTarget("a", "0");
  sim.tick();
  expect(sim.events).toContainEqual(
    expect.objectContaining({ type: "playerSwing", damage: 200 }),
  );
  expect(sim.state.players.get("a")!.ammoCount).toBe(0);
  expect(random).toHaveBeenCalledTimes(3);
  expect(drops(sim)).toEqual([]);
});

test("walking away before the shot fires spends no ammo and makes no rolls", () => {
  const { sim, random } = shooter(
    BOW,
    [0.99, 0],
    ["TTTTTTTTTTTT", "TR........XT", "TTTTTTTTTTTT"],
  );
  sim.queueTarget("a", "0");
  sim.tick();
  sim.queueWalk("a", { x: 1, y: 1 });
  advanceTo(sim, 10);
  expect(sim.state.players.get("a")!.ammoCount).toBe(1);
  expect(random).not.toHaveBeenCalled();
  expect(drops(sim)).toEqual([]);
});

test("a recovered arrow lands where the moving enemy was when the shot resolved", () => {
  const rolls: number[] = [];
  const { sim } = shooter({ ...BOW, ammoCount: 2 }, rolls, [
    "TTTTTTTTTT",
    "TR...S...T",
    "TTTTTTTTTT",
  ]);
  sim.queueTarget("a", "0");
  const enemy = sim.state.enemies.get("0")!;
  const startX = enemy.x;
  advanceTo(sim, 8);
  const shotX = enemy.x;
  expect(shotX).not.toBe(startX);
  rolls.push(0.99, 0);
  sim.tick();
  expect(drops(sim)).toEqual([
    { x: shotX, y: 1, item: "copperArrow", count: 1, owner: "alice" },
  ]);
});

test("recovering a second arrow resets the same stack's owner and despawn timers", () => {
  const { sim } = shooter({ ...BOW, ammoCount: 2 }, [0.99, 0, 0.99, 0]);
  sim.addPlayer("b", undefined, "bob");
  sim.queueTarget("a", "0");
  sim.tick();
  const id = [...sim.state.groundItems.keys()][0]!;
  advanceTo(sim, 9);
  expect([...sim.state.groundItems.keys()]).toEqual([id]);
  expect(sim.state.groundItems.get(id)!.count).toBe(2);
  advanceTo(sim, 208);
  expect(sim.canSee("a", id)).toBe(true);
  expect(sim.canSee("b", id)).toBe(false);
  sim.tick();
  expect(sim.canSee("b", id)).toBe(true);
  advanceTo(sim, 608);
  expect(sim.state.groundItems.has(id)).toBe(true);
  sim.tick();
  expect(sim.state.groundItems.has(id)).toBe(false);
});

test("an arrow recovered on the tick an older stack goes public starts a fresh stack", () => {
  const { sim } = shooter({ ...BOW, ammoCount: 2 }, [0.99, 0, 0.99, 0]);
  sim.queueTarget("a", "0");
  sim.tick();
  sim.queueWalk("a", { x: 1, y: 1 });
  advanceTo(sim, 200);
  sim.queueTarget("a", "0");
  sim.tick();
  expect(drops(sim)).toMatchObject([
    { item: "copperArrow", count: 1, owner: "" },
    { item: "copperArrow", count: 1, owner: "alice" },
  ]);
});

test("recovered ammo stays separate from other owners and other items on the same tile", () => {
  const { sim } = shooter(BOW, [0.99, 0]);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  const save = { ...sim.saveOf("a")!, x: 5 };
  sim.addPlayer(
    "b",
    { ...save, inventory: ["copperArrow", ...inventory.slice(1)] },
    "bob",
  );
  sim.addPlayer(
    "a",
    { ...save, inventory: ["copperOre", ...inventory.slice(1)] },
    "alice",
  );
  sim.queueDrop("a", 0, 1);
  sim.queueDrop("b", 0, 1);
  sim.tick();
  sim.queueTarget("a", "0");
  sim.tick();
  expect(drops(sim)).toEqual([
    { x: 5, y: 1, item: "copperOre", count: 1, owner: "alice" },
    { x: 5, y: 1, item: "copperArrow", count: 1, owner: "bob" },
    { x: 5, y: 1, item: "copperArrow", count: 1, owner: "alice" },
  ]);
});

test("a recovered arrow can join a matching stack the shooter dropped and still owns", () => {
  const { sim } = shooter(BOW, [0.99, 0]);
  const save = sim.saveOf("a")!;
  save.inventory[0] = "copperArrow";
  save.inventoryCounts![0] = 1;
  sim.addPlayer("a", { ...save, x: 5 }, "alice");
  sim.queueDrop("a", 0, 1);
  sim.tick();
  const id = [...sim.state.groundItems.keys()][0]!;

  sim.queueTarget("a", "0");
  sim.tick();

  expect([...sim.state.groundItems.keys()]).toEqual([id]);
  expect(drops(sim)).toEqual([
    { x: 5, y: 1, item: "copperArrow", count: 2, owner: "alice" },
  ]);
});
