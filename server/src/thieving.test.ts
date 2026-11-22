import {
  INVENTORY_SLOTS,
  PICKPOCKET_INTERVAL_TICKS,
  PICKPOCKETS,
  STACK_SIZE,
  STUN_TICKS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), and the drunk stands at (3,1): one step to (2,1) reaches him.
const TILES = parseRegion(
  ["TTTTTTT", "TR.U..T", "T.....T", "TTTTTTT"].join("\n"),
);
// The same, with a Skeleton's home at (1,2), next to the respawn tile. Skeletons attack first.
const SKELETON_TILES = parseRegion(
  ["TTTTTTT", "TR.U..T", "TK....T", "TTTTTTT"].join("\n"),
);

/** Rolls these in order, then `rest` for every roll after. */
const rolls =
  (rest: number, ...first: number[]) =>
  () =>
    first.length ? first.shift()! : rest;

/** A pickpocket that rolls 0 fails at level 1; one that rolls 0.99 succeeds and takes the most coins. */
const FAIL = 0;
const SUCCEED = 0.99;

/** A player at (1,1) with 1,000 max health, `health` of it left, and these items from slot 0. */
function thief(
  random: () => number,
  { health = 1000, thievingXp = 0, items = [] as string[], tiles = TILES } = {},
) {
  const sim = new Simulation(tiles, random);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  inventory.splice(0, items.length, ...items);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    thievingXp,
    health,
    inventory,
    inventoryCounts: items.map(() => STACK_SIZE),
  });
  return sim;
}

const player = (sim: Simulation) => sim.state.players.get("a")!;

/** Runs ticks, keeping every event. */
function runTicks(sim: Simulation, ticks: number) {
  const events: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    events.push(...sim.events.splice(0));
  }
  return events;
}

const lines = (events: WorldEvent[]) =>
  events.flatMap((event) => (event.type === "told" ? [event.line] : []));

const coins = (sim: Simulation) => {
  const slot = player(sim).inventory.indexOf("coins");
  return slot === -1 ? 0 : player(sim).inventoryCounts[slot];
};

describe("pickpocketing the drunk", () => {
  test("walks next to him and, on the tick of arrival, pays coins and Thieving experience, with Mastery's 7%", () => {
    const sim = thief(() => SUCCEED);
    sim.queuePickpocket("a", "drunk");
    const events = runTicks(sim, 1);

    expect(player(sim)).toMatchObject({ x: 2, y: 1 });
    expect(coins(sim)).toBe(PICKPOCKETS.drunk.coins.most);
    expect(player(sim).thievingXp).toBe(PICKPOCKETS.drunk.xp);
    // 7% of 8 is 56 hundredths of a point.
    expect(player(sim).masteryHundredths).toBe(56);
    expect(lines(events)).toEqual(["You pick the drunk's pocket."]);
  });

  test("now and then takes food instead of coins", () => {
    const sim = thief(rolls(SUCCEED, SUCCEED, 0));
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, 1);

    expect(player(sim).inventory[0]).toBe(PICKPOCKETS.drunk.rare.item);
    expect(coins(sim)).toBe(0);
  });

  test("puts on the ground what a full inventory can't hold", () => {
    const sim = thief(() => SUCCEED, {
      items: Array<string>(INVENTORY_SLOTS).fill("berry"),
    });
    sim.queuePickpocket("a", "drunk");
    const events = runTicks(sim, 1);

    expect(coins(sim)).toBe(0);
    expect([...sim.state.groundItems.values()]).toMatchObject([
      { item: "coins", count: 5, x: 2, y: 1 },
    ]);
    expect(lines(events)).toContain(
      "You pick the drunk's pocket. It is on the ground.",
    );
  });

  test("a failure deals a small hit, then stuns", () => {
    const sim = thief(() => FAIL);
    sim.queuePickpocket("a", "drunk");
    const events = runTicks(sim, 1);

    expect(player(sim).health).toBe(1000 - PICKPOCKETS.drunk.failHit);
    expect(player(sim).thievingXp).toBe(0);
    expect(coins(sim)).toBe(0);
    expect(lines(events)).toEqual([
      "The drunk catches you and shoves you. You're stunned.",
    ]);
    expect(sim.isBusy("a")).toBe(true);
  });

  test("a failure's hit never kills", () => {
    const sim = thief(() => FAIL, { health: 50 });
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, 1);

    expect(player(sim).health).toBe(1);
    expect(player(sim).dead).toBe(false);
  });

  test("while stunned, clicks are ignored and the player can't move or eat; after the stun they can", () => {
    const sim = thief(() => FAIL, { health: 500, items: ["cookedPerch"] });
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, 1);

    for (let tick = 1; tick < STUN_TICKS; tick++) {
      sim.queueWalk("a", { x: 2, y: 2 });
      sim.queueEat("a", 0);
      runTicks(sim, 1);
      expect(player(sim)).toMatchObject({ x: 2, y: 1, action: "" });
      expect(player(sim).inventory[0]).toBe("cookedPerch");
    }

    sim.queueWalk("a", { x: 2, y: 2 });
    runTicks(sim, 1);
    expect(sim.isBusy("a")).toBe(false);
    expect(player(sim)).toMatchObject({ x: 2, y: 2 });
  });

  test("no pickpocket of his fails 20 levels above his requirement", () => {
    const sim = thief(() => FAIL, { thievingXp: xpForLevel(21) });
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, 1);

    expect(player(sim).thievingXp).toBe(xpForLevel(21) + PICKPOCKETS.drunk.xp);
    expect(sim.isBusy("a")).toBe(false);
  });

  test("clicking again can't beat the attempt interval", () => {
    const sim = thief(() => SUCCEED);
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, 1);
    sim.queuePickpocket("a", "drunk");
    runTicks(sim, PICKPOCKET_INTERVAL_TICKS - 1);
    expect(player(sim).thievingXp).toBe(PICKPOCKETS.drunk.xp);

    runTicks(sim, 1);
    expect(player(sim).thievingXp).toBe(2 * PICKPOCKETS.drunk.xp);
  });

  test.each([["aldous"], ["constructor"], [7], [undefined]])(
    "ignores a click naming %s, which isn't a mark here",
    (target) => {
      const sim = thief(() => SUCCEED);
      sim.queuePickpocket("a", target);
      runTicks(sim, 2);
      expect(player(sim)).toMatchObject({ x: 1, y: 1, thievingXp: 0 });
    },
  );
});

describe("the busy state", () => {
  test("a stunned player can still be hit, and doesn't fight back while stunned", () => {
    const sim = thief(() => FAIL, { tiles: SKELETON_TILES });
    sim.makeBusy("a", 20, { hittable: true });
    const events = runTicks(sim, 10);

    expect(events.some((event) => event.type === "enemySwing")).toBe(true);
    expect(player(sim).action).toBe("");
  });

  test("a player busy without being hittable isn't noticed or hit", () => {
    const sim = thief(() => FAIL, { tiles: SKELETON_TILES });
    sim.makeBusy("a", 20, { hittable: false });
    const events = runTicks(sim, 10);

    expect(events.some((event) => event.type === "enemySwing")).toBe(false);
    expect(player(sim).health).toBe(1000);
  });

  test("ends on its tick, after which the player acts again", () => {
    const sim = thief(() => SUCCEED);
    sim.makeBusy("a", 3, { hittable: false });
    runTicks(sim, 2);
    expect(sim.isBusy("a")).toBe(true);
    runTicks(sim, 1);
    expect(sim.isBusy("a")).toBe(false);
  });
});
