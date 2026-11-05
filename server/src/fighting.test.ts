import { bushId, MAX_XP, parseRegion, type WorldEvent } from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;

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
  foragingXp: 0,
  hitpointsXp: 4050,
  health: 10,
  inventory: [],
};

const spider = (s: Simulation) => s.state.spiders.get("0")!;
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
    expect(swingTicks(events, "spiderSwing")).toEqual([5, 13, 21]);
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
    expect(swingTicks(events, "spiderSwing")).toEqual([5, 13]);
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
    expect(swingTicks(events, "spiderSwing")).toEqual([]);
    expect(swingTicks(run(s, 1), "spiderSwing")).toEqual([6]);
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
    spider(s).health = 3;
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
      { x: 3, health: 3, state: "going home" },
      { x: 3, health: 3, state: "going home" },
      { x: 2, health: 8, state: "idle" },
      { x: 2, health: 8, state: "idle" },
    ]);
    expect(swingTicks(events, "spiderSwing")).toEqual([]);
  });

  test("a Spider giving up on its home tile recovers there and then", () => {
    const s = fought();
    spider(s).health = 3;
    s.removePlayer("a");
    run(s, 1);
    expect(spider(s)).toMatchObject({ x: 2, health: 8, state: "idle" });
  });

  test("a swing on the way home starts a new fight from where it stands, with its health as it was", () => {
    const s = fought();
    spider(s).health = 3;
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
      health: 3,
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
      expect(spider(s).health).toBe(hits ? 7 : 8);
    },
  );

  test.each([
    { combatXp: 0, roll: 0, damage: 1 },
    { combatXp: 0, roll: 0.99, damage: 2 },
    { combatXp: 16200, roll: 0.99, damage: 2 }, // Level 19.
    { combatXp: 18050, roll: 0.99, damage: 3 }, // Level 20.
  ])(
    "with $combatXp Combat XP, a damage roll of $roll deals $damage",
    ({ combatXp, roll, damage }) => {
      const s = fight(NEXT_TO, 0, roll);
      s.addPlayer("a", { ...SAVE, combatXp });
      s.queueTarget("a", "0");
      run(s, 1);
      expect(spider(s).health).toBe(8 - damage);
    },
  );

  test("Combat and Hitpoints give 6 XP per damage, and a miss gives none", () => {
    const s = fight(NEXT_TO, 0, 0.99);
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: 12, hitpointsXp: 4062 });
    run(s, 8);
    expect(player(s)).toMatchObject({ combatXp: 12, hitpointsXp: 4062 });
  });

  test("overkill gives no XP", () => {
    const s = fight(NEXT_TO, 0, 0.99);
    s.addPlayer("a");
    spider(s).health = 1;
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: 6, hitpointsXp: 4056 });
  });

  test("XP stops at the cap", () => {
    const s = fight(NEXT_TO, 0, 0.99);
    s.addPlayer("a", { ...SAVE, combatXp: MAX_XP - 1, hitpointsXp: MAX_XP });
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ combatXp: MAX_XP, hitpointsXp: MAX_XP });
  });

  test("a Hitpoints level-up raises max health, not health", () => {
    const s = fight(NEXT_TO, 0, 0);
    s.addPlayer("a", { ...SAVE, hitpointsXp: 4045, health: 5 }); // 5 XP short of level 10.
    expect(player(s).maxHealth).toBe(9);
    s.queueTarget("a", "0");
    run(s, 1);
    expect(player(s)).toMatchObject({ maxHealth: 10, health: 5 });
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
        hits ? 9 : 10,
      );
    },
  );

  test.each([
    { roll: 0, damage: 1 },
    { roll: 0.99, damage: 2 },
  ])("a damage roll of $roll deals $damage", ({ roll, damage }) => {
    expect(spiderSwingWith({}, 0, roll).health).toBe(10 - damage);
  });

  test("Defense gives 6 XP for a miss", () => {
    expect(spiderSwingWith({}, MISS).defenseXp).toBe(6);
  });

  test("Defense gives 6 XP for a hit plus 4 per damage taken", () => {
    expect(spiderSwingWith({}, 0, 0.99).defenseXp).toBe(14);
  });

  test("Defense XP stops at the cap", () => {
    expect(spiderSwingWith({ defenseXp: MAX_XP - 1 }, MISS).defenseXp).toBe(
      MAX_XP,
    );
  });
});

