import { parseRegion } from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { seededRandom } from "./gatheringHarness.ts";
import { Simulation } from "./simulation.ts";
import { loadWorldRegion } from "./worldRegion.ts";

// The respawn tile is (1,1); a wall splits off the tile at (5,1).
const TILES = parseRegion(
  ["TTTTTTT", "TR..T.T", "T...T.T", "TTTTTTT"].join("\n"),
);

let sim: Simulation;

beforeEach(() => {
  sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a");
});

const tile = (id = "a") => {
  const { x, y } = sim.state.players.get(id)!;
  return { x, y };
};

const runTicks = (count: number) => {
  for (let i = 0; i < count; i++) sim.tick();
};

test("a new player stands on the respawn tile", () => {
  expect(tile()).toEqual({ x: 1, y: 1 });
});

test("a tick counts itself", () => {
  runTicks(3);
  expect(sim.state.tick).toBe(3);
});

test("a walk intent does nothing until the next tick, which takes the first step", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  expect(tile()).toEqual({ x: 1, y: 1 });
  runTicks(1);
  expect(tile()).toEqual({ x: 2, y: 1 });
});

test("a player walks one tile every 2 ticks and stops on arrival", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  const tiles = Array.from({ length: 6 }, () => {
    sim.tick();
    return tile().x;
  });
  expect(tiles).toEqual([2, 2, 3, 3, 3, 3]);
});

test("a newer click replaces the current walk", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  runTicks(2);
  sim.queueWalk("a", { x: 1, y: 2 });
  runTicks(5);
  expect(tile()).toEqual({ x: 1, y: 2 });
});

test("of two clicks in one tick, the later wins", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.queueWalk("a", { x: 1, y: 2 });
  runTicks(1);
  expect(tile()).toEqual({ x: 1, y: 2 });
});

test("clicking every tick can't walk faster than a tile every 2 ticks", () => {
  for (const x of [3, 1, 3, 1]) {
    sim.queueWalk("a", { x, y: 1 });
    runTicks(1);
  }
  // Steps land only on the 1st and 3rd of these 4 ticks, both heading for x = 3.
  expect(tile()).toEqual({ x: 3, y: 1 });
});

test("a click on an unreachable tile walks to the nearest reachable one", () => {
  sim.queueWalk("a", { x: 5, y: 1 });
  runTicks(10);
  expect(tile()).toEqual({ x: 3, y: 1 });
});

test.each([
  ["off the grid", { x: 7, y: 1 }],
  ["negative", { x: -1, y: 1 }],
  ["fractional", { x: 1.5, y: 1 }],
  ["inherited keys", { x: "length", y: 0 }],
  ["inherited keys on the row", { x: "name", y: "constructor" }],
  ["no coordinates", {}],
  ["null", null],
  ["not an object", "walk"],
])(
  "an invalid walk intent is ignored and keeps the current walk: %s",
  (_, bad) => {
    sim.queueWalk("a", { x: 3, y: 1 });
    sim.queueWalk("a", bad as never);
    runTicks(10);
    expect(tile()).toEqual({ x: 3, y: 1 });
  },
);

test("an intent from someone not in the region is ignored", () => {
  sim.queueWalk("ghost", { x: 3, y: 1 });
  runTicks(2);
  expect(sim.state.players.has("ghost")).toBe(false);
});

test("players walk independently and can share a tile", () => {
  sim.addPlayer("b");
  sim.queueWalk("a", { x: 2, y: 1 });
  sim.queueWalk("b", { x: 2, y: 2 });
  runTicks(1);
  expect(tile("a")).toEqual({ x: 2, y: 1 });
  expect(tile("b")).toEqual({ x: 2, y: 2 });
  sim.queueWalk("b", { x: 2, y: 1 });
  runTicks(2);
  expect(tile("b")).toEqual({ x: 2, y: 1 });
});

test("a player who leaves mid-walk is gone, along with their queued intent", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.removePlayer("a");
  runTicks(4);
  expect(sim.state.players.has("a")).toBe(false);
});

