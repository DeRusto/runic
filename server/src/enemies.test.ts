import { ENEMIES, parseRegion } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Enemies, Enemy, type EnemyWorld } from "./enemies.ts";

const MISS = 0.99;

/** Enemies on a small map, with rolls handed out in order and then everything missing. */
function region(rows: string[], ...rolls: number[]) {
  const synced = new Map<string, InstanceType<typeof Enemy>>();
  const enemies = new Enemies(
    parseRegion(rows.join("\n")),
    synced,
    () => rolls.shift() ?? MISS,
  );
  return { enemies, synced };
}

type Fighter = { x: number; y: number; health: number; dead: boolean };

/** A world of these players, live, that records each swing asked for and takes `damage` off. */
function world(players: Record<string, Fighter>, damage = 0) {
  const swings: { tick: number; enemy: string; player: string }[] = [];
  let tick = 0;
  const view = (): EnemyWorld => ({
    tick,
    players: () =>
      Object.entries(players).map(([id, player]) => ({
        id,
        player,
        dropped: false,
      })),
    player: (id) => players[id],
    swing: (enemy, player) => {
      swings.push({ tick, enemy, player });
      players[player]!.health = Math.max(0, players[player]!.health - damage);
    },
  });
  return {
    swings,
    /** Advances these enemies `ticks` ticks. */
    run(enemies: Enemies, ticks: number) {
      for (let i = 0; i < ticks; i++) {
        tick++;
        enemies.advance(view());
      }
      return tick;
    },
    get tick() {
      return tick;
    },
  };
}

const at = (x: number, y = 0): Fighter => ({ x, y, health: 1000, dead: false });

test("each enemy tile becomes a synced enemy at full health, numbered in map order", () => {
  const { synced } = region(["S..K", "X..."]);
  expect(
    [...synced].map(([id, { kind, x, y, health }]) => [id, kind, x, y, health]),
  ).toEqual([
    ["0", "spider", 0, 0, 800],
    ["1", "skeleton", 3, 0, 2400],
    ["2", "tarnOx", 0, 1, 200],
  ]);
});

describe("a Skeleton", () => {
  test("notices the nearest player within 3 tiles, walks up and swings after its first delay", () => {
    const { enemies, synced } = region(["K.....", "......"]);
    const w = world({ far: at(5), near: at(3) });
    w.run(enemies, 1);
    expect(synced.get("0")).toMatchObject({
      state: "fighting",
      target: "near",
    });
    w.run(enemies, 6);
    // It stops next to them, and its first swing waits out the delay from tick 1.
    expect(synced.get("0")).toMatchObject({ x: 2, y: 0 });
    expect(w.swings).toEqual([
      {
        tick: 1 + ENEMIES.skeleton.firstSwingDelayTicks,
        enemy: "0",
        player: "near",
      },
    ]);
  });

  test("past its leash it goes home, and recovers its health there", () => {
    const { enemies, synced } = region(["K.........."]);
    const target = at(2);
    const w = world({ target });
    w.run(enemies, 1);
    synced.get("0")!.health = 100;
    target.x = 10;
    w.run(enemies, 1);
    expect(synced.get("0")).toMatchObject({ state: "going home", target: "" });
    w.run(enemies, 20);
    expect(synced.get("0")).toMatchObject({
      state: "idle",
      x: 0,
      health: 2400,
    });
  });

  test("on its way home it takes a hit without turning back", () => {
    const { enemies, synced } = region(["K.........."]);
    const target = at(2);
    const w = world({ target });
    w.run(enemies, 1);
    target.x = 10;
    w.run(enemies, 1);
    enemies.struck(w.tick, "0", "target", 100);
    expect(synced.get("0")).toMatchObject({
      state: "going home",
      health: 2300,
    });
  });

  test("a killing blow returns each damager's Emberbone roll, then it comes back after its return time", () => {
    const { enemies, synced } = region(["K"], 0.1, MISS);
    enemies.struck(1, "0", "a", 100);
    enemies.struck(2, "0", "b", 100);
    expect(enemies.struck(3, "0", "a", 2200)).toEqual([
      { player: "a", item: "emberbone", count: 1 },
    ]);
    expect(synced.get("0")).toMatchObject({ state: "dead", target: "" });
    const back = 3 + ENEMIES.skeleton.returnTicks;
    expect(enemies.returnDead(back - 1)).toEqual([]);
    expect(enemies.returnDead(back)).toEqual(["0"]);
    expect(synced.get("0")).toMatchObject({ state: "idle", health: 2400 });
  });
});

describe("a Spider", () => {
  test("ignores players until hit, then fights whoever hit it", () => {
    const { enemies, synced } = region(["S.."]);
    const w = world({ a: at(1) });
    w.run(enemies, 3);
    expect(synced.get("0")).toMatchObject({ state: "idle", target: "" });
    enemies.struck(w.tick, "0", "a", 0);
    expect(synced.get("0")).toMatchObject({ state: "fighting", target: "a" });
  });

  test("stops fighting a player its swing kills, settling at once when already home", () => {
    const { enemies, synced } = region(["S.."]);
    const w = world({ a: at(1) }, 1000);
    enemies.struck(0, "0", "a", 0);
    w.run(enemies, ENEMIES.spider.firstSwingDelayTicks);
    expect(w.swings).toHaveLength(1);
    expect(synced.get("0")).toMatchObject({ state: "idle", target: "", x: 0 });
  });

  test("wanders a step at its chance, staying near home", () => {
    // Two rolls: whether it wanders, and which legal step, the first being east.
    const { enemies, synced } = region(["S.."], 0.05, 0);
    world({}).run(enemies, 1);
    expect(synced.get("0")).toMatchObject({ x: 1, y: 0 });
  });
});

describe("a docile creature (#238)", () => {
  test("never turns to fight, and every damager gets its hide with no roll", () => {
    const { enemies, synced } = region(["X.."]);
    enemies.struck(1, "0", "a", 100);
    expect(synced.get("0")).toMatchObject({ state: "idle", target: "" });
    expect(enemies.struck(2, "0", "b", 100)).toEqual([
      { player: "a", item: "tarnHide", count: 1 },
      { player: "b", item: "tarnHide", count: 1 },
    ]);
  });

  test("stands still: it never notices, wanders or swings", () => {
    const { enemies, synced } = region(["X.."], 0, 0);
    const w = world({ a: at(1) });
    w.run(enemies, 10);
    expect(synced.get("0")).toMatchObject({ x: 0, state: "idle" });
    expect(w.swings).toEqual([]);
  });
});

test("a player who leaves wins no loot (spec D8)", () => {
  const { enemies } = region(["X"]);
  enemies.struck(1, "0", "a", 100);
  enemies.forget("a");
  expect(enemies.struck(2, "0", "b", 100)).toEqual([
    { player: "b", item: "tarnHide", count: 1 },
  ]);
});
