import { parseRegion, type WorldEvent } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";
import type { PlayerSave } from "./saves.ts";
import { loadWorldRegion } from "./worldRegion.ts";

const MISS = 0.99;
// The two rolls of one wander: whether it does, and which legal step, the first being east.
const WANDER = 0.05;
const EAST = 0;

/** Rolls come in order, and then everything misses (and nothing wanders). */
function world(rows: string[], ...rolls: number[]) {
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

const skeleton = (s: Simulation, id = "0") => s.state.enemies.get(id)!;

/** Puts a player on a tile, with no click needed. */
function placed(s: Simulation, id: string, x: number, y = 1) {
  s.addPlayer(id, { ...SAVE, x, y });
}

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

// The Skeleton's home is (8,1), with room on both sides.
const CORRIDOR = [
  "TTTTTTTTTTTTTTTTTTTT",
  "TR......K..........T",
  "TTTTTTTTTTTTTTTTTTTT",
];

test("6 Skeletons start from the region's K homes, at full health", () => {
  const s = new Simulation(loadWorldRegion(), () => MISS);
  const skeletons = [...s.state.enemies.values()].filter(
    (enemy) => enemy.kind === "skeleton",
  );
  expect(skeletons).toHaveLength(6);
  for (const one of skeletons) expect(one.health).toBe(24);
});

describe("noticing", () => {
  test("goes for a player within 3 tiles", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    run(s, 1);
    expect(skeleton(s)).toMatchObject({ state: "fighting", target: "a" });
  });

  test("ignores a player 4 tiles away", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 12);
    run(s, 1);
    expect(skeleton(s)).toMatchObject({ state: "idle", target: "" });
  });

  test("counts tiles straight through trees", () => {
    // A wall between them, with the way round through the gap at the bottom.
    const s = world(["TTTTTTT", "T.KT..T", "T..T..T", "TR....T", "TTTTTTT"]);
    placed(s, "a", 4);
    run(s, 1);
    expect(skeleton(s).target).toBe("a");
  });

  test("takes the nearest", () => {
    const s = world(CORRIDOR);
    placed(s, "far", 11);
    placed(s, "near", 6);
    run(s, 1);
    expect(skeleton(s).target).toBe("near");
  });

  test("takes the first checked on a tie", () => {
    const s = world(CORRIDOR);
    placed(s, "first", 10);
    placed(s, "second", 6);
    run(s, 1);
    expect(skeleton(s).target).toBe("first");
  });

  test("skips a dead player", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    s.state.players.get("a")!.dead = true;
    run(s, 1);
    expect(skeleton(s).state).toBe("idle");
  });

  test("skips a dropped player, until they're back", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    s.dropPlayer("a");
    run(s, 1);
    expect(skeleton(s).state).toBe("idle");
    s.reconnectPlayer("a");
    run(s, 1);
    expect(skeleton(s).target).toBe("a");
  });

  test("won't pick a player another Skeleton is after, but takes someone else", () => {
    const s = world(["TTTTTTTTTT", "TR.K.K...T", "TTTTTTTTTT"]);
    placed(s, "a", 4);
    run(s, 1);
    expect(skeleton(s, "0").target).toBe("a");
    expect(skeleton(s, "1")).toMatchObject({ state: "idle", target: "" });
    placed(s, "b", 8);
    run(s, 1);
    expect(skeleton(s, "1").target).toBe("b");
  });

  test("a Spider never notices", () => {
    const s = world(["TTTTTTT", "TRS...T", "TTTTTTT"]);
    placed(s, "a", 3);
    run(s, 3);
    expect(skeleton(s).state).toBe("idle");
  });
});

describe("the first swing", () => {
  test("next to it already: 4 ticks after noticing, then every 8", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    expect(swingTicks(run(s, 13), "enemySwing")).toEqual([5, 13]);
  });

  test("a short chase still waits out the 4 ticks", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 10); // One step to next to it, on tick 1.
    const events = run(s, 5);
    expect(skeleton(s).x).toBe(9);
    expect(swingTicks(events, "enemySwing")).toEqual([5]);
  });

  test("a chase longer than 4 ticks swings on arrival", () => {
    const s = world(CORRIDOR, WANDER, EAST);
    run(s, 1); // Wanders to (9,1), so its next step is due on tick 3.
    placed(s, "a", 12);
    run(s, 1); // Noticed on 2, so 4 ticks on is 6.
    s.queueWalk("a", { x: 13, y: 1 });
    const events = run(s, 6); // But it steps on 3, 5 and 7 to get next to them.
    expect(skeleton(s).x).toBe(12);
    expect(swingTicks(events, "enemySwing")).toEqual([7]);
  });

  test("never before its own swing timer", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    run(s, 5); // Swings on 5, so its next is due on 13.
    Object.assign(skeleton(s), { state: "idle", target: "" });
    // Notices on 6, which would make the first swing 10.
    expect(swingTicks(run(s, 8), "enemySwing")).toEqual([13]);
  });

  test("noticing alone doesn't set the combat lock, but the swing does", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    run(s, 4);
    expect(s.lockRunning("a")).toBe(false);
    run(s, 1);
    expect(s.lockRunning("a")).toBe(true);
  });
});

