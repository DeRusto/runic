import { siteId, MAX_XP, parseRegion, type WorldEvent } from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;
/** As a damage roll, the top of the range. */
const TOP = 0.999;

// The respawn tile is (1,1), with the Spider's home at (2,1), next to it.
const NEXT_TO = ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"];
// The Spider's home is two tiles off, so the first step arrives.
const ONE_STEP = ["TTTTTTT", "TR.S..T", "TTTTTTT"];

/** Rolls come in order, and then everything misses (and nothing wanders). */
function fight(rows = NEXT_TO, ...rolls: number[]) {
  return new Simulation(
    parseRegion(rows.join("\n")),
    () => rolls.shift() ?? MISS,
  );
}

const SAVE: PlayerSave = {
  x: 1,
  y: 1,
  combatXp: 0,
  defenseXp: 0,
  herblawXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  inventory: [],
};

const spider = (s: Simulation) => s.state.enemies.get("0")!;
const player = (s: Simulation, id = "a") => s.state.players.get(id)!;

/** Ticks the simulation, and returns each event with the tick it came on. */
function run(s: Simulation, ticks: number) {
  const seen: (WorldEvent & { tick: number })[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick();
    for (const event of s.events.splice(0)) {
      seen.push({ ...event, tick: s.state.tick });
    }
  }
  return seen;
}

const swingTicks = (events: ReturnType<typeof run>, type: WorldEvent["type"]) =>
  events.filter((e) => e.type === type).map((e) => e.tick);

describe("swing timing", () => {
  test("the player swings on the tick they arrive, the Spider 4 later, then each every 8", () => {
    const s = fight(ONE_STEP);
    s.addPlayer("a");
    s.queueTarget("a", "0");
    const events = run(s, 21);
    expect(player(s).x).toBe(2);
    expect(swingTicks(events, "playerSwing")).toEqual([1, 9, 17]);
    expect(swingTicks(events, "enemySwing")).toEqual([5, 13, 21]);
  });

  test("a player already next to it swings on the tick the click applies", () => {
    const s = fight();
    s.addPlayer("a");
    s.queueTarget("a", "0");
    expect(swingTicks(run(s, 1), "playerSwing")).toEqual([1]);
  });

  test("clicking away and back can't beat 8 ticks", () => {
    const s = fight();
    s.addPlayer("a");
    s.queueTarget("a", "0");
    const events = run(s, 2);
    s.queueWalk("a", { x: 1, y: 1 });
    events.push(...run(s, 1));
    s.queueTarget("a", "0");
    events.push(...run(s, 8));
    expect(swingTicks(events, "playerSwing")).toEqual([1, 9]);
  });

  test("a Spider that lost interest can't beat 8 ticks when a new fight starts", () => {
    const s = fight();
    s.addPlayer("a");
    s.addPlayer("b");
    s.queueTarget("a", "0");
    const events = run(s, 5); // Its swing comes on tick 5, so its next is due on 13.
    spider(s).state = "idle";
    s.queueTarget("b", "0"); // Tick 6 starts a new fight, whose first swing would be on 10.
    events.push(...run(s, 8));
    expect(swingTicks(events, "enemySwing")).toEqual([5, 13]);
  });
});

// The respawn tile is (1,1), with the Spider's home next to it at (2,1).
const CORRIDOR = ["TTTTTTTTTTTTTTTT", "TRS............T", "TTTTTTTTTTTTTTTT"];

/** One player, who has just swung (and missed) at the Spider on tick 1. */
function fought(rows = CORRIDOR) {
  const s = fight(rows);
  s.addPlayer("a");
  s.queueTarget("a", "0");
  run(s, 1);
  return s;
}

describe("a fighting Spider following its target", () => {
  test("a fighting Spider follows its target at a tile per 2 ticks and stops next to them", () => {
    const s = fought();
    Object.assign(player(s), { x: 6 }); // Inside the leash: 4 tiles from the start tile.
    s.queueWalk("a", { x: 6, y: 1 });
    const xs = [];
    for (let i = 0; i < 8; i++) {
      run(s, 1);
      xs.push(spider(s).x);
    }
    expect(xs).toEqual([3, 3, 4, 4, 5, 5, 5, 5]);
    expect(spider(s).state).toBe("fighting");
  });

  test("a Spider doesn't swing until it has caught up, then swings on arriving", () => {
    const s = fought(); // Its first swing is due on tick 5.
    Object.assign(player(s), { x: 6 });
    s.queueWalk("a", { x: 6, y: 1 });
    const events = run(s, 4); // To tick 5, one step short.
    expect(spider(s).x).toBe(4);
    expect(swingTicks(events, "enemySwing")).toEqual([]);
    expect(swingTicks(run(s, 1), "enemySwing")).toEqual([6]);
    expect(spider(s).x).toBe(5);
  });

  test("a Spider walks around what blocks it, and follows the corner rule", () => {
    const s = fought(["TTTTTTT", "TRS.T.T", "T...T.T", "T.....T", "TTTTTTT"]);
    Object.assign(player(s), { x: 5, y: 1 });
    s.queueWalk("a", { x: 5, y: 1 });
    run(s, 20);
    expect(spider(s)).toMatchObject({ x: 5, y: 2, state: "fighting" });
  });
});

