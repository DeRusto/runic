import {
  EMPTY_SLOT,
  FIRES,
  INVENTORY_SLOTS,
  LIGHTING_TICKS,
  parseRegion,
  xpForLevel,
  type FireLog,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// Plain grass with a tuft prop at (6,1), water at (7,1), a Spider at (8,1),
// and a furnace at (7,2).
const TILES = parseRegion(
  ["TTTTTTTTTT", 'TR...."~S.', "T......F.T", "TTTTTTTTTT"].join("\n"),
);
const FAIL = 0.99;

let sim: Simulation;
let seen: { tick: number; event: WorldEvent }[];

beforeEach(() => {
  sim = new Simulation(TILES, () => FAIL);
  seen = [];
});

const player = (id = "a") => sim.state.players.get(id)!;

/** Adds a player at `x`,`y` holding `held`, with `firemakingXp` and a tinderbox unless told otherwise. */
function light(
  held: [string, number][],
  {
    id = "a",
    x = 2,
    y = 1,
    firemakingXp = 0,
    tools = ["tinderbox"],
  }: {
    id?: string;
    x?: number;
    y?: number;
    firemakingXp?: number;
    tools?: string[];
  } = {},
) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  held.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer(
    id,
    {
      x,
      y,
      firemakingXp,
      tools,
      inventory,
      inventoryCounts,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 10,
    },
    id,
  );
}

/** Swaps the player's held items for `held`, keeping everything else. */
const hold = (id: string, held: [string, number][]) => {
  const carrier = player(id);
  for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
    carrier.inventory[slot] = EMPTY_SLOT;
    carrier.inventoryCounts[slot] = 0;
  }
  held.forEach(([item, count], slot) => {
    carrier.inventory[slot] = item;
    carrier.inventoryCounts[slot] = count;
  });
};

const run = (ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      seen.push({ tick: sim.state.tick, event });
  }
};
const lines = () =>
  seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
const items = (id = "a") =>
  [...player(id).inventory]
    .map((item, slot) => [item, player(id).inventoryCounts[slot]])
    .filter(([item]) => item !== EMPTY_SLOT);
const fires = () =>
  [...sim.state.fires].map(([id, fire]) => [id, fire.log, fire.endTick]);
/** The fire at `x`,`y`. */
const fireAt = (x: number, y: number) => sim.state.fires.get(`${x},${y}`);

test("lighting takes a few ticks, then the fire appears on the player's tile and pays Firemaking", () => {
  light([["birchLog", 1]]);
  sim.queueLight("a", 0);
  run(1);
  expect(player().action).toBe("lighting");
  expect(sim.state.fires.size).toBe(0);
  // The log is burnt at once, whether or not the lighting is seen through (#224).
  expect(items()).toEqual([]);
  run(LIGHTING_TICKS - 1);
  expect(fires()).toEqual([]);
  expect(player().firemakingXp).toBe(0);
  run(1);
  expect(fires()).toEqual([
    ["2,1", "birchLog", sim.state.tick + FIRES.birchLog.ticks],
  ]);
  expect(player().firemakingXp).toBe(10);
  expect(player().action).toBe("");
  expect(seen.map(({ event }) => event)).toContainEqual({
    type: "make",
    player: "a",
    station: "fire",
    ticks: LIGHTING_TICKS,
  });
});

test("lighting stops a walk, so the fire appears on the tile it was checked for", () => {
  light([["birchLog", 1]]);
  sim.queueWalk("a", { x: 5, y: 1 });
  run(1);
  const { x, y } = player();
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  expect(player()).toMatchObject({ x, y });
  expect(fires().map(([id]) => id)).toEqual([`${x},${y}`]);
});

test.each([
  ["birchLog", 10],
  ["oakLog", 25],
  ["charwoodLog", 40],
] as const)("a %s fire lights at its tier's gate and pays %s", (log, xp) => {
  const gate = xpForLevel(FIRES[log].level);
  light([[log, 1]], { firemakingXp: gate });
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  expect(fireAt(2, 1)!.log).toBe(log);
  expect(player().firemakingXp).toBe(gate + xp);
});

