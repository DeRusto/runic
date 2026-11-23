import {
  INVENTORY_SLOTS,
  OBSTACLES,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

/**
 * The respawn tile (1,1), the ridge stile's start at (2,1), a tree at (3,1) and its far end at
 * (4,1), in a pocket nobody can walk into.
 */
function region(obstacle: "ridgeStile" | "brambleSwing" = "ridgeStile") {
  const tiles = parseRegion(["TTTTTTTT", "TR.T...T", "TTTTTTTT"].join("\n"));
  tiles[1]![2] = { ...tiles[1]![2]!, obstacle };
  // The bramble swing lands three tiles back the other way, so it is placed at the far side.
  if (obstacle === "brambleSwing") {
    tiles[1]![2] = { ground: "grass", blocks: false, obstacleEnd: obstacle };
    tiles[1]![5] = { ground: "grass", blocks: false, obstacle };
  } else tiles[1]![4] = { ...tiles[1]![4]!, obstacleEnd: obstacle };
  return tiles;
}

/** A player at (1,1) with these Agility levels, health and items from slot 0. */
function crosser(
  random: () => number,
  {
    level = 1,
    health = 1000,
    items = [] as string[],
    riggedShortcuts = [] as string[],
    obstacle = "ridgeStile" as "ridgeStile" | "brambleSwing",
  } = {},
) {
  const sim = new Simulation(region(obstacle), random);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  inventory.splice(0, items.length, ...items);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    agilityXp: xpForLevel(level),
    health,
    inventory,
    inventoryCounts: items.map(() => 1),
    riggedShortcuts,
  });
  return sim;
}

const player = (sim: Simulation) => sim.state.players.get("a")!;

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

/** Rolls of 0 fail any crossing that can fail; 0.99 succeed every one. */
const FAIL = () => 0;
const SUCCEED = () => 0.99;

describe("a shortcut", () => {
  test("below its level, the click is ignored and the player stays put", () => {
    const sim = crosser(SUCCEED, { level: 9 });
    sim.queueCross("a", "ridgeStile");
    runTicks(sim, 12);
    expect(player(sim)).toMatchObject({ x: 1, y: 1, agilityXp: xpForLevel(9) });
  });

  test("at its level, it crosses one way and back, paying experience both ways", () => {
    const sim = crosser(SUCCEED, { level: 10 });
    const { xp, ticks } = OBSTACLES.ridgeStile;
    sim.queueCross("a", "ridgeStile");
    runTicks(sim, 2 + ticks);
    expect(player(sim)).toMatchObject({
      x: 4,
      y: 1,
      agilityXp: xpForLevel(10) + xp,
    });
    sim.queueCross("a", "ridgeStile");
    runTicks(sim, 1);
    expect(sim.isBusy("a")).toBe(true);
    runTicks(sim, ticks);
    expect(player(sim)).toMatchObject({
      x: 2,
      y: 1,
      agilityXp: xpForLevel(10) + 2 * xp,
    });
  });

  test("near its level, a failed crossing hits a little and leaves the player at the start", () => {
    const sim = crosser(FAIL, { level: 10 });
    sim.queueCross("a", "ridgeStile");
    const events = runTicks(sim, 2 + OBSTACLES.ridgeStile.ticks);
    const hit = OBSTACLES.ridgeStile.shortcut!.failHit;
    expect(player(sim)).toMatchObject({
      x: 2,
      y: 1,
      health: 1000 - hit,
      agilityXp: xpForLevel(10),
    });
    expect(events).toContainEqual({
      type: "slipped",
      player: "a",
      damage: hit,
    });
    expect(lines(events)).toContain(
      "You slip on the ridge stile and land back where you started.",
    );
    expect(sim.isBusy("a")).toBe(false);
  });

  test("a failed crossing never kills: it leaves at least 1 health", () => {
    const sim = crosser(FAIL, { level: 10, health: 40 });
    sim.queueCross("a", "ridgeStile");
    const events = runTicks(sim, 2 + OBSTACLES.ridgeStile.ticks);
    expect(player(sim)).toMatchObject({ x: 2, y: 1, health: 1, dead: false });
    expect(events).toContainEqual({ type: "slipped", player: "a", damage: 39 });
  });

  test("ten levels above its requirement it never fails, whatever the roll", () => {
    const sim = crosser(FAIL, { level: 20 });
    sim.queueCross("a", "ridgeStile");
    runTicks(sim, 2 + OBSTACLES.ridgeStile.ticks);
    expect(player(sim)).toMatchObject({ x: 4, y: 1, health: 1000 });
  });
});