describe("the leash", () => {
  /** Stands the player on a tile, no longer following the Spider. */
  const standAt = (s: Simulation, x: number) => {
    Object.assign(player(s), { x });
    s.queueWalk("a", { x, y: 1 });
  };

  test("a miss starts a fight, and the start tile is the Spider's tile at that moment", () => {
    const s = fight(CORRIDOR);
    s.addPlayer("a", { ...SAVE, x: 4 });
    Object.assign(spider(s), { x: 5 }); // Three tiles from its home at (2,1).
    s.queueTarget("a", "0");
    run(s, 1);
    expect(spider(s)).toMatchObject({ state: "fighting", target: "a" });
    standAt(s, 9); // 4 from (5,1), and 7 from home.
    run(s, 1);
    expect(spider(s).state).toBe("fighting");
    standAt(s, 10); // 5 from (5,1).
    run(s, 1);
    expect(spider(s)).toMatchObject({ state: "going home", target: "" });
  });

  test("distance is in 8-way tiles", () => {
    const rows = ["TTTTTTTT", "TRS....T", "T......T", "T......T", "T......T", "TTTTTTTT"]; // prettier-ignore
    const s = fought(rows);
    Object.assign(player(s), { x: 6, y: 4 }); // 4 across and 3 down from (2,1): 4 tiles.
    s.queueWalk("a", { x: 6, y: 4 });
    run(s, 1);
    expect(spider(s).state).toBe("fighting");
  });

  test("more swings in one fight don't move the start tile", () => {
    const s = fought();
    standAt(s, 5);
    run(s, 5);
    expect(spider(s).x).toBe(4); // Chased two tiles from (2,1).
    s.queueTarget("a", "0");
    run(s, 8); // The player's next swing, at the Spider where it now stands.
    expect(spider(s).state).toBe("fighting");
    standAt(s, 7); // 5 from (2,1), 3 from the Spider.
    run(s, 1);
    expect(spider(s).state).toBe("going home");
  });

  test("a new target keeps the start tile", () => {
    const s = fought();
    s.addPlayer("b");
    s.queueTarget("b", "0");
    run(s, 1);
    expect(spider(s).target).toBe("b");
    Object.assign(player(s, "b"), { x: 7 });
    s.queueWalk("b", { x: 7, y: 1 });
    run(s, 1);
    expect(spider(s).target).toBe("");
  });

  test("a Spider gives up when its target is gone", () => {
    const s = fought();
    spider(s).x = 5; // Away from home, so it doesn't arrive at once.
    s.removePlayer("a");
    run(s, 1);
    expect(spider(s)).toMatchObject({ state: "going home", target: "" });
  });

  test("a Spider gives up when its target is dead", () => {
    const s = fought();
    spider(s).x = 5;
    player(s).health = 0;
    run(s, 1);
    expect(spider(s)).toMatchObject({ state: "going home", target: "" });
  });

  test("it walks home at a tile per 2 ticks, recovers on arrival, and takes no swings", () => {
    const s = fought();
    spider(s).health = 300;
    standAt(s, 5);
    run(s, 5);
    expect(spider(s).x).toBe(4);
    standAt(s, 12);
    const xs = [];
    const events = [];
    for (let i = 0; i < 4; i++) {
      events.push(...run(s, 1));
      xs.push({ x: spider(s).x, health: spider(s).health, state: spider(s).state }); // prettier-ignore
    }
    expect(xs).toEqual([
      { x: 3, health: 300, state: "going home" },
      { x: 3, health: 300, state: "going home" },
      { x: 2, health: 800, state: "idle" },
      { x: 2, health: 800, state: "idle" },
    ]);
    expect(swingTicks(events, "enemySwing")).toEqual([]);
  });

  test("a Spider giving up on its home tile recovers there and then", () => {
    const s = fought();
    spider(s).health = 300;
    s.removePlayer("a");
    run(s, 1);
    expect(spider(s)).toMatchObject({ x: 2, health: 800, state: "idle" });
  });

  test("a swing on the way home starts a new fight from where it stands, with its health as it was", () => {
    const s = fought();
    spider(s).health = 300;
    standAt(s, 5);
    run(s, 5); // Chased to (4,1).
    s.addPlayer("b", { ...SAVE, x: 5 });
    s.removePlayer("a");
    run(s, 1); // Gives up, and steps to (3,1).
    expect(spider(s)).toMatchObject({ x: 3, state: "going home" });
    Object.assign(player(s, "b"), { x: 4 });
    s.queueTarget("b", "0");
    const events = run(s, 1);
    expect(swingTicks(events, "playerSwing")).toHaveLength(1);
    expect(spider(s)).toMatchObject({
      x: 3,
      health: 300,
      state: "fighting",
      target: "b",
    });
    Object.assign(player(s, "b"), { x: 7 }); // 4 from (3,1), 5 from the first start tile.
    s.queueWalk("b", { x: 7, y: 1 });
    run(s, 1);
    expect(spider(s).state).toBe("fighting");
    Object.assign(player(s, "b"), { x: 8 });
    s.queueWalk("b", { x: 8, y: 1 });
    run(s, 1);
    expect(spider(s).state).toBe("going home");
  });
});