describe("Spiders", () => {
  const NEVER_WANDER = () => 0.99;

  const spiderSim = (rows: string[], random = NEVER_WANDER) =>
    new Simulation(parseRegion(rows.join("\n")), random);

  const spiderTile = (s: Simulation, id = "0") => {
    const { x, y } = s.state.enemies.get(id)!;
    return { x, y };
  };

  test("one starts at each home, with full health, idle and no target", () => {
    const s = spiderSim(["TTTTTT", "TRS..T", "T...ST", "TTTTTT"]);
    expect(s.state.enemies.size).toBe(2);
    expect(spiderTile(s, "0")).toEqual({ x: 2, y: 1 });
    expect(spiderTile(s, "1")).toEqual({ x: 4, y: 2 });
    expect(s.state.enemies.get("0")).toMatchObject({
      health: 800,
      target: "",
      state: "idle",
    });
  });

  test("each carries its kind", () => {
    const s = spiderSim(["TTTTT", "TRS.T", "TTTTT"]);
    expect(s.state.enemies.get("0")!.kind).toBe("spider");
  });

  test("the real region has a Spider on every home", () => {
    const s = new Simulation(loadWorldRegion().tiles, NEVER_WANDER);
    const kinds = [...s.state.enemies.values()].map(({ kind }) => kind);
    expect(kinds.filter((kind) => kind === "spider")).toHaveLength(8);
  });

  test.each([
    [0.0999, true],
    [0.1, false],
  ])("a roll of %d each tick steps: %s", (roll, steps) => {
    const s = spiderSim(["TTTTT", "TRS.T", "TTTTT"], () => roll);
    s.tick();
    expect(spiderTile(s).x !== 2).toBe(steps);
  });

  test("a step takes 2 ticks, however lucky the rolls", () => {
    const s = spiderSim(["TTTTTTT", "TRS...T", "TTTTTTT"], () => 0);
    const moves = Array.from({ length: 6 }, () => {
      const before = spiderTile(s);
      s.tick();
      return before.x !== spiderTile(s).x;
    });
    expect(moves).toEqual([true, false, true, false, true, false]);
  });

  test("it only steps to adjacent tiles it can walk to, past no blocked corner", () => {
    // From the home at (2,2), the tree and the rock beside it rule out both diagonals up.
    const rows = ["TTTTTTT", "TR...TT", "TTSoTTT", "TTTTTTT"];
    const legal = new Set(["2,2", "1,1", "2,1", "3,1", "4,1"]);
    const s = spiderSim(rows, seededRandom(1));
    for (let i = 0; i < 2000; i++) {
      const before = spiderTile(s);
      s.tick();
      const after = spiderTile(s);
      expect(legal.has(`${after.x},${after.y}`)).toBe(true);
      expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
      if (before.x === 2 && before.y === 2) expect(after.x).toBe(2);
    }
  });

  test("it never wanders more than 5 tiles from home, but does reach 5", () => {
    const row = `TRS${".".repeat(20)}T`;
    const s = spiderSim(
      ["T".repeat(row.length), row, "T".repeat(row.length)],
      seededRandom(7),
    );
    const seen = new Set<number>();
    for (let i = 0; i < 20000; i++) {
      s.tick();
      seen.add(spiderTile(s).x);
    }
    expect(Math.max(...seen)).toBe(2 + 5);
    expect(Math.min(...seen)).toBe(1);
  });

  test("a Spider that isn't idle doesn't wander", () => {
    const s = spiderSim(["TTTTT", "TRS.T", "TTTTT"], () => 0);
    s.state.enemies.get("0")!.state = "fighting";
    s.tick();
    expect(spiderTile(s)).toEqual({ x: 2, y: 1 });
  });

  describe("targeting", () => {
    const WIDE = ["TTTTTTTTTT", "TR.......T", "T......S.T", "TTTTTTTTTT"];

    test("clicking one walks the player next to it, then stops", () => {
      const s = spiderSim(WIDE);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      for (let i = 0; i < 30; i++) s.tick();
      const { x, y } = s.state.players.get("a")!;
      expect(Math.max(Math.abs(x - 7), Math.abs(y - 2))).toBe(1);
    });

    test("the player follows it when it moves, and stops once next to it again", () => {
      const s = spiderSim(WIDE);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      for (let i = 0; i < 30; i++) s.tick();
      Object.assign(s.state.enemies.get("0")!, { x: 2, y: 1 });
      for (let i = 0; i < 30; i++) s.tick();
      const { x, y } = s.state.players.get("a")!;
      const spider = s.state.enemies.get("0")!; // It chases back, so they meet between.
      expect(x).toBeLessThan(6);
      expect(Math.max(Math.abs(x - spider.x), Math.abs(y - spider.y))).toBe(1);
    });

    test("next to means a legal step, so it won't stop across a blocked corner", () => {
      // (3,1) and (4,2) touch diagonally, but the rocks at (4,1) and (3,2) block that step.
      const s = spiderSim(["TTTTTT", "T..RoT", "T..oST", "T....T", "TTTTTT"]);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      for (let i = 0; i < 30; i++) s.tick();
      const { x, y } = s.state.players.get("a")!;
      expect(Math.max(Math.abs(x - 4), Math.abs(y - 2))).toBe(1);
      expect(y).toBe(3);
    });

    test("a player already next to it doesn't move", () => {
      const s = spiderSim(["TTTTT", "TRS.T", "TTTTT"]);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      s.tick();
      expect(s.state.players.get("a")!.x).toBe(1);
    });

    test("walking somewhere else stops the following", () => {
      const s = spiderSim(WIDE);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      s.queueWalk("a", { x: 1, y: 2 });
      for (let i = 0; i < 30; i++) s.tick();
      expect(s.state.players.get("a")).toMatchObject({ x: 1, y: 2 });
    });

    test("a Spider click replaces a walk queued the same tick", () => {
      const s = spiderSim(["TTTTTT", "TR..ST", "T....T", "TTTTTT"]);
      s.addPlayer("a");
      s.queueWalk("a", { x: 1, y: 2 });
      s.queueTarget("a", "0");
      for (let i = 0; i < 30; i++) s.tick();
      expect(s.state.players.get("a")!.x).toBe(3);
    });

    test("targeting can't beat the walking speed", () => {
      const s = spiderSim(WIDE);
      s.addPlayer("a");
      for (let i = 0; i < 4; i++) {
        s.queueTarget("a", "0");
        s.tick();
      }
      expect(s.state.players.get("a")!.x).toBe(3);
    });

    test.each([
      ["no such Spider", "9"],
      ["inherited key", "constructor"],
      ["not a string", 0],
      ["null", null],
      ["an object", {}],
    ])("an invalid target is ignored and keeps the walk: %s", (_, bad) => {
      const s = spiderSim(WIDE);
      s.addPlayer("a");
      s.queueWalk("a", { x: 3, y: 1 });
      s.queueTarget("a", bad as never);
      for (let i = 0; i < 30; i++) s.tick();
      expect(s.state.players.get("a")).toMatchObject({ x: 3, y: 1 });
    });

    test("a target from someone not in the region is ignored", () => {
      const s = spiderSim(WIDE);
      s.queueTarget("ghost", "0");
      s.tick();
      expect(s.state.players.has("ghost")).toBe(false);
    });
  });
});

