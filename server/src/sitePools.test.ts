import {
  INVENTORY_SLOTS,
  parseRegion,
  tilesApart,
  VEINS,
  type SitePool,
  type Tile,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// A walker on row 1 heads east past B; the miner stands west of A on row 3.
const TILES = parseRegion(
  [
    "TTTTTTTTT",
    "T.......T",
    "T.......T",
    "T.......T",
    "TR......T",
    "TTTTTTTTT",
  ].join("\n"),
);
const A = { x: 6, y: 3 };
const B = { x: 4, y: 1 };
const C = { x: 2, y: 3 };
const SUCCEED = 0.4;
/** A pick roll that takes the last free spot. */
const LAST = 0.99;
const REGROW_TICKS = VEINS.copper.regrowTicks;

let sim: Simulation;
let roll: number;

const pool = (active: number, spots: Tile[]): SitePool => ({
  skill: "mining",
  kind: "copper",
  active,
  spots,
});
const start = (...pools: SitePool[]) => {
  sim = new Simulation(TILES, () => roll, pools);
};

beforeEach(() => {
  roll = SUCCEED;
});

const id = ({ x, y }: Tile) => `${x},${y}`;
const veinIds = () => [...sim.state.veins.keys()].sort();
const player = (who: string) => sim.state.players.get(who)!;
const runTicks = (count: number) => {
  for (let i = 0; i < count; i++) sim.tick();
};

/** Adds a player with a pickaxe at (x, y). */
function addAt(who: string, { x, y }: Tile) {
  sim.addPlayer(
    who,
    {
      x,
      y,
      miningXp: 0,
      tools: ["pickaxe"],
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 10,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
    },
    who,
  );
}

/** Mines `site` out from beside it, clicking again after each success, and returns the tick it ran out on. */
function mineOut(who: string, site: Tile) {
  while (sim.state.veins.has(id(site))) {
    sim.queueGather(who, "mining", id(site));
    for (let i = 0; i < 8 && sim.state.veins.has(id(site)); i++) sim.tick();
  }
  return sim.state.tick;
}

test("on startup each pool has exactly its active count of full sites, on distinct spots", () => {
  start(pool(2, [A, B, C]));
  expect(veinIds()).toHaveLength(2);
  for (const vein of veinIds()) {
    expect([A, B, C].map(id)).toContain(vein);
    expect(sim.state.veins.get(vein)!.minesLeft).toBe(VEINS.copper.holds);
  }
});

test("a pooled site that runs out goes at once, and a full one comes back on a free spot after the regrow time", () => {
  start(pool(1, [A, C]));
  expect(veinIds()).toEqual([id(A)]);
  addAt("miner", { x: 5, y: 3 });
  const ranOut = mineOut("miner", A);
  expect(veinIds()).toEqual([]);
  expect(player("miner").miningXp).toBe(VEINS.copper.xp * VEINS.copper.holds);
  // The spot that ran out stops blocking, so a player can walk onto it.
  sim.queueWalk("miner", A);
  runTicks(2);
  expect(player("miner")).toMatchObject(A);

  roll = LAST;
  runTicks(ranOut + REGROW_TICKS - 1 - sim.state.tick);
  expect(veinIds()).toEqual([]);
  runTicks(1);
  // A is under the miner, so C is the only free spot.
  expect(veinIds()).toEqual([id(C)]);
  expect(sim.state.veins.get(id(C))!.minesLeft).toBe(VEINS.copper.holds);
});

test("a site never appears under a player: with every free spot taken, it waits for one to clear", () => {
  start(pool(1, [A, C]));
  addAt("miner", { x: 5, y: 3 });
  mineOut("miner", A);
  addAt("onA", A);
  addAt("onC", C);
  runTicks(REGROW_TICKS + 10);
  expect(veinIds()).toEqual([]);

  sim.queueWalk("onC", { x: 2, y: 2 });
  runTicks(2);
  expect(veinIds()).toEqual([id(C)]);
});

test("a site never appears on a ground item: it waits for the item to go", () => {
  start(pool(1, [A, C]));
  addAt("miner", { x: 5, y: 3 });
  mineOut("miner", A);
  addAt("onA", A);
  addAt("dropper", C);
  player("dropper").inventory[0] = "tin";
  player("dropper").inventoryCounts[0] = 1;
  sim.queueDrop("dropper", 0, 1);
  sim.tick();
  sim.queueWalk("dropper", { x: 2, y: 2 });
  runTicks(REGROW_TICKS + 10);
  expect(veinIds()).toEqual([]);

  const [item] = sim.state.groundItems.keys();
  sim.queueTake("dropper", item!);
  runTicks(4);
  expect(sim.state.groundItems.size).toBe(0);
  sim.queueWalk("dropper", { x: 2, y: 2 });
  runTicks(4);
  expect(veinIds()).toEqual([id(C)]);
});

test("a player still mining a site when it runs out stops", () => {
  start(pool(1, [A, C]));
  addAt("miner", { x: 5, y: 3 });
  addAt("other", { x: 7, y: 1 });
  for (let i = 1; i < VEINS.copper.holds; i++) {
    sim.queueGather("miner", "mining", id(A));
    runTicks(8);
  }
  // The miner's last mine lands on the tick the other player steps up to try.
  sim.queueGather("miner", "mining", id(A));
  sim.queueGather("other", "mining", id(A));
  sim.tick();
  expect(veinIds()).toEqual([]);
  expect(player("other").action).toBe("");
  expect(player("other").inventory[0]).toBe("");
});

test("a player walking through a tile where a site appears goes around it", () => {
  start(pool(1, [A, B]));
  addAt("miner", { x: 5, y: 3 });
  const regrowTick = mineOut("miner", A) + REGROW_TICKS;
  addAt("onA", A);
  addAt("walker", { x: 1, y: 1 });
  runTicks(regrowTick - 1 - sim.state.tick);
  sim.queueWalk("walker", { x: 7, y: 1 });
  const stoodOn: Tile[] = [];
  for (let i = 0; i < 20; i++) {
    sim.tick();
    const { x, y } = player("walker");
    stoodOn.push({ x, y });
  }
  expect(veinIds()).toEqual([id(B)]);
  expect(stoodOn).not.toContainEqual(B);
  expect(stoodOn.at(-1)).toEqual({ x: 7, y: 1 });
});

test("a player saved on a tile that now holds a site logs in beside it, not at respawn", () => {
  start(pool(1, [A, C]));
  addAt("back", A);
  const { x, y } = player("back");
  expect(tilesApart({ x, y }, A)).toBe(1);
  expect(TILES[y]![x]!.blocks).toBe(false);
});

test("a gatherer whose destination grows a site mid-walk goes round to another tile next to the target before gathering", () => {
  // The target sits in the corner; D, the nearest tile next to it, is on the gatherer's row.
  const target = { x: 7, y: 1 };
  const D = { x: 6, y: 1 };
  start(pool(1, [A, D]), pool(1, [target]));
  addAt("miner", { x: 5, y: 3 });
  const regrowTick = mineOut("miner", A) + REGROW_TICKS;
  addAt("onA", A);
  addAt("gatherer", { x: 1, y: 1 });
  // The site appears on D while the gatherer is still a few steps short of it.
  runTicks(regrowTick - 6 - sim.state.tick);
  sim.queueGather("gatherer", "mining", id(target));
  let gatheredFrom: Tile | undefined;
  for (let i = 0; i < 20 && !gatheredFrom; i++) {
    sim.tick();
    const { x, y, miningXp } = player("gatherer");
    if (miningXp > 0) gatheredFrom = { x, y };
  }
  expect(veinIds()).toContain(id(D));
  expect(gatheredFrom).toBeDefined();
  expect(tilesApart(gatheredFrom!, target)).toBe(1);
});
