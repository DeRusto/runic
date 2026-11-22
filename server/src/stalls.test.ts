import {
  INVENTORY_SLOTS,
  PICKPOCKET_INTERVAL_TICKS,
  STALLS,
  STALL_LOCKOUT_TICKS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// Players start on the respawn tile (1,2). The food stall stands at (2,1), the fish stall at
// (4,1) and the gem stall at (6,1), along the top row, each a step or so from the row below.
const TILES = parseRegion(
  ["TTTTTTTT", "T.s.q.zT", "TR.....T", "T......T", "TTTTTTTT"].join("\n"),
);

/** Rolls these in order, then `rest` for every roll after. */
const rolls =
  (rest: number, ...first: number[]) =>
  () =>
    first.length ? first.shift()! : rest;

/** A theft that rolls 0 fails at the stall's level; one that rolls 0.99 succeeds and takes the last row's most. */
const FAIL = 0;
const SUCCEED = 0.99;

/** Adds a player `id`, logged in as `username`, on the respawn tile with an empty inventory. */
function addThief(
  sim: Simulation,
  id: string,
  username: string,
  thievingXp: number,
) {
  sim.addPlayer(
    id,
    {
      x: 1,
      y: 2,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      thievingXp,
      health: 1000,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
      inventoryCounts: [],
    },
    username,
  );
}

/** A region with player "a" (Ada) at Thieving `level`, rolling with `random`. */
function thief(random: () => number, level = 25) {
  const sim = new Simulation(TILES, random);
  addThief(sim, "a", "ada", xpForLevel(level));
  return sim;
}

const player = (sim: Simulation, id = "a") => sim.state.players.get(id)!;

/** Runs ticks, keeping every event. */
function runTicks(sim: Simulation, ticks: number) {
  const events: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    events.push(...sim.events.splice(0));
  }
  return events;
}

const lines = (events: WorldEvent[], id = "a") =>
  events.flatMap((event) =>
    event.type === "told" && event.player === id ? [event.line] : [],
  );

/** How many items, of any kind, the player holds. */
const itemsHeld = (sim: Simulation, id = "a") =>
  [...player(sim, id).inventoryCounts].reduce((sum, n) => sum + n, 0);

/** Steals from `stall`, running ticks until the player is told how it went, or 10 for a click that's ignored. */
function steal(sim: Simulation, stall: unknown, id = "a") {
  sim.queueSteal(id, stall);
  const events: WorldEvent[] = [];
  for (let tick = 0; tick < 10 && !lines(events, id).length; tick++)
    events.push(...runTicks(sim, 1));
  return events;
}

describe.each([["food"], ["fish"], ["gem"]] as const)(
  "the %s stall",
  (kind) => {
    const { level, xp, loot, emptyTicks } = STALLS[kind];

    test("is refused a level below its requirement", () => {
      const sim = thief(() => SUCCEED, level - 1);
      steal(sim, kind);
      expect(player(sim)).toMatchObject({ x: 1, y: 2 });
      expect(player(sim).thievingXp).toBe(xpForLevel(level - 1));
      expect(itemsHeld(sim)).toBe(0);
    });

    test("at its requirement, a theft takes items, never coins, and pays experience", () => {
      const sim = thief(() => SUCCEED, level);
      const events = steal(sim, kind);
      const last = loot.at(-1)!;
      expect(player(sim).inventory).toContain(last.item);
      expect(player(sim).inventory).not.toContain("coins");
      expect(itemsHeld(sim)).toBe(last.most);
      expect(player(sim).thievingXp).toBe(xpForLevel(level) + xp);
      expect(lines(events)).toEqual([`You take from the ${kind} stall.`]);
      expect(events).toContainEqual({
        type: "stallEmptied",
        player: "a",
        stall: kind,
        ticks: emptyTicks,
      });
    });

    test("after a theft it is empty for that player until its timer runs out", () => {
      const sim = thief(() => SUCCEED, level);
      steal(sim, kind);
      const held = itemsHeld(sim);

      // Each try waits out the attempt interval, so only the empty stall can stop it.
      runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
      const events = steal(sim, kind);
      expect(itemsHeld(sim)).toBe(held);
      expect(lines(events)).toEqual([
        `The ${kind} stall is empty. Come back soon.`,
      ]);

      runTicks(sim, emptyTicks);
      steal(sim, kind);
      expect(itemsHeld(sim)).toBeGreaterThan(held);
    });
  },
);

describe("Marta's stalls", () => {
  test("a stall emptied by one player can still be stolen from by another", () => {
    const sim = thief(() => SUCCEED);
    addThief(sim, "b", "bo", xpForLevel(25));
    steal(sim, "fish", "a");
    steal(sim, "fish", "b");
    expect(itemsHeld(sim, "b")).toBeGreaterThan(0);
  });

  test("a stall emptied for a player stays empty if they leave and come back", () => {
    const sim = thief(() => SUCCEED);
    steal(sim, "fish");
    sim.removePlayer("a");
    addThief(sim, "a2", "ada", xpForLevel(25));
    runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
    const events = steal(sim, "fish", "a2");
    expect(itemsHeld(sim, "a2")).toBe(0);
    expect(lines(events, "a2")).toEqual([
      "The fish stall is empty. Come back soon.",
    ]);
  });

  test("a failure gives no loot, no hit and no stun, and Marta closes that stall to the player", () => {
    const sim = thief(() => FAIL, 15);
    const events = steal(sim, "fish");
    expect(itemsHeld(sim)).toBe(0);
    expect(player(sim).health).toBe(1000);
    expect(player(sim).thievingXp).toBe(xpForLevel(15));
    expect(sim.isBusy("a")).toBe(false);
    expect(events.some((event) => event.type === "stunned")).toBe(false);
    expect(lines(events)).toEqual([
      "Marta catches you at the fish stall. She won't let you near it for a while.",
    ]);
  });

  test("the lockout holds for its length, then ends", () => {
    // The first theft fails; every roll after succeeds.
    const sim = thief(rolls(SUCCEED, FAIL), 15);
    steal(sim, "fish");

    runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
    const events = steal(sim, "fish");
    expect(itemsHeld(sim)).toBe(0);
    expect(lines(events)).toEqual([
      "Marta won't let you near the fish stall yet.",
    ]);

    runTicks(sim, STALL_LOCKOUT_TICKS);
    steal(sim, "fish");
    expect(itemsHeld(sim)).toBeGreaterThan(0);
  });

  test("a lockout leaves the player's other stalls and other players alone", () => {
    const sim = thief(rolls(SUCCEED, FAIL), 15);
    addThief(sim, "b", "bo", xpForLevel(25));
    steal(sim, "fish", "a");

    steal(sim, "fish", "b");
    expect(itemsHeld(sim, "b")).toBeGreaterThan(0);
    runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
    steal(sim, "food", "a");
    expect(itemsHeld(sim, "a")).toBeGreaterThan(0);
  });

  test.each([["constructor"], ["coins"], [7], [undefined]])(
    "ignores a click naming %s, which isn't a stall",
    (stall) => {
      const sim = thief(() => SUCCEED);
      steal(sim, stall);
      expect(player(sim)).toMatchObject({
        x: 1,
        y: 2,
        thievingXp: xpForLevel(25),
      });
    },
  );

  test("ignores a click on a stall the region doesn't have", () => {
    const sim = new Simulation(parseRegion("TTTT\nTR.T\nTTTT"), () => SUCCEED);
    addThief(sim, "a", "ada", xpForLevel(25));
    steal(sim, "fish");
    expect(itemsHeld(sim)).toBe(0);
  });
});