const EMPTY_INVENTORY = Array<string>(30).fill("");
const EMPTY_COUNTS = Array<number>(30).fill(0);
const EMPTY_BANK = Array<string>(96).fill("");
const EMPTY_BANK_COUNTS = Array<number>(96).fill(0);

test("a new account starts on the respawn tile with an empty inventory, Hitpoints 10 and 1,000 health", () => {
  expect(sim.saveOf("a")).toEqual({
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    miningXp: 0,
    smithingXp: 0,
    woodcuttingXp: 0,
    fishingXp: 0,
    cookingXp: 0,
    blockingXp: 0,
    masteryXp: 0,
    masteryHundredths: 0,
    pinnedSkills: [
      "Combat",
      "Defense",
      "Herblaw",
      "Hitpoints",
      "Mining",
      "Smithing",
    ],
    health: 1000,
    inventory: EMPTY_INVENTORY,
    inventoryCounts: EMPTY_COUNTS,
    tools: [],
    bank: EMPTY_BANK,
    bankCounts: EMPTY_BANK_COUNTS,
    weapon: "",
    shield: "",
    head: "",
    body: "",
    legs: "",
    hands: "",
    feet: "",
    cape: "",
    neck: "",
    ring: "",
  });
});

const SAVED = {
  x: 2,
  y: 2,
  combatXp: 1,
  defenseXp: 2,
  herblawXp: 3,
  hitpointsXp: 4100,
  miningXp: 4,
  smithingXp: 5,
  woodcuttingXp: 10,
  fishingXp: 11,
  cookingXp: 12,
  blockingXp: 6,
  masteryXp: 7,
  masteryHundredths: 8,
  pinnedSkills: ["Mining", "Blocking"],
  health: 7,
  inventory: ["berry", ...EMPTY_INVENTORY.slice(1)],
  inventoryCounts: [7, ...EMPTY_COUNTS.slice(1)],
  tools: ["pickaxe"],
  bank: ["herb", ...EMPTY_BANK.slice(1)],
  bankCounts: [500, ...EMPTY_BANK_COUNTS.slice(1)],
  weapon: "copperSword",
  shield: "copperShield",
  head: "copperHelmet",
  body: "copperChestplate",
  legs: "copperLeggings",
  hands: "",
  feet: "",
  cape: "",
  neck: "",
  ring: "",
};