describe("the player's swing", () => {
  test.each([
    { combatXp: 0, roll: 0.399, hits: true },
    { combatXp: 0, roll: 0.401, hits: false },
    { combatXp: 800, roll: 0.419, hits: true }, // Level 5.
    { combatXp: 800, roll: 0.421, hits: false },
  ])(
    "with $combatXp Combat XP, a roll of $roll hits: $hits",
    ({ combatXp, roll, hits }) => {
      const s = fight(NEXT_TO, roll, 0);
      s.addPlayer("a", { ...SAVE, combatXp });
      s.queueTarget("a", "0");
      run(s, 1);
      expect(spider(s).health).toBe(hits ? 700 : 800);
    },
  );

  test.each([
    { combatXp: 0, roll: 0, damage: 100 },
    { combatXp: 0, roll: 0.5, damage: 150 }, // Any whole number in range.
    { combatXp: 0, roll: TOP, damage: 200 },
    { combatXp: 16200, roll: TOP, damage: 200 }, // Level 19.
    { combatXp: 18050, roll: TOP, damage: 300 }, // Level 20.
  ])(
    "with $combatXp Combat XP, a damage roll of $roll deals $damage",
    ({ combatXp, roll, damage }) => {
      const s = fight(NEXT_TO, 0, roll);
      s.addPlayer("a", { ...SAVE, combatXp });
      s.queueTarget("a", "0");
      run(s, 1);
      expect(spider(s).health).toBe(800 - damage);
    },
  );

  test.each([
    { roll: 0.0999, critical: true, damage: 225 },
    { roll: 0.1, critical: false, damage: 150 },
  ])(
    "a crit roll of $roll on a landed hit of 150 is critical: $critical, dealing $damage",
    ({ roll, critical, damage }) => {
      const s = fight(NEXT_TO, 0, 0.5, roll);
      s.addPlayer("a");
      s.queueTarget("a", "0");
      expect(run(s, 1)[0]).toMatchObject({ damage, critical });
      expect(player(s).combatXp).toBe(Math.round((damage * 6) / 100));
    },
  );

  test("a miss draws no crit roll", () => {
    const rolls = [MISS, 0];
    const s = new Simulation(
      parseRegion(NEXT_TO.join("\n")),
      () => rolls.shift() ?? MISS,
    );
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    expect(rolls).toEqual([0]);
  });

  test("a crit's overkill gives no XP", () => {
    const s = fight(NEXT_TO, 0, TOP, 0);
    s.addPlayer("a");
    spider(s).health = 250;
    s.queueTarget("a", "0");
    expect(run(s, 1)[0]).toMatchObject({ damage: 250, critical: true });
    expect(player(s).combatXp).toBe(15);
  });

  test("Combat and Hitpoints give 6 XP per 100 damage, and a miss gives none", () => {
    const s = fight(NEXT_TO, 0, TOP);
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: 12, hitpointsXp: 4062 });
    run(s, 8);
    expect(player(s)).toMatchObject({ combatXp: 12, hitpointsXp: 4062 });
  });

  test("each swing's XP rounds to the nearest whole number", () => {
    const s = fight(NEXT_TO, 0, 0.5);
    s.addPlayer("a");
    spider(s).health = 109; // So the swing deals 109: 6.54 XP, rounding to 7.
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: 7, hitpointsXp: 4057 });
  });

  test("overkill gives no XP", () => {
    const s = fight(NEXT_TO, 0, TOP);
    s.addPlayer("a");
    spider(s).health = 100;
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: 6, hitpointsXp: 4056 });
  });

  test("XP stops at the cap", () => {
    const s = fight(NEXT_TO, 0, TOP);
    s.addPlayer("a", { ...SAVE, combatXp: MAX_XP - 1, hitpointsXp: MAX_XP });
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: MAX_XP, hitpointsXp: MAX_XP });
  });

  test("a Hitpoints level-up raises max health, not health", () => {
    const s = fight(NEXT_TO, 0, 0);
    s.addPlayer("a", { ...SAVE, hitpointsXp: 4045, health: 500 }); // 5 XP short of level 10.
    expect(player(s).maxHealth).toBe(900);
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ maxHealth: 1000, health: 500 });
  });
});