test("a fire is visible to everyone, and burns out silently", () => {
  light([["oakLog", 1]], { firemakingXp: xpForLevel(10) });
  light([["birchLog", 1]], { id: "b", x: 3, y: 1 });
  sim.queueLight("a", 0);
  sim.queueLight("b", 0);
  run(LIGHTING_TICKS + 1);
  expect(fires()).toHaveLength(2);
  run(600);
  // The birch fire's 600 ticks are up first: it is simply gone.
  expect(fireAt(3, 1)).toBeUndefined();
  expect(fireAt(2, 1)!.log).toBe("oakLog");
  run(400);
  expect(sim.state.fires.size).toBe(0);
});

test("one fire to a tile, and lighting another there is refused", () => {
  light([["birchLog", 2]]);
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  sim.queueLight("a", 0);
  run(1);
  expect(lines()).toEqual(["There is already a fire here."]);
  expect(fires()).toHaveLength(1);
  expect(player().firemakingXp).toBe(10);
  expect(items()).toEqual([["birchLog", 1]]);
});

test("lighting is refused without a tinderbox, a log or the level, and nothing is consumed", () => {
  light([["birchLog", 1]], { tools: [] });
  sim.queueLight("a", 0);
  run(1);
  expect(lines()).toEqual([
    "You need a tinderbox. The Forester will give you one.",
  ]);
  expect(items()).toEqual([["birchLog", 1]]);
  light([["oakLog", 1]], { id: "b" });
  seen = [];
  sim.queueLight("b", 0);
  run(1);
  expect(lines()).toEqual(["Needs Firemaking 10"]);
  expect(items("b")).toEqual([["oakLog", 1]]);
  expect(player("b").action).toBe("");
});

test("nothing but plain walkable ground takes a fire", () => {
  light([["birchLog", 1]], { x: 6, y: 1 });
  sim.queueLight("a", 0);
  run(1);
  expect(lines()).toEqual(["You can't light a fire here."]);
  expect(sim.state.fires.size).toBe(0);
  light([["birchLog", 1]], { id: "b", x: 2, y: 2 });
  // A player can't walk onto water, so the check is probed from a save there.
  Object.assign(player("b"), { x: 7, y: 1 });
  seen = [];
  sim.queueLight("b", 0);
  run(1);
  expect(lines()).toEqual(["You can't light a fire here."]);
  expect(sim.state.fires.size).toBe(0);
  // A Spider standing on the tile, though its own spawn is far away.
  light([["birchLog", 1]], { id: "c", x: 3, y: 1 });
  Object.assign(sim.state.enemies.get("0")!, { x: 3, y: 1 });
  seen = [];
  sim.queueLight("c", 0);
  run(1);
  expect(lines()).toEqual(["You can't light a fire here."]);
  expect(sim.state.fires.size).toBe(0);
});

test("a fire doesn't block walking, onto it or past it", () => {
  light([["birchLog", 1]], { x: 3, y: 1 });
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  light([], { id: "b", x: 1, y: 2 });
  sim.queueWalk("b", { x: 3, y: 1 });
  run(6);
  expect(player("b")).toMatchObject({ x: 3, y: 1 });
  expect(fireAt(3, 1)!.log).toBe("birchLog");
});

test("a new click replaces the lighting, and the log is lost to it", () => {
  light([["birchLog", 1]]);
  sim.queueLight("a", 0);
  run(1);
  sim.queueWalk("a", { x: 3, y: 1 });
  run(LIGHTING_TICKS + 1);
  expect(sim.state.fires.size).toBe(0);
  expect(player().firemakingXp).toBe(0);
  expect(items()).toEqual([]);
  expect(player().action).toBe("");
});

test("a dead player's click, or one from nobody, is ignored", () => {
  light([["birchLog", 1]]);
  player().dead = true;
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  expect(sim.state.fires.size).toBe(0);
  expect(() => sim.queueLight("nobody", 0)).not.toThrow();
});

test.each([
  ["fractional slot", 0.5],
  ["past the slots", 30],
  ["negative", -1],
])("a light click naming %j is ignored", (_, slot) => {
  light([["birchLog", 1]]);
  sim.queueLight("a", slot as number);
  run(LIGHTING_TICKS + 1);
  expect(sim.state.fires.size).toBe(0);
  expect(items()).toEqual([["birchLog", 1]]);
  expect(player().action).toBe("");
});

test("Firemaking experience is saved", () => {
  light([["birchLog", 1]]);
  sim.queueLight("a", 0);
  run(LIGHTING_TICKS + 1);
  expect(sim.saveOf("a")).toMatchObject({ firemakingXp: 10 });
});