test("a returning player comes back exactly as saved", () => {
  sim.addPlayer("b", SAVED);
  expect(sim.saveOf("b")).toEqual(SAVED);
});

test.each([
  ["now blocks", { x: 0, y: 0 }],
  ["is off the grid", { x: 200, y: 200 }],
])(
  "a saved tile that %s becomes the respawn tile, and the rest is kept",
  (_, tile) => {
    sim.addPlayer("b", { ...SAVED, ...tile });
    expect(sim.saveOf("b")).toEqual({ ...SAVED, x: 1, y: 1 });
  },
);

test("max health is 100 per Hitpoints level, whatever the health left", () => {
  sim.addPlayer("b", { ...SAVED, hitpointsXp: 7200, health: 3 });
  const player = sim.state.players.get("b")!;
  expect(player.maxHealth).toBe(1300);
  expect(player.health).toBe(3);
  expect(sim.state.players.get("a")!.maxHealth).toBe(1000);
});

test("a save has the tile the player walked to", () => {
  sim.queueWalk("a", { x: 2, y: 1 });
  runTicks(1);
  expect(sim.saveOf("a")).toMatchObject({ x: 2, y: 1 });
});

test("a player who is gone has no save", () => {
  sim.removePlayer("a");
  expect(sim.saveOf("a")).toBeUndefined();
});

test("a log out intent applies at the next tick, once", () => {
  sim.queueLogout("a");
  expect(sim.loggedOut).toEqual([]);
  runTicks(2);
  expect(sim.loggedOut).toEqual(["a"]);
});

test("a log out intent from someone no longer in the region is ignored", () => {
  sim.queueLogout("ghost");
  sim.queueLogout("a");
  sim.removePlayer("a");
  runTicks(1);
  expect(sim.loggedOut).toEqual([]);
});

describe("a player's synced action", () => {
  // The respawn tile is (1,1), with a Spider's home at (3,1) and a bush at (6,1).
  const ROWS = ["TTTTTTTT", "TR.S..bT", "T......T", "TTTTTTTT"];
  const MISS = 0.99;
  const start = (roll = MISS) => {
    const s = new Simulation(parseRegion(ROWS.join("\n")), () => roll);
    s.addPlayer("a");
    return s;
  };
  const action = (s: Simulation) => s.state.players.get("a")!.action;

  test("nothing, until a click: then walking, and nothing again on arrival", () => {
    const s = start();
    expect(action(s)).toBe("");
    s.queueWalk("a", { x: 3, y: 2 });
    s.tick();
    expect(action(s)).toBe("walking");
    s.tick();
    s.tick();
    expect(s.state.players.get("a")).toMatchObject({ x: 3, y: 2 });
    expect(action(s)).toBe("");
  });

  test("picking from the click on, through the walk there, until the pick", () => {
    const unlucky = start();
    unlucky.queueGather("a", "herblaw", "6,1");
    for (let i = 0; i < 8; i++) {
      unlucky.tick();
      expect(action(unlucky)).toBe("herblaw");
    }
    const lucky = start(0);
    lucky.queueGather("a", "herblaw", "6,1");
    for (let i = 0; i < 8; i++) lucky.tick();
    expect(action(lucky)).toBe("");
  });

  test("fighting from the click on, and a new click replaces it", () => {
    const s = start();
    s.queueTarget("a", "0");
    s.tick();
    expect(action(s)).toBe("fighting");
    s.queueWalk("a", { x: 1, y: 2 });
    s.tick();
    expect(action(s)).toBe("walking");
  });

  test("a drop ends it", () => {
    const s = start();
    s.queueTarget("a", "0");
    s.tick();
    s.dropPlayer("a");
    expect(action(s)).toBe("");
    s.tick();
    expect(action(s)).toBe("");
  });

  test("death ends it", () => {
    // The player's swing misses; the Spider's, 4 ticks later, hits for 1.
    const rolls = [MISS, 0, 0];
    const s = new Simulation(
      parseRegion(["TTTTT", "TRS.T", "TTTTT"].join("\n")),
      () => rolls.shift() ?? MISS,
    );
    s.addPlayer("a");
    s.state.players.get("a")!.health = 1;
    s.queueTarget("a", "0");
    s.tick();
    expect(action(s)).toBe("fighting");
    for (let i = 0; i < 4; i++) s.tick();
    expect(s.state.players.get("a")!.dead).toBe(true);
    expect(action(s)).toBe("");
  });
});