describe("the Spider's swing", () => {
  /** The player's first swing misses on tick 1; the Spider's first rolls on tick 5. */
  const spiderSwingWith = (saved: Partial<PlayerSave>, ...rolls: number[]) => {
    const s = fight(NEXT_TO, MISS, ...rolls);
    s.addPlayer("a", { ...SAVE, ...saved });
    s.queueTarget("a", "0");
    run(s, 5);
    return player(s);
  };

  test.each([
    { defenseXp: 0, roll: 0.349, hits: true },
    { defenseXp: 0, roll: 0.351, hits: false },
    { defenseXp: 5000, roll: 0.329, hits: true }, // Level 11.
    { defenseXp: 5000, roll: 0.331, hits: false },
  ])(
    "with $defenseXp Defense XP, a roll of $roll hits: $hits",
    ({ defenseXp, roll, hits }) => {
      expect(spiderSwingWith({ defenseXp }, roll, 0).health).toBe(
        hits ? 900 : 1000,
      );
    },
  );

  test.each([
    { roll: 0, damage: 100 },
    { roll: 0.5, damage: 150 },
    { roll: TOP, damage: 200 },
  ])("a damage roll of $roll deals $damage", ({ roll, damage }) => {
    expect(spiderSwingWith({}, 0, roll).health).toBe(1000 - damage);
  });

  test("over 1,000 evenly spread damage rolls, a hit averages today's ×100, and Defense today's XP", () => {
    const hit = Array.from({ length: 1000 }, (_, i) =>
      spiderSwingWith({}, 0, (i + 0.5) / 1000),
    );
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(hit.map((one) => 1000 - one.health))).toBeCloseTo(150, 0);
    expect(mean(hit.map((one) => one.defenseXp))).toBeCloseTo(12, 1);
  });

  test("Defense gives 6 XP for a miss", () => {
    expect(spiderSwingWith({}, MISS).defenseXp).toBe(6);
  });

  test("Defense gives 6 XP for a hit plus 4 per 100 damage taken, rounded", () => {
    expect(spiderSwingWith({}, 0, TOP).defenseXp).toBe(14);
    expect(spiderSwingWith({}, 0, 0.5).defenseXp).toBe(12); // 150 damage.
  });

  test("Defense XP stops at the cap", () => {
    expect(spiderSwingWith({ defenseXp: MAX_XP - 1 }, MISS).defenseXp).toBe(
      MAX_XP,
    );
  });
});