describe("cooking at a fire (#224)", () => {
  /**
   * Lights a fire of `log` under the player at `x`,`y`, then swaps their held items
   * for `held` and gives them `cookingXp`. `draw` is the whole random source.
   */
  function cook(
    held: [string, number][],
    {
      log = "birchLog",
      id = "a",
      x = 2,
      y = 1,
      cookingXp = 0,
      firemakingXp = xpForLevel(FIRES[log].level),
      draw = FAIL,
    }: {
      log?: FireLog;
      id?: string;
      x?: number;
      y?: number;
      cookingXp?: number;
      firemakingXp?: number;
      draw?: number;
    } = {},
  ) {
    sim = new Simulation(TILES, () => draw);
    seen = [];
    light([[log, 1]], { id, x, y, firemakingXp });
    sim.queueLight(id, 0);
    run(LIGHTING_TICKS + 1);
    hold(id, held);
    player(id).cookingXp = cookingXp;
  }

  test("a fish cooks on a fire from the recipe's own materials, paying Cooking", () => {
    cook([["perch", 1]]);
    sim.queueMake("a", { item: "cookedPerch", all: false, at: { x: 2, y: 1 } });
    run(7);
    expect(items()).toEqual([["cookedPerch", 1]]);
    expect(player().cookingXp).toBe(12);
    expect(player().action).toBe("");
  });

  test("cooking works from beside the fire, not only standing on it", () => {
    cook([["perch", 1]]);
    Object.assign(player(), { x: 3, y: 1 });
    sim.queueMake("a", { item: "cookedPerch", all: false, at: { x: 2, y: 1 } });
    run(7);
    expect(items()).toEqual([["cookedPerch", 1]]);
  });

  test.each([
    ["Make 1", false],
    ["Make all", true],
  ])("%s cooks on a fire like at the range", (label, all) => {
    cook([["perch", 2]]);
    sim.queueMake("a", { item: "cookedPerch", all, at: { x: 2, y: 1 } });
    run(20);
    expect(items()).toEqual(
      all
        ? [["cookedPerch", 2]]
        : [
            ["perch", 1],
            ["cookedPerch", 1],
          ],
    );
    expect(lines()).toEqual(all ? ["Not enough materials"] : []);
  });

  test("a fire burns more than the range, by its log's points, and charwood cooks exactly like the range", () => {
    // At Cooking 26 the range's burn curve is over, so only the fire's points can burn a fish.
    const cooking26 = xpForLevel(26);
    for (const [log, draw, burns] of [
      ["birchLog", 0.09, true],
      ["oakLog", 0.09, false],
      ["charwoodLog", 0.5, false],
    ] as const) {
      cook([["perch", 1]], { log, cookingXp: cooking26, draw });
      sim.queueMake("a", {
        item: "cookedPerch",
        all: false,
        at: { x: 2, y: 1 },
      });
      run(7);
      expect(items(), log).toEqual(burns ? [] : [["cookedPerch", 1]]);
    }
  });

  test("a fire burning out mid-job ends the cooking, and the next fish is safe", () => {
    cook([["perch", 2]], { log: "charwoodLog" });
    sim.queueMake("a", { item: "cookedPerch", all: true, at: { x: 2, y: 1 } });
    run(1);
    expect(player().action).toBe("smithing");
    // The fire dies after the first fish is done, before the second's wait is over.
    fireAt(2, 1)!.endTick = sim.state.tick + 7;
    run(20);
    expect(items()).toEqual([
      ["perch", 1],
      ["cookedPerch", 1],
    ]);
    expect(player().action).toBe("");
    expect(lines()).toEqual([]);
  });

  test("a make naming a fire that isn't burning there is ignored, as is one at gear's stations", () => {
    cook([["perch", 1]]);
    sim.queueMake("a", { item: "cookedPerch", all: false, at: { x: 9, y: 9 } });
    run(10);
    expect(player().action).toBe("");
    expect(items()).toEqual([["perch", 1]]);
    sim.queueMake("a", {
      item: "cookedPerch",
      all: false,
      at: { x: 2, y: "1" } as never,
    });
    run(1);
    expect(items()).toEqual([["perch", 1]]);
    // A furnace recipe never names a fire, whatever one burns beside the player.
    hold("a", [["copperOre", 1]]);
    sim.queueMake("a", { item: "copperBar", all: false, at: { x: 2, y: 1 } });
    run(10);
    expect(items("a")).toEqual([["copperOre", 1]]);
    expect(player("a").action).toBe("");
  });
});