describe("the leash", () => {
  test("gives up when the player is more than 4 tiles from the notice tile", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    run(s, 3); // Noticed from (8,1), and stepped to (10,1).
    Object.assign(s.state.players.get("a")!, { x: 12 });
    run(s, 1);
    expect(skeleton(s).state).toBe("fighting");
    Object.assign(s.state.players.get("a")!, { x: 13 });
    run(s, 1);
    expect(skeleton(s)).toMatchObject({ state: "going home", target: "" });
  });

  test("counts from the notice tile, not its home", () => {
    const s = world(CORRIDOR, WANDER, EAST);
    run(s, 1);
    expect(skeleton(s).x).toBe(9);
    placed(s, "a", 12);
    run(s, 1); // Noticed from (9,1).
    Object.assign(s.state.players.get("a")!, { x: 13 });
    run(s, 1);
    expect(skeleton(s).state).toBe("fighting"); // 5 from home, but 4 from the notice tile.
  });

  test("being hit while chasing doesn't move the notice tile", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    s.queueTarget("a", "0");
    const events = run(s, 2); // Noticed from (8,1) on 1, then hit at (9,1) on 2.
    expect(swingTicks(events, "playerSwing")).toEqual([2]);
    expect(skeleton(s).x).toBe(9);
    Object.assign(s.state.players.get("a")!, { x: 13 }); // 4 from (9,1), but 5 from (8,1).
    s.queueWalk("a", { x: 13, y: 1 });
    run(s, 1);
    expect(skeleton(s).target).toBe("");
  });
});

describe("giving up", () => {
  /** A Skeleton that has just given up on "a", 4 tiles from home. */
  function givenUp() {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    run(s, 1);
    Object.assign(skeleton(s), { x: 12 });
    Object.assign(s.state.players.get("a")!, { x: 13 });
    run(s, 2);
    expect(skeleton(s).state).toBe("going home");
    return s;
  }

  test("walks home at player speed and recovers there", () => {
    const s = givenUp();
    skeleton(s).health = 5;
    const xs = [];
    for (let i = 0; i < 8; i++) {
      run(s, 1);
      xs.push(skeleton(s).x);
    }
    // Stepped on the tick it gave up, so 11 is already behind it.
    expect(xs).toEqual([11, 10, 10, 9, 9, 8, 8, 8]);
    expect(skeleton(s)).toMatchObject({ state: "idle", health: 24 });
  });

  test("ignores players it walks past", () => {
    const s = givenUp();
    Object.assign(s.state.players.get("a")!, { x: 9 }); // On its way home, and in range.
    run(s, 2);
    expect(skeleton(s)).toMatchObject({ state: "going home", target: "" });
  });

  test("can be attacked on the way, and keeps walking without fighting", () => {
    const s = givenUp();
    const a = s.state.players.get("a")!;
    Object.assign(a, { x: skeleton(s).x - 1 });
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(swingTicks(events, "playerSwing")).toEqual([4]);
    expect(skeleton(s)).toMatchObject({ state: "going home", target: "" });
    expect(swingTicks(events, "enemySwing")).toEqual([]);
  });

  test("damage on the way counts, and can kill it", () => {
    const s = givenUp();
    const a = s.state.players.get("a")!;
    Object.assign(a, { x: skeleton(s).x - 1 });
    skeleton(s).health = 1;
    // The hit roll, then the damage roll.
    const rolls = [0, 0];
    Object.assign(s, { random: () => rolls.shift() ?? MISS });
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(events.map((e) => e.type)).toContain("enemyDied");
    expect(skeleton(s).state).toBe("dead");
  });

  test("a Spider hit on its way home still starts a new fight", () => {
    const s = world(["TTTTTTTTT", "TRS.....T", "TTTTTTTTT"]);
    placed(s, "a", 3);
    skeleton(s).state = "going home";
    s.queueTarget("a", "0");
    run(s, 1);
    expect(skeleton(s)).toMatchObject({ state: "fighting", target: "a" });
  });
});

describe("walking away", () => {
  test("a player who keeps walking is never caught, and it gives up", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 11);
    s.queueWalk("a", { x: 18, y: 1 });
    const events = run(s, 20);
    expect(swingTicks(events, "enemySwing")).toEqual([]);
    expect(s.state.players.get("a")!.x).toBe(18);
    expect(skeleton(s).state).not.toBe("fighting");
  });
});

describe("fighting back", () => {
  test("an idle player a Skeleton swings at replies 4 ticks later, then every 8", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    const events = run(s, 17);
    expect(swingTicks(events, "enemySwing")).toEqual([5, 13]);
    expect(swingTicks(events, "playerSwing")).toEqual([9, 17]);
  });

  test("a walking player carries on", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    run(s, 4);
    s.queueWalk("a", { x: 18, y: 1 });
    const events = run(s, 6);
    expect(swingTicks(events, "playerSwing")).toEqual([]);
  });

  test("a dropped player doesn't", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 9);
    run(s, 1); // Noticed while connected.
    s.dropPlayer("a");
    const events = run(s, 12);
    expect(swingTicks(events, "enemySwing")).toEqual([5, 13]);
    expect(swingTicks(events, "playerSwing")).toEqual([]);
  });
});

test("a player who hits a second Skeleton can end up fighting both", () => {
  const s = world(["TTTTTTTTTT", "TR.K.K...T", "TTTTTTTTTT"]);
  placed(s, "a", 4);
  run(s, 1);
  expect(skeleton(s, "1").state).toBe("idle");
  s.queueTarget("a", "1");
  run(s, 1);
  expect(skeleton(s, "0").target).toBe("a");
  expect(skeleton(s, "1").target).toBe("a");
});

test("a killed Skeleton returns 200 ticks later at home with full health", () => {
  const s = world(CORRIDOR, 0, 0); // The hit roll, then the damage roll.
  placed(s, "a", 9);
  skeleton(s).health = 1;
  s.queueTarget("a", "0");
  const events = run(s, 1);
  expect(swingTicks(events, "enemyDied")).toEqual([1]);
  expect(skeleton(s).state).toBe("dead");
  expect(swingTicks(run(s, 200), "enemyReturned")).toEqual([201]);
  // Back, and the player beside it is a player it can notice on the next tick.
  expect(skeleton(s)).toMatchObject({ x: 8, health: 24 });
});