describe("dying", () => {
  // Saved at (3,1), next to the Spider's home and away from the respawn tile (1,1).
  // The player misses on tick 1, and the Spider's hit on tick 5 rolls 200 damage.
  const dying = (saved: Partial<PlayerSave> = {}) => {
    const s = fight(NEXT_TO, MISS, 0, TOP);
    s.addPlayer("a", { ...SAVE, x: 3, health: 100, ...saved }, "alice");
    s.queueTarget("a", "0");
    return s;
  };

  test("a hit at 100 health kills, counting as a hit for 100, and the Spider gives up at once", () => {
    const s = dying();
    const events = run(s, 5);
    expect(player(s)).toMatchObject({
      health: 0,
      dead: true,
      target: "",
      defenseXp: 10,
    });
    expect(events.slice(-2)).toMatchObject([
      { type: "enemySwing", damage: 100 },
      { type: "playerDied", player: "a" },
    ]);
    // Already on its home tile, so giving up is over at once.
    expect(spider(s)).toMatchObject({ state: "idle", target: "" });
  });

  test("a walk ends at death too", () => {
    const s = dying();
    run(s, 4);
    s.queueWalk("a", { x: 5, y: 1 });
    run(s, 1);
    expect(player(s)).toMatchObject({ x: 4, dead: true });
    run(s, 4);
    expect(player(s).x).toBe(4);
  });

  test("they stay on their tile for 5 ticks, then respawn at full health with their XP kept", () => {
    const s = dying({ combatXp: 200 });
    run(s, 5);
    expect(run(s, 4)).toEqual([]);
    expect(player(s)).toMatchObject({ x: 3, y: 1, health: 0, dead: true });
    expect(run(s, 1)).toMatchObject([{ type: "playerRespawned", player: "a" }]);
    expect(player(s)).toMatchObject({
      x: 1,
      y: 1,
      health: 1000,
      dead: false,
      combatXp: 200,
      defenseXp: 10,
    });
  });

  describe("drops everything but the Toolbelt", () => {
    const carrying = () => {
      const inventory = Array<string>(30).fill("");
      inventory.splice(0, 3, "copperOre", "", "berry");
      const inventoryCounts = Array<number>(30).fill(0);
      inventoryCounts.splice(0, 3, 12, 0, 3);
      return dying({
        inventory,
        inventoryCounts,
        tools: ["pickaxe", "hammer"],
        weapon: "copperSword",
        head: "copperHelmet",
      });
    };
    const groundItems = (s: Simulation) =>
      [...s.state.groundItems.values()].map(({ x, y, item, count, owner }) => ({
        x,
        y,
        item,
        count,
        owner,
      }));

    test("each slot and worn piece lies on the death tile, owned by the dead player", () => {
      const s = carrying();
      run(s, 5);
      const owned = { x: 3, y: 1, owner: "alice" };
      expect(groundItems(s)).toEqual([
        { ...owned, item: "copperOre", count: 12 },
        { ...owned, item: "berry", count: 3 },
        { ...owned, item: "copperSword", count: 1 },
        { ...owned, item: "copperHelmet", count: 1 },
      ]);
    });

    test("the inventory and gear slots are empty, and the Toolbelt is unchanged", () => {
      const s = carrying();
      run(s, 5);
      expect([...player(s).inventory].every((item) => item === "")).toBe(true);
      expect([...player(s).inventoryCounts].every((n) => n === 0)).toBe(true);
      expect(player(s)).toMatchObject({ weapon: "", head: "" });
      expect([...player(s).tools]).toEqual(["pickaxe", "hammer"]);
    });

    test("others can't see the drops until the owner minute ends", () => {
      const s = carrying();
      s.addPlayer("b", { ...SAVE, x: 5 }, "bob");
      run(s, 5);
      const seenBy = (id: string) =>
        [...s.state.groundItems.keys()].filter((item) => s.canSee(id, item));
      expect(seenBy("a")).toHaveLength(4);
      expect(seenBy("b")).toEqual([]);
      run(s, 200);
      expect(seenBy("b")).toHaveLength(4);
    });

    test("the save after respawn holds nothing but the Toolbelt", () => {
      const s = carrying();
      run(s, 10);
      const save = s.saveOf("a")!;
      expect(save.inventory.every((item) => item === "")).toBe(true);
      expect(save).toMatchObject({
        weapon: "",
        head: "",
        tools: ["pickaxe", "hammer"],
      });
    });
  });

  test("the fight doesn't resume after the respawn", () => {
    const s = dying();
    run(s, 10);
    expect(swingTicks(run(s, 20), "playerSwing")).toEqual([]);
  });

  test("a dead player's walk, target and eat intents are ignored", () => {
    const s = dying();
    run(s, 5);
    // Dying drops the inventory, so a berry is handed over after.
    player(s).inventory[0] = "berry";
    player(s).inventoryCounts[0] = 1;
    s.queueWalk("a", { x: 5, y: 1 });
    s.queueEat("a", 0);
    s.queueTarget("a", "0");
    expect(run(s, 1)).toEqual([]);
    expect(player(s)).toMatchObject({ x: 3, health: 0, target: "" });
    expect(player(s).inventory[0]).toBe("berry");
    run(s, 10);
    expect(player(s).x).toBe(1);
  });

  test("a dead player's pick intent is ignored", () => {
    const s = fight(["TTTTTTT", "TRS.b.T", "TTTTTTT"], MISS, 0, 0.99);
    s.addPlayer("a", { ...SAVE, x: 3, health: 1 });
    s.queueTarget("a", "0");
    run(s, 5);
    s.queueGather("a", "herblaw", siteId({ x: 4, y: 1 }));
    expect(run(s, 4)).toEqual([]);
  });

  test("a dead player saves as already respawned, while still lying where they fell", () => {
    const s = dying({ combatXp: 200 });
    run(s, 5);
    expect(s.saveOf("a")).toMatchObject({
      x: 1,
      y: 1,
      health: 1000,
      combatXp: 200,
      defenseXp: 10,
    });
    expect(player(s)).toMatchObject({ x: 3, health: 0 });
  });
});

