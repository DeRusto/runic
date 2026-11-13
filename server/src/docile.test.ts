import { parseRegion, type WorldEvent } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";
import type { PlayerSave } from "./saves.ts";
import { loadWorldRegion } from "./worldRegion.ts";

const MISS = 0.99;
// A hit that lands for its maximum, and one for its minimum: the hit roll, then the damage roll.
const HIT = [0, 0.9999];
const MIN_HIT = [0, 0];

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
  herblawXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  inventory: [],
};

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

const events = (seen: ReturnType<typeof run>, type: WorldEvent["type"]) =>
  seen.filter((e) => e.type === type);
const damages = (seen: ReturnType<typeof run>) =>
  seen
    .filter((e): e is WorldEvent & { tick: number; damage: number } =>
      Boolean("damage" in e),
    )
    .map((e) => e.damage);
const lines = (seen: ReturnType<typeof run>) =>
  seen
    .filter((e): e is WorldEvent & { tick: number; line: string } =>
      Boolean("line" in e),
    )
    .map((e) => e.line);

const groundItem = (s: Simulation) => [...s.state.groundItems.values()][0]!;

// The Tarn Ox stands at (2,1), the Bristleback at (5,1) and the Cinderhorn at (8,1).
const CORRIDOR = ["TTTTTTTTTTTTTTTT", "TRX..P..Q......T", "TTTTTTTTTTTTTTTT"];

test("the region's shore, field and Boneyard's edge start a Tarn Ox, Bristleback and Cinderhorn at full health", () => {
  const s = new Simulation(loadWorldRegion().tiles, () => MISS);
  const kinds = (kind: string) =>
    [...s.state.enemies.values()].filter((enemy) => enemy.kind === kind);
  expect(kinds("tarnOx")).toHaveLength(4);
  expect(kinds("bristleback")).toHaveLength(4);
  expect(kinds("cinderhorn")).toHaveLength(3);
  expect(kinds("tarnOx").every(({ health }) => health === 200)).toBe(true);
  expect(kinds("cinderhorn").every(({ health }) => health === 1000)).toBe(true);
});

describe("a docile creature", () => {
  test("never targets a player, however close they stand, and never wanders", () => {
    const s = world(CORRIDOR);
    placed(s, "a", 3);
    const seen = run(s, 30);
    expect(s.state.enemies.get("0")).toMatchObject({
      state: "idle",
      target: "",
      x: 2,
    });
    expect(seen.some(({ type }) => type === "enemySwing")).toBe(false);
  });

  test("a hit on it never starts a fight, and it keeps standing", () => {
    const s = world(CORRIDOR, ...MIN_HIT);
    placed(s, "a", 3);
    s.queueTarget("a", "0");
    const seen = run(s, 1);
    expect(damages(seen)).toEqual([100]);
    expect(s.state.enemies.get("0")).toMatchObject({
      state: "idle",
      target: "",
      health: 100,
    });
  });

  test("a kill pays the game's Combat experience, 12 for a Tarn Ox's 200 health", () => {
    const s = world(CORRIDOR, ...HIT);
    placed(s, "a", 3);
    s.queueTarget("a", "0");
    run(s, 1);
    const player = s.state.players.get("a")!;
    expect(player.combatXp).toBe(12);
    expect(player.hitpointsXp).toBe(4050 + 12);
  });

  test("every player who damaged it finds its hide on the ground, at 100%", () => {
    const s = world(CORRIDOR, ...MIN_HIT, ...MIN_HIT);
    placed(s, "a", 1);
    placed(s, "b", 3);
    s.queueTarget("a", "0");
    s.queueTarget("b", "0");
    const seen = run(s, 1);
    const items = [...s.state.groundItems.values()];
    expect(items.map(({ item }) => item)).toEqual(["tarnHide", "tarnHide"]);
    expect(lines(seen)).toEqual([
      "You find a [Tarn hide]. It is on the ground.",
      "You find a [Tarn hide]. It is on the ground.",
    ]);
  });

  test("a killed Tarn Ox returns 150 ticks later at home with full health", () => {
    const s = world(CORRIDOR, ...HIT);
    placed(s, "a", 3);
    s.queueTarget("a", "0");
    run(s, 1);
    expect(s.state.enemies.get("0")!.state).toBe("dead");
    expect(events(run(s, 150), "enemyReturned")).toHaveLength(1);
    expect(s.state.enemies.get("0")).toMatchObject({
      x: 2,
      health: 200,
      state: "idle",
    });
  });

  test("a Skeleton's Emberbones roll as before, with no hide", () => {
    // A hit (two rolls), a no-crit roll, then the Emberbone's own roll.
    const s = world(["TTTTTTT", "TRK...T", "TTTTTTT"], ...MIN_HIT, 0.5, 0);
    placed(s, "a", 3);
    s.state.enemies.get("0")!.health = 100;
    s.queueTarget("a", "0");
    run(s, 1);
    expect(groundItem(s).item).toBe("emberbone");
  });
});