describe("dying", () => {
  // Saved at (3,1), next to the Spider's home and away from the respawn tile (1,1).
  // The player misses on tick 1, and the Spider's hit on tick 5 rolls 2 damage.
  const dying = (saved: Partial<PlayerSave> = {}) => {
    const s = fight(NEXT_TO, MISS, 0, 0.99);
    s.addPlayer("a", { ...SAVE, x: 3, health: 1, ...saved });
    s.queueTarget("a", "0");
    return s;
  };

  test("a hit at 1 health kills, counting as a hit for 1, and the Spider gives up at once", () => {
    const s = dying();
    const events = run(s, 5);
    expect(player(s)).toMatchObject({
      health: 0,
      dead: true,
      target: "",
      defenseXp: 10,
    });
    expect(events.slice(-2)).toMatchObject([
      { type: "spiderSwing", damage: 1 },
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

  test("they stay on their tile for 5 ticks, then respawn at full health with everything kept", () => {
    const inventory = Array<string>(30).fill("");
    inventory[3] = "berry";
    const s = dying({ combatXp: 200, inventory });
    run(s, 5);
    expect(run(s, 4)).toEqual([]);
    expect(player(s)).toMatchObject({ x: 3, y: 1, health: 0, dead: true });
    expect(run(s, 1)).toMatchObject([{ type: "playerRespawned", player: "a" }]);
    expect(player(s)).toMatchObject({
      x: 1,
      y: 1,
      health: 10,
      dead: false,
      combatXp: 200,
      defenseXp: 10,
    });
    expect(player(s).inventory[3]).toBe("berry");
  });

  test("the fight doesn't resume after the respawn", () => {
    const s = dying();
    run(s, 10);
    expect(swingTicks(run(s, 20), "playerSwing")).toEqual([]);
  });

  test("a dead player's walk, target and eat intents are ignored", () => {
    const inventory = Array<string>(30).fill("");
    inventory[0] = "berry";
    const s = dying({ inventory });
    run(s, 5);
    s.queueWalk("a", { x: 5, y: 1 });
    s.queueEat("a", 0);
    s.queueTarget("a", "0");
    expect(run(s, 1)).toEqual([]);
    expect(player(s)).toMatchObject({ x: 3, health: 0, target: "" });
    expect(player(s).inventory[0]).toBe("berry");
    run(s, 10);
    expect(player(s).x).toBe(1);
  });

  test("a dead player's forage intent is ignored", () => {
    const s = fight(["TTTTTTT", "TRS.b.T", "TTTTTTT"], MISS, 0, 0.99);
    s.addPlayer("a", { ...SAVE, x: 3, health: 1 });
    s.queueTarget("a", "0");
    run(s, 5);
    s.queueForage("a", bushId({ x: 4, y: 1 }));
    expect(run(s, 4)).toEqual([]);
  });

  test("a dead player saves as already respawned, while still lying where they fell", () => {
    const s = dying({ combatXp: 200 });
    run(s, 5);
    expect(s.saveOf("a")).toMatchObject({
      x: 1,
      y: 1,
      health: 10,
      combatXp: 200,
      defenseXp: 10,
    });
    expect(player(s)).toMatchObject({ x: 3, health: 0 });
  });
});

describe("regeneration", () => {
  test("heals on every 20th tick, with no event, and stops at the maximum", () => {
    const s = fight();
    s.addPlayer("a", { ...SAVE, health: 8 });
    expect(run(s, 19)).toEqual([]);
    expect(player(s).health).toBe(8);
    expect(run(s, 1)).toEqual([]);
    expect(player(s).health).toBe(9);
    run(s, 40);
    expect(player(s).health).toBe(10);
  });

  test.each([
    { hitpointsXp: 4050, heals: 1 }, // Level 10.
    { hitpointsXp: 18050, heals: 1 }, // Level 20.
    { hitpointsXp: 20000, heals: 2 }, // Level 21.
    { hitpointsXp: MAX_XP, heals: 5 }, // Level 99.
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
    s.addPlayer("a", { ...SAVE, health: 5 });
    s.queueTarget("a", "0");
    run(s, 39);
    expect(player(s).health).toBe(5);
    run(s, 1);
    expect(player(s).health).toBe(6);
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
    expect(swingTicks(run(s, 10), "spiderSwing").length).toBeGreaterThan(0);
    expect(player(s).health).toBe(9);
  });

  test("has a lock that counts down and isn't refreshed by the Spider's swings", () => {
    const s = dropped();
    const events = run(s, 33);
    expect(swingTicks(events, "spiderSwing").at(-1)).toBeGreaterThan(20);
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
    expect(swingTicks(events, "spiderSwing")).toEqual([5, 13]);
    expect(events.filter((e) => e.type === "spiderSwing")[0]).toMatchObject({
      player: "b",
    });
    expect(events.filter((e) => e.type === "spiderSwing")[1]).toMatchObject({
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
    s.queueWalk("a", { x: 1, y: 2 });
    const events = run(s, 10);
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
    expect(s.state.spiders.get("1")!.state).toBe("idle");
    expect(swingTicks(events, "playerSwing")).toEqual([1]);
    expect(swingTicks(events, "spiderDied")).toEqual([1]);
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
      { type: "spiderReturned", spider: "0", tick: 151 },
    ]);
    expect(spider(s)).toMatchObject({
      x: 2,
      y: 1,
      health: 8,
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
  const s = fight(NEXT_TO, 0, 0.99);
  s.addPlayer("a");
  s.queueTarget("a", "0");
  expect(run(s, 5)).toEqual([
    { type: "playerSwing", player: "a", spider: "0", damage: 2, tick: 1 },
    { type: "spiderSwing", spider: "0", player: "a", damage: 0, tick: 5 },
  ]);
});