describe("regeneration", () => {
  test("heals on every 20th tick, with no event, and stops at the maximum", () => {
    const s = fight();
    s.addPlayer("a", { ...SAVE, health: 880 });
    expect(run(s, 19)).toEqual([]);
    expect(player(s).health).toBe(880);
    expect(run(s, 1)).toEqual([]);
    expect(player(s).health).toBe(930);
    run(s, 60);
    expect(player(s).health).toBe(1000);
  });

  test.each([
    { hitpointsXp: 4050, heals: 50 }, // Level 10.
    { hitpointsXp: 18050, heals: 100 }, // Level 20.
    { hitpointsXp: 20000, heals: 105 }, // Level 21.
    { hitpointsXp: MAX_XP, heals: 495 }, // Level 99.
  ])(
    "with $hitpointsXp Hitpoints XP it heals $heals, 5% rounded up",
    ({ hitpointsXp, heals }) => {
      const s = fight();
      s.addPlayer("a", { ...SAVE, hitpointsXp, health: 1 });
      run(s, 20);
      expect(player(s).health).toBe(1 + heals);
    },
  );

  test("pauses while a combat lock runs", () => {
    const s = fight(NEXT_TO, 0, 0);
    spider(s).health = 1; // Dies on tick 1, the last swing, so the lock ends on tick 35.
    s.addPlayer("a", { ...SAVE, health: 500 });
    s.queueTarget("a", "0");
    run(s, 39);
    expect(player(s).health).toBe(500);
    run(s, 1);
    expect(player(s).health).toBe(550);
  });
});

describe("combat lock", () => {
  /** Whether a log out queued now goes through on the next tick. */
  const logsOut = (s: Simulation) => {
    s.queueLogout("a");
    run(s, 1);
    return s.loggedOut.splice(0).includes("a");
  };

  /** Ends the fight, so no swing comes after the one that set the lock. */
  const part = (s: Simulation) => {
    s.queueWalk("a", { x: player(s).x, y: player(s).y });
    spider(s).state = "going home";
    spider(s).target = "";
  };

  const HIT_OR_MISS = [
    { name: "hit", rolls: [0, 0] },
    { name: "miss", rolls: [MISS] },
  ];

  test("nobody is locked before a swing", () => {
    const s = fight();
    s.addPlayer("a", SAVE);
    expect(logsOut(s)).toBe(true);
  });

  test.each(HIT_OR_MISS)(
    "a $name by the player locks them for 34 ticks",
    ({ rolls }) => {
      const s = fight(NEXT_TO, ...rolls);
      s.addPlayer("a", SAVE);
      s.queueTarget("a", "0");
      run(s, 1); // The swing lands on tick 1, so the lock ends on tick 35.
      part(s);
      run(s, 32);
      expect(logsOut(s)).toBe(false); // Tick 34.
      expect(logsOut(s)).toBe(true); // Tick 35.
    },
  );

  test.each(HIT_OR_MISS)(
    "a Spider's $name sets the lock again",
    ({ rolls }) => {
      const s = fight(NEXT_TO, MISS, ...rolls);
      s.addPlayer("a", SAVE);
      s.queueTarget("a", "0");
      run(s, 5); // The swing lands on tick 5, so the lock ends on tick 39.
      part(s);
      run(s, 32);
      expect(logsOut(s)).toBe(false); // Tick 38.
      expect(logsOut(s)).toBe(true); // Tick 39.
    },
  );

  test("a dead player can't log out, and the lock clears at respawn", () => {
    const s = fight(NEXT_TO, MISS, 0, 0.99);
    s.addPlayer("a", { ...SAVE, health: 1 });
    s.queueTarget("a", "0");
    run(s, 5);
    expect(player(s).dead).toBe(true);
    for (let tick = 6; tick <= 10; tick++) expect(logsOut(s)).toBe(false);
    expect(player(s).dead).toBe(false);
    expect(logsOut(s)).toBe(true);
  });

  test("a refused log out doesn't go through later by itself", () => {
    const s = fight();
    s.addPlayer("a", SAVE);
    s.queueTarget("a", "0");
    run(s, 1);
    expect(logsOut(s)).toBe(false);
    part(s);
    run(s, 50);
    expect(s.loggedOut).toEqual([]);
  });

  test("a refused log out tells the player why, and only them", () => {
    const s = fight(NEXT_TO, MISS);
    s.addPlayer("a", SAVE);
    s.queueTarget("a", "0");
    run(s, 1);
    s.queueLogout("a");
    expect(run(s, 1).filter((e) => e.type === "told")).toEqual([
      {
        type: "told",
        player: "a",
        line: "You can't log out until 10 seconds after a fight.",
        tick: 2,
      },
    ]);
  });
});

