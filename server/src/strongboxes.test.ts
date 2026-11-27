import {
  INVENTORY_SLOTS,
  PICKPOCKET_INTERVAL_TICKS,
  PLAYER_DEAD_TICKS,
  STRONGBOXES,
  STUN_TICKS,
  parseRegion,
  xpForLevel,
  type StrongboxKind,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// Players start on the respawn tile (1,2). The Boneyard strongbox stands at (2,1) and Runestone
// Hollow's at (5,1), along the top row, each a step or so from the row below.
const TILES = parseRegion(
  ["TTTTTTTT", "T.v..V.T", "TR.....T", "T......T", "TTTTTTTT"].join("\n"),
);

/** Rolls these in order, then `rest` for every roll after. */
const rolls =
  (rest: number, ...first: number[]) =>
  () =>
    first.length ? first.shift()! : rest;

/** An attempt that rolls 0 fails at the strongbox's level; one that rolls 0.99 succeeds. */
const FAIL = 0;
const SUCCEED = 0.99;

/** Adds a player `id`, logged in as `username`, on the respawn tile with an empty inventory and `health`. */
function addThief(
  sim: Simulation,
  id: string,
  username: string,
  thievingXp: number,
  health = 3000,
) {
  sim.addPlayer(
    id,
    {
      x: 1,
      y: 2,
      defenseXp: 0,
      herblawXp: 0,
      // Hitpoints 30: room for every trap's hit with health to spare.
      hitpointsXp: xpForLevel(30),
      thievingXp,
      health,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
      inventoryCounts: [],
    },
    username,
  );
}

/** A region with player "a" (Ada) at Thieving `level` and `health`, rolling with `random`. */
function thief(random: () => number, level = 55, health?: number) {
  const sim = new Simulation(TILES, random);
  addThief(sim, "a", "ada", xpForLevel(level), health);
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

/** How many of `item` the player holds. */
const held = (sim: Simulation, item: string, id = "a") => {
  const { inventory, inventoryCounts } = player(sim, id);
  return [...inventory].reduce(
    (sum, slot, i) => sum + (slot === item ? (inventoryCounts[i] ?? 0) : 0),
    0,
  );
};

/** How many items, of any kind, the player holds. */
const itemsHeld = (sim: Simulation, id = "a") =>
  [...player(sim, id).inventoryCounts].reduce((sum, n) => sum + n, 0);

/** Opens `strongbox`, running ticks until the player is told how it went, or 10 for a click that's ignored. */
function open(sim: Simulation, strongbox: unknown, id = "a") {
  sim.queueOpen(id, strongbox);
  const events: WorldEvent[] = [];
  for (let tick = 0; tick < 10 && !lines(events, id).length; tick++)
    events.push(...runTicks(sim, 1));
  return events;
}

const NAMES: Record<StrongboxKind, string> = {
  boneyard: "the Boneyard strongbox",
  hollow: "the Runestone Hollow strongbox",
};

describe.each([["boneyard"], ["hollow"]] as const)(
  "the %s strongbox",
  (kind) => {
    const { level, xp, coins, emptyTicks, trapHit } = STRONGBOXES[kind];
    const name = NAMES[kind];
    const capitalised = name[0]!.toUpperCase() + name.slice(1);

    test("is refused a level below its requirement", () => {
      const sim = thief(() => SUCCEED, level - 1);
      open(sim, kind);
      expect(player(sim)).toMatchObject({ x: 1, y: 2 });
      expect(player(sim).thievingXp).toBe(xpForLevel(level - 1));
      expect(itemsHeld(sim)).toBe(0);
    });

    test("at its requirement, opening it gives coins, a gem and runes, and pays experience", () => {
      const sim = thief(() => SUCCEED, level);
      const events = open(sim, kind);
      expect(held(sim, "coins")).toBe(coins.most);
      expect(held(sim, STRONGBOXES[kind].gems.at(-1)!.item)).toBe(1);
      expect(held(sim, "fireRune")).toBe(STRONGBOXES[kind].runes.at(-1)!.most);
      expect(player(sim).thievingXp).toBe(xpForLevel(level) + xp);
      expect(lines(events)).toEqual([`You open ${name}.`]);
      expect(events).toContainEqual({
        type: "strongboxEmptied",
        player: "a",
        strongbox: kind,
        ticks: emptyTicks,
      });
    });

    test("after a success it is empty for that player until its long timer runs out", () => {
      const beforeExpiry = thief(() => SUCCEED, level);
      open(beforeExpiry, kind);
      const before = itemsHeld(beforeExpiry);
      runTicks(beforeExpiry, emptyTicks - 2);
      beforeExpiry.queueOpen("a", kind);
      expect(lines(runTicks(beforeExpiry, 1))).toEqual([
        `${capitalised} is empty. Come back later.`,
      ]);
      expect(itemsHeld(beforeExpiry)).toBe(before);

      const atExpiry = thief(() => SUCCEED, level);
      open(atExpiry, kind);
      runTicks(atExpiry, emptyTicks - 1);
      atExpiry.queueOpen("a", kind);
      expect(lines(runTicks(atExpiry, 1))).toEqual([`You open ${name}.`]);
      expect(itemsHeld(atExpiry)).toBeGreaterThan(before);
    });

    test("a failure springs its trap: a hit harder than a pickpocket's, then a stun, and no loot", () => {
      const sim = thief(() => FAIL, level);
      const events = open(sim, kind);
      expect(itemsHeld(sim)).toBe(0);
      expect(player(sim).health).toBe(3000 - trapHit);
      expect(player(sim).thievingXp).toBe(xpForLevel(level));
      expect(sim.isBusy("a")).toBe(true);
      expect(events).toContainEqual({
        type: "trapSprung",
        player: "a",
        damage: trapHit,
      });
      expect(lines(events)).toEqual([`A trap springs as you open ${name}!`]);
      runTicks(sim, STUN_TICKS);
      expect(sim.isBusy("a")).toBe(false);
    });

    test("a trap that hits for all a player's health kills them, and they respawn as usual", () => {
      const sim = thief(() => FAIL, level, trapHit);
      const events = open(sim, kind);
      expect(player(sim)).toMatchObject({ health: 0, dead: true });
      expect(events).toContainEqual({
        type: "trapSprung",
        player: "a",
        damage: trapHit,
      });
      expect(events).toContainEqual({ type: "playerDied", player: "a" });

      const after = runTicks(sim, PLAYER_DEAD_TICKS);
      expect(after).toContainEqual({ type: "playerRespawned", player: "a" });
      expect(player(sim)).toMatchObject({
        dead: false,
        x: 1,
        y: 2,
        thievingXp: xpForLevel(level),
      });
      expect(player(sim).health).toBe(player(sim).maxHealth);
    });

    test("a trap never hits for more than the health a player has left", () => {
      const sim = thief(() => FAIL, level, 100);
      const events = open(sim, kind);
      expect(events).toContainEqual({
        type: "trapSprung",
        player: "a",
        damage: 100,
      });
      expect(player(sim).dead).toBe(true);
    });
  },
);

describe("strongboxes", () => {
  test("a strongbox emptied by one player can still be opened by another", () => {
    const sim = thief(() => SUCCEED);
    addThief(sim, "b", "bo", xpForLevel(55));
    open(sim, "hollow", "a");
    open(sim, "hollow", "b");
    expect(held(sim, "coins", "b")).toBeGreaterThan(0);
  });

  test("emptying one strongbox leaves the player's other strongbox full", () => {
    const sim = thief(() => SUCCEED);
    open(sim, "boneyard");
    const afterFirst = held(sim, "coins");
    runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
    open(sim, "hollow");
    expect(held(sim, "coins")).toBeGreaterThan(afterFirst);
  });

  test("a strongbox emptied for a player stays empty if they leave and come back", () => {
    const sim = thief(() => SUCCEED);
    open(sim, "boneyard");
    sim.removePlayer("a");
    addThief(sim, "a2", "ada", xpForLevel(55));
    expect(sim.emptiedFor("a2")).toEqual([
      {
        type: "strongboxEmptied",
        player: "a2",
        strongbox: "boneyard",
        ticks: STRONGBOXES.boneyard.emptyTicks,
      },
    ]);
    const events = open(sim, "boneyard", "a2");
    expect(itemsHeld(sim, "a2")).toBe(0);
    expect(lines(events, "a2")).toEqual([
      "The Boneyard strongbox is empty. Come back later.",
    ]);
  });

  test("a failure doesn't empty the strongbox: once the stun ends, the player can try again", () => {
    const sim = thief(rolls(SUCCEED, FAIL));
    open(sim, "hollow");
    runTicks(sim, STUN_TICKS);
    const events = open(sim, "hollow");
    expect(lines(events)).toEqual(["You open the Runestone Hollow strongbox."]);
  });

  test("a fatal trap drops what the player carries where they fell, as any death does (#119)", () => {
    // Six rolls open the Boneyard strongbox; every roll after fails, so the Hollow's trap kills.
    const sim = thief(
      rolls(FAIL, ...Array<number>(6).fill(SUCCEED)),
      55,
      STRONGBOXES.hollow.trapHit,
    );
    open(sim, "boneyard");
    const coins = held(sim, "coins");
    expect(coins).toBeGreaterThan(0);
    runTicks(sim, PICKPOCKET_INTERVAL_TICKS);
    open(sim, "hollow");
    const { x, y } = player(sim);
    expect(player(sim).dead).toBe(true);
    expect(itemsHeld(sim)).toBe(0);
    expect([...sim.state.groundItems.values()]).toContainEqual(
      expect.objectContaining({ x, y, item: "coins", count: coins }),
    );
    runTicks(sim, PLAYER_DEAD_TICKS);
    expect(player(sim).dead).toBe(false);
    expect(itemsHeld(sim)).toBe(0);
  });

  test.each([["constructor"], ["food"], [7], [undefined]])(
    "ignores a click naming %s, which isn't a strongbox",
    (strongbox) => {
      const sim = thief(() => SUCCEED);
      open(sim, strongbox);
      expect(player(sim)).toMatchObject({
        x: 1,
        y: 2,
        thievingXp: xpForLevel(55),
      });
    },
  );

  test("ignores a click on a strongbox the region doesn't have", () => {
    const sim = new Simulation(parseRegion("TTTT\nTR.T\nTTTT"), () => SUCCEED);
    addThief(sim, "a", "ada", xpForLevel(55));
    open(sim, "hollow");
    expect(itemsHeld(sim)).toBe(0);
  });
});
