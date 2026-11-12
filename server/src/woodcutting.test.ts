import {
  gatherRefusal,
  INVENTORY_SLOTS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), a walk of 3 steps from standing next to the Birch at (5,1).
const TILES = parseRegion(
  ["TTTTTTTTT", "TR...gkCT", "T.......T", "TTTTTTTTT"].join("\n"),
);
const BIRCH = "5,1";
const OAK = "6,1";
const CHARWOOD = "7,1";
const ARRIVAL_TICK = 5;
const FAIL = 0.99;
const SUCCEED = 0.4;

let sim: Simulation;
let roll: number;

beforeEach(() => {
  roll = SUCCEED;
  sim = new Simulation(TILES, () => roll);
  addAt("a", 0, 1, 1);
});

const player = (id = "a") => sim.state.players.get(id)!;
const chopsLeft = (tree: string) => sim.state.trees.get(tree)!.chopsLeft;

/** Adds a player with an axe, unless `tools` says otherwise. */
function addAt(
  id: string,
  woodcuttingXp: number,
  x = 4,
  y = 1,
  tools = ["axe"],
) {
  sim.addPlayer(
    id,
    {
      x,
      y,
      woodcuttingXp,
      tools,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 10,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
    },
    id,
  );
}

/** Runs ticks and returns each `chop` event with the tick it came on. */
const attempts = (count: number) => {
  const seen: { tick: number; event: WorldEvent }[] = [];
  for (let i = 0; i < count; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (event.type === "chop") seen.push({ tick: sim.state.tick, event });
  }
  return seen;
};

const chop = (tree: string, id = "a") => {
  sim.queueGather(id, "woodcutting", tree);
  attempts(8);
};

test("a tree starts full, by its kind", () => {
  expect(chopsLeft(BIRCH)).toBe(4);
  expect(chopsLeft(OAK)).toBe(4);
  expect(chopsLeft(CHARWOOD)).toBe(3);
});

test("clicking a tree walks next to it and attempts on the tick of arrival", () => {
  roll = FAIL;
  sim.queueGather("a", "woodcutting", BIRCH);
  expect(attempts(ARRIVAL_TICK)).toEqual([
    {
      tick: ARRIVAL_TICK,
      event: { type: "chop", player: "a", success: false },
    },
  ]);
  expect(player().action).toBe("woodcutting");
});

test("a success gives one birch log and its experience, with no doubles or finds", () => {
  // A roll of 0 would double or find on a vein.
  roll = 0;
  sim.queueGather("a", "woodcutting", BIRCH);
  expect(attempts(40)).toEqual([
    {
      tick: ARRIVAL_TICK,
      event: { type: "chop", player: "a", success: true, count: 1, finds: [] },
    },
  ]);
  expect(player().woodcuttingXp).toBe(8);
  expect(player().inventory[0]).toBe("birchLog");
  expect(player().inventoryCounts[0]).toBe(1);
  expect(chopsLeft(BIRCH)).toBe(3);
});

test("each kind gives its own log and experience", () => {
  addAt("b", xpForLevel(20), 6, 2);
  chop(OAK, "b");
  chop(CHARWOOD, "b");
  expect([...player("b").inventory].slice(0, 2)).toEqual([
    "oakLog",
    "charwoodLog",
  ]);
  expect(player("b").woodcuttingXp).toBe(xpForLevel(20) + 20 + 32);
});

test("a run-out tree is a stump that still blocks, and grows back in place after its regrow time", () => {
  addAt("b", 0, 5, 2);
  for (let i = 0; i < 4; i++) chop(BIRCH, "b");
  expect(chopsLeft(BIRCH)).toBe(0);
  expect(sim.saveOf("b")).toMatchObject({ woodcuttingXp: 32 });
  sim.queueWalk("a", { x: 5, y: 1 });
  attempts(10);
  expect(player()).not.toMatchObject({ x: 5, y: 1 });
  attempts(100);
  expect(chopsLeft(BIRCH)).toBe(4);
});

test("chopping without an axe is refused, naming the Forester", () => {
  addAt("b", 0, 4, 1, []);
  expect(gatherRefusal("woodcutting", "birch", 4, player("b"))).toBe(
    "You need an axe. The Forester will give you one.",
  );
  chop(BIRCH, "b");
  expect(chopsLeft(BIRCH)).toBe(4);
});

test("Oak needs Woodcutting 10 and Charwood 20", () => {
  expect(gatherRefusal("woodcutting", "oak", 4, player())).toBe(
    "You need Woodcutting 10 to chop this.",
  );
  expect(
    gatherRefusal("woodcutting", "charwood", 3, {
      ...player(),
      tools: ["axe"],
      woodcuttingXp: xpForLevel(19),
    }),
  ).toBe("You need Woodcutting 20 to chop this.");
});

test("a save from before Woodcutting loads with none", () => {
  sim.addPlayer("c", {
    x: 2,
    y: 2,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: [],
  });
  expect(player("c").woodcuttingXp).toBe(0);
  expect(sim.saveOf("c")).toMatchObject({ woodcuttingXp: 0 });
});