describe("a dropped player", () => {
  /** One swing in, so the lock runs until tick 35, then the connection drops. */
  function dropped(...spiderRolls: number[]) {
    const s = fight(NEXT_TO, MISS, ...spiderRolls);
    s.addPlayer("a", SAVE);
    s.queueTarget("a", "0");
    run(s, 1);
    s.dropPlayer("a");
    return s;
  }

  test("stops their action", () => {
    const s = dropped();
    const events = run(s, 10);
    expect(swingTicks(events, "playerSwing")).toEqual([]);
    expect(player(s).target).toBe("");
  });

  test("forgets what they asked for just before the drop", () => {
    const s = fight();
    s.addPlayer("a", SAVE);
    s.queueTarget("a", "0");
    s.dropPlayer("a");
    expect(swingTicks(run(s, 10), "playerSwing")).toEqual([]);
  });

  test("can still be hit", () => {
    const s = dropped(0, 0);
    expect(swingTicks(run(s, 10), "enemySwing").length).toBeGreaterThan(0);
    expect(player(s).health).toBe(900);
  });

  test("has a lock that counts down and isn't refreshed by the Spider's swings", () => {
    const s = dropped();
    const events = run(s, 33);
    expect(swingTicks(events, "enemySwing").at(-1)).toBeGreaterThan(20);
    expect(s.lockRunning("a")).toBe(true);
    run(s, 1);
    expect(s.lockRunning("a")).toBe(false);
  });

  test("swings refresh the lock again once they're back", () => {
    const s = dropped();
    run(s, 30);
    s.reconnectPlayer("a");
    run(s, 34);
    expect(s.lockRunning("a")).toBe(true);
  });

  test("loses the lock at respawn, like anyone", () => {
    const s = dropped(0, 0);
    player(s).health = 1;
    const events = run(s, 15);
    expect(swingTicks(events, "playerRespawned").length).toBe(1);
    expect(s.lockRunning("a")).toBe(false);
  });
});

describe("several players", () => {
  test("each earns from their own damage; the Spider targets the latest swinger and keeps its rhythm", () => {
    const s = fight(NEXT_TO, 0, 0); // a hits on tick 1; everything after misses.
    s.addPlayer("a");
    s.addPlayer("b");
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(spider(s).target).toBe("a");
    run(s, 1);
    s.queueTarget("b", "0");
    events.push(...run(s, 1)); // b's first swing, on tick 3.
    expect(spider(s).target).toBe("b");
    events.push(...run(s, 6)); // a's second, on tick 9.
    expect(spider(s).target).toBe("a");
    events.push(...run(s, 4));

    expect(player(s, "a").combatXp).toBe(6);
    expect(player(s, "b").combatXp).toBe(0);
    expect(swingTicks(events, "enemySwing")).toEqual([5, 13]);
    expect(events.filter((e) => e.type === "enemySwing")[0]).toMatchObject({
      player: "b",
    });
    expect(events.filter((e) => e.type === "enemySwing")[1]).toMatchObject({
      player: "b",
    });
  });
});

describe("the end of a fight", () => {
  test("clicking something else ends it", () => {
    const s = fight();
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s).target).toBe("0");
    s.queueWalk("a", { x: 5, y: 2 }); // Still walking when the Spider swings on tick 5.
    const events = run(s, 8);
    expect(player(s).target).toBe("");
    expect(swingTicks(events, "playerSwing")).toEqual([]);
  });

  test("the killing blow ends it for everyone on that Spider, and nothing retargets", () => {
    // Two Spiders, and b still walking up when a lands the blow.
    const rows = ["TTTTTTTTTT", "TRSS.....T", "T........T", "TTTTTTTTTT"];
    const s = fight(rows, 0, 0.99);
    s.addPlayer("a");
    s.addPlayer("b", { ...SAVE, x: 8, y: 2 });
    spider(s).health = 1;
    s.queueTarget("a", "0");
    s.queueTarget("b", "0");
    const events = run(s, 20);
    expect(player(s, "a").target).toBe("");
    expect(player(s, "b").target).toBe("");
    expect(player(s, "b").x).toBe(7); // Its one step, on the same tick as the blow.
    expect(s.state.enemies.get("1")!.state).toBe("idle");
    expect(swingTicks(events, "playerSwing")).toEqual([1]);
    expect(swingTicks(events, "enemyDied")).toEqual([1]);
  });
});