describe("rigging a shortcut", () => {
  test("without a rope, an unrigged shortcut is refused with the reason", () => {
    const sim = crosser(SUCCEED, { level: 20, obstacle: "brambleSwing" });
    // The client shows the refusal; the server ignores the click.
    sim.queueCross("a", "brambleSwing");
    runTicks(sim, 12);
    expect(player(sim)).toMatchObject({ x: 1, y: 1 });
    expect([...player(sim).riggedShortcuts]).toEqual([]);
  });

  test("a rope dropped on the way is missed on arrival, and the player is told why", () => {
    const sim = crosser(SUCCEED, {
      level: 20,
      obstacle: "brambleSwing",
      items: ["rope"],
    });
    sim.queueCross("a", "brambleSwing");
    sim.queueDrop("a", 0, 1);
    const events = runTicks(sim, 12);
    expect(player(sim)).toMatchObject({ x: 2, y: 1 });
    expect([...player(sim).riggedShortcuts]).toEqual([]);
    expect(lines(events)).toContain(
      "You need a rope to rig the bramble swing.",
    );
  });

  test("the first crossing spends one rope, and the shortcut stays rigged for good", () => {
    const sim = crosser(SUCCEED, {
      level: 20,
      obstacle: "brambleSwing",
      items: ["rope"],
    });
    const { ticks } = OBSTACLES.brambleSwing;
    sim.queueCross("a", "brambleSwing");
    const events = runTicks(sim, 2 + ticks);
    expect(player(sim)).toMatchObject({ x: 5, y: 1 });
    expect([...player(sim).inventory]).not.toContain("rope");
    expect([...player(sim).riggedShortcuts]).toEqual(["brambleSwing"]);
    expect(lines(events)).toContain(
      "You tie a rope to the bramble swing. It stays rigged for you.",
    );
    for (let trip = 0; trip < 2; trip++) {
      sim.queueCross("a", "brambleSwing");
      runTicks(sim, 1 + ticks);
    }
    expect(player(sim)).toMatchObject({ x: 5, y: 1 });
    expect(sim.saveOf("a")).toMatchObject({
      riggedShortcuts: ["brambleSwing"],
    });
  });

  test("a rigged shortcut loads rigged and needs no rope", () => {
    const sim = crosser(SUCCEED, {
      level: 20,
      obstacle: "brambleSwing",
      riggedShortcuts: ["brambleSwing"],
    });
    sim.queueCross("a", "brambleSwing");
    runTicks(sim, 2 + OBSTACLES.brambleSwing.ticks);
    expect(player(sim)).toMatchObject({ x: 5, y: 1 });
  });

  test("a failed first crossing still spends the rope and leaves it rigged", () => {
    const sim = crosser(FAIL, {
      level: 20,
      obstacle: "brambleSwing",
      items: ["rope"],
    });
    sim.queueCross("a", "brambleSwing");
    runTicks(sim, 2 + OBSTACLES.brambleSwing.ticks);
    expect(player(sim)).toMatchObject({ x: 2, y: 1 });
    expect([...player(sim).inventory]).not.toContain("rope");
    expect([...player(sim).riggedShortcuts]).toEqual(["brambleSwing"]);
  });
});

describe("a save inside a pocket", () => {
  /** A save at `tile` for a player at this Agility level, with these shortcuts rigged. */
  const loadAt = (
    tile: { x: number; y: number },
    level: number,
    obstacle: "ridgeStile" | "brambleSwing",
    riggedShortcuts: string[] = [],
  ) => {
    const sim = new Simulation(region(obstacle), SUCCEED);
    sim.addPlayer("a", {
      ...tile,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      agilityXp: xpForLevel(level),
      health: 1000,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
      riggedShortcuts,
    });
    return player(sim);
  };

  test("loads at the shortcut's outer end when the player can't cross back out", () => {
    expect(loadAt({ x: 5, y: 1 }, 1, "ridgeStile")).toMatchObject({
      x: 2,
      y: 1,
    });
    expect(loadAt({ x: 4, y: 1 }, 20, "brambleSwing")).toMatchObject({
      x: 2,
      y: 1,
    });
  });

  test("stays put when the player can cross back out", () => {
    expect(loadAt({ x: 5, y: 1 }, 10, "ridgeStile")).toMatchObject({
      x: 5,
      y: 1,
    });
    expect(
      loadAt({ x: 4, y: 1 }, 20, "brambleSwing", ["brambleSwing"]),
    ).toMatchObject({ x: 4, y: 1 });
  });
});
