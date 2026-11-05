import { MAX_XP, parseRegion, type WorldEvent } from "@runic/shared";
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

  test("a Spider doesn't swing at a target who isn't next to it", () => {
    const s = fight();
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    Object.assign(player(s), { x: 5, y: 2 });
    s.queueWalk("a", { x: 5, y: 2 });
    expect(swingTicks(run(s, 20), "spiderSwing")).toEqual([]);
  });

  test("a Spider whose target is gone stops fighting", () => {
    const s = fight();
    s.addPlayer("a");
    s.queueTarget("a", "0");
    run(s, 1);
    s.removePlayer("a");
    run(s, 1);
    expect(spider(s)).toMatchObject({ state: "idle", target: "" });
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

  // Until player death (#29) lands, so nobody can save or stand at 0 health.
  test("a hit can't take the last health point", () => {
    const hurt = spiderSwingWith({ health: 2 }, 0, 0.99);
    expect(hurt.health).toBe(1);
    expect(hurt.defenseXp).toBe(10);
    const s = fight(NEXT_TO, MISS, 0, 0.99);
    s.addPlayer("a", { ...SAVE, health: 1 });
    s.queueTarget("a", "0");
    const events = run(s, 5);
    expect(player(s)).toMatchObject({ health: 1, defenseXp: 6 });
    expect(events.at(-1)).toMatchObject({ type: "spiderSwing", damage: 0 });
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

  test("returns 100 ticks later at its home with full health", () => {
    const s = killed();
    Object.assign(spider(s), { x: 3, y: 2 });
    expect(run(s, 99)).toEqual([]);
    expect(run(s, 1)).toEqual([
      { type: "spiderReturned", spider: "0", tick: 101 },
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
    run(s, 100);
    s.queueTarget("a", "0");
    expect(swingTicks(run(s, 1), "playerSwing")).toEqual([102]);
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