describe("fighting back", () => {
  /** Sets an enemy on a player, so its next due swing comes with no swing of theirs before it. */
  const setOn = (s: Simulation, id: string, enemy = "0") =>
    Object.assign(s.state.enemies.get(enemy)!, {
      state: "fighting",
      target: id,
    });

  test("an idle player swung at fights that enemy, replying 4 ticks later and then every 8", () => {
    const s = fight();
    s.addPlayer("a");
    setOn(s, "a");
    const first = run(s, 1);
    expect(swingTicks(first, "enemySwing")).toEqual([1]);
    expect(player(s).target).toBe("0");
    expect(player(s).action).toBe("fighting");
    const events = run(s, 12);
    expect(swingTicks(events, "playerSwing")).toEqual([5, 13]);
  });

  test("a walk to a station stops next to it, idle, so an enemy's swing is still fought back", () => {
    const s = fight(["TTTTTTTT", "TR..N..T", "T..S...T", "TTTTTTTT"]);
    s.addPlayer("a");
    s.queueWalk("a", { x: 4, y: 1 });
    run(s, 6);
    expect(player(s)).toMatchObject({ x: 3, y: 1, action: "" });
    Object.assign(setOn(s, "a"), { x: 3, y: 2 });
    run(s, 2);
    expect(player(s)).toMatchObject({ target: "0", action: "fighting" });
  });

  test("the reply waits for the player's swing timer, if that says later", () => {
    // A second Spider at (1,2), also next to the player.
    const s = fight(["TTTTTTT", "TRS...T", "TS....T", "TTTTTTT"]);
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1); // Swings on tick 1, so the next can't come before 9.
    s.queueWalk("a", { x: 1, y: 1 });
    setOn(s, "a", "1");
    const events = run(s, 9); // Its swing comes on tick 2, so 6 would be 4 later.
    expect(player(s).target).toBe("1");
    expect(swingTicks(events, "playerSwing")).toEqual([9]);
  });

  test("a walking player carries on", () => {
    const s = fight(CORRIDOR);
    s.addPlayer("a");
    s.queueWalk("a", { x: 5, y: 1 });
    setOn(s, "a");
    const events = run(s, 8); // Arrives on tick 7, before the Spider's second swing on 9.
    expect(swingTicks(events, "enemySwing")).toEqual([1]);
    expect(swingTicks(events, "playerSwing")).toEqual([]);
    expect(player(s).x).toBe(5);
    expect(player(s).target).toBe("");
  });

  test("a player picking carries on", () => {
    // The bush at (3,1), and the Spider next to the player at the tile they stop on.
    const s = fight(["TTTTTTT", "TRSb..T", "T.....T", "TTTTTTT"]);
    s.addPlayer("a");
    s.queueGather("a", "herblaw", siteId({ x: 3, y: 1 }));
    setOn(s, "a");
    const events = run(s, 7);
    expect(swingTicks(events, "enemySwing")).toEqual([1]);
    expect(swingTicks(events, "playerSwing")).toEqual([]);
    expect(player(s).action).toBe("herblaw");
  });

  test("a dropped player doesn't", () => {
    const s = fight();
    s.addPlayer("a");
    s.dropPlayer("a");
    setOn(s, "a");
    const events = run(s, 6);
    expect(swingTicks(events, "enemySwing")).toEqual([1]);
    expect(player(s).target).toBe("");
    expect(swingTicks(events, "playerSwing")).toEqual([]);
  });

  test("a player killed by the swing doesn't", () => {
    const s = fight(NEXT_TO, 0, 0);
    s.addPlayer("a");
    player(s).health = 1;
    setOn(s, "a");
    run(s, 1);
    expect(player(s).dead).toBe(true);
    expect(player(s).target).toBe("");
  });
});

describe("a dead Spider", () => {
  const killed = () => {
    const s = fight(NEXT_TO, 0, 0.99);
    s.addPlayer("a");
    spider(s).health = 2;
    s.queueTarget("a", "0");
    run(s, 1);
    return s;
  };

  test("is dead, targets nobody, and doesn't swing or wander", () => {
    const s = killed();
    expect(spider(s)).toMatchObject({ health: 0, state: "dead", target: "" });
    Object.assign(spider(s), { x: 3, y: 2 });
    expect(run(s, 50)).toEqual([]);
    expect(spider(s)).toMatchObject({ x: 3, y: 2 });
  });

  test("returns 150 ticks later at its home with full health", () => {
    const s = killed();
    Object.assign(spider(s), { x: 3, y: 2 });
    expect(run(s, 149)).toEqual([]);
    expect(run(s, 1)).toEqual([
      { type: "enemyReturned", enemy: "0", tick: 151 },
    ]);
    expect(spider(s)).toMatchObject({
      x: 2,
      y: 1,
      health: 800,
      state: "idle",
      target: "",
    });
  });

  test("drops nothing", () => {
    const s = killed();
    expect(player(s).inventory.every((slot) => slot === "")).toBe(true);
  });

  test("can't be targeted, and the click keeps the walk", () => {
    const s = killed();
    s.queueWalk("a", { x: 3, y: 2 });
    s.queueTarget("a", "0");
    run(s, 10);
    expect(player(s)).toMatchObject({ x: 3, y: 2, target: "" });
  });

  test("can be fought again once it's back", () => {
    const s = killed();
    run(s, 150);
    s.queueTarget("a", "0");
    expect(swingTicks(run(s, 1), "playerSwing")).toEqual([152]);
  });
});

test("a swing's event says who, at whom, and the damage; a miss is 0", () => {
  const s = fight(NEXT_TO, 0, TOP);
  s.addPlayer("a");
  s.queueTarget("a", "0");
  expect(run(s, 5)).toEqual([
    {
      type: "playerSwing",
      player: "a",
      enemy: "0",
      damage: 200,
      critical: false,
      tick: 1,
    },
    {
      type: "enemySwing",
      enemy: "0",
      player: "a",
      damage: 0,
      blocked: false,
      tick: 5,
    },
  ]);
});
