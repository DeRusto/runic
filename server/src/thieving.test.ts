import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  PICKPOCKET_INTERVAL_TICKS,
  STUN_TICKS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The drunk at (4,1); a Skeleton at (6,3), which notices a player within three tiles.
const TILES = parseRegion(
  ["TTTTTTTTT", "TR..U...T", "T.......T", "T.....K.T", "TTTTTTTTT"].join("\n"),
);
/** Each roll the simulation asks for, in turn; once they run out, `roll` again and again. */
let rolls: number[];
let roll: number;

let sim: Simulation;
let seen: { tick: number; event: WorldEvent }[];

beforeEach(() => {
  rolls = [];
  // Over the drunk's fail chance, and under every chance to hit.
  roll = 0.5;
  sim = new Simulation(TILES, () => rolls.shift() ?? roll);
  seen = [];
});

const player = (id = "a") => sim.state.players.get(id)!;

/** Adds a player at `x`,`y`, with `thievingXp` and `health`, holding `held`. */
function thief({
  id = "a",
  x = 2,
  y = 1,
  thievingXp = 0,
  health = 1000,
  held = [] as [string, number][],
} = {}) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT);
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  held.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer(
    id,
    {
      x,
      y,
      thievingXp,
      inventory,
      inventoryCounts,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health,
    },
    id,
  );
}

const run = (ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      seen.push({ tick: sim.state.tick, event });
  }
};
const lines = () =>
  seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
const items = (id = "a") =>
  [...player(id).inventory]
    .map((item, slot) => [item, player(id).inventoryCounts[slot]])
    .filter(([item]) => item !== EMPTY_SLOT);

/** Clicks Pickpocket on the drunk from (2,1), and runs until the attempt: one step, then the try on arrival. */
function pickpocketFromAfar() {
  sim.queuePickpocket("a", "drunk");
  run(1);
  expect(player()).toMatchObject({ x: 3, y: 1 });
}

describe("pickpocketing the drunk", () => {
  test("walks next to him and tries on arrival, paying coins and Thieving, with Mastery's 7%", () => {
    thief();
    // The fail roll, the coins roll (0.5 of 1 to 5 is 3), the food roll.
    rolls = [0.5, 0.5, 0.5];
    pickpocketFromAfar();
    expect(items()).toEqual([["coins", 3]]);
    expect(player().thievingXp).toBe(8);
    expect(player().masteryHundredths).toBe(56);
    expect(lines()).toContain("You pick Pell's pocket.");
  });

  test("now and then he has food on him as well", () => {
    thief();
    rolls = [0.5, 0, 0.05];
    pickpocketFromAfar();
    expect(items()).toEqual([
      ["coins", 1],
      ["cookedPerch", 1],
    ]);
  });

  test("each click is one try, and clicking again can't beat the interval", () => {
    thief({ x: 3 });
    sim.queuePickpocket("a", "drunk");
    run(1);
    expect(player().thievingXp).toBe(8);
    sim.queuePickpocket("a", "drunk");
    run(PICKPOCKET_INTERVAL_TICKS - 1);
    expect(player().thievingXp).toBe(8);
    run(1);
    expect(player().thievingXp).toBe(16);
    run(5);
    expect(player().thievingXp).toBe(16);
  });

  test("a full inventory with no coins is refused, and nothing is tried", () => {
    thief({ x: 3, held: Array(INVENTORY_SLOTS).fill(["herb", 1]) });
    sim.queuePickpocket("a", "drunk");
    run(3);
    expect(player().thievingXp).toBe(0);
  });

  test("anything but a mark standing in the region is ignored", () => {
    thief();
    for (const mark of ["odo", "nobody", 7, ["drunk"], undefined])
      sim.queuePickpocket("a", mark as string);
    run(3);
    expect(player()).toMatchObject({ x: 2, y: 1, thievingXp: 0 });
  });

  test("a player the set number of levels above him is never caught", () => {
    thief({ thievingXp: xpForLevel(21) });
    rolls = [0, 0, 0.5];
    pickpocketFromAfar();
    expect(items()).toEqual([["coins", 1]]);
  });
});

describe("a failed pickpocket", () => {
  test("deals a small hit, then stuns", () => {
    thief();
    rolls = [0.1];
    pickpocketFromAfar();
    expect(player().health).toBe(900);
    expect(player().thievingXp).toBe(0);
    expect(items()).toEqual([]);
    expect(lines()).toContain("Pell catches you, and you're stunned.");
    expect(seen.map(({ event }) => event)).toContainEqual({
      type: "stunned",
      player: "a",
      damage: 100,
      ticks: STUN_TICKS,
    });
  });

  test("never kills: it leaves a player low on health with some", () => {
    thief({ health: 40 });
    rolls = [0.1];
    pickpocketFromAfar();
    expect(player().health).toBe(1);
    expect(player().dead).toBe(false);
  });

  test("ignores clicks for the stun's ticks, then takes them again", () => {
    thief();
    rolls = [0.1];
    pickpocketFromAfar();
    for (let tick = 0; tick < STUN_TICKS; tick++) {
      sim.queueWalk("a", { x: 7, y: 2 });
      sim.queuePickpocket("a", "drunk");
      sim.queueEat("a", 0);
      run(1);
      expect(player()).toMatchObject({ x: 3, y: 1, action: "" });
    }
    sim.queueWalk("a", { x: 3, y: 2 });
    run(1);
    expect(player()).toMatchObject({ x: 3, y: 2 });
  });

  test("stops whatever was under way, and a click from before the stun doesn't carry on", () => {
    thief({ x: 3 });
    rolls = [0.1];
    sim.queuePickpocket("a", "drunk");
    run(1);
    expect(player().action).toBe("");
    run(STUN_TICKS + 2);
    expect(player()).toMatchObject({ x: 3, y: 1, thievingXp: 0 });
  });

  test("leaves the player open to an enemy's hits, and they don't fight back while stunned", () => {
    // Beside the Skeleton, which notices and swings.
    thief({ x: 5, y: 2 });
    rolls = [];
    roll = 0.1;
    // (5,2) is beside the drunk too: fail there, at once.
    sim.queuePickpocket("a", "drunk");
    run(1);
    expect(lines()).toContain("Pell catches you, and you're stunned.");
    const stunTick = sim.state.tick;
    run(STUN_TICKS - 1);
    const swings = seen.filter(
      ({ tick, event }) =>
        event.type === "enemySwing" && tick > stunTick && event.player === "a",
    );
    expect(swings.length).toBeGreaterThan(0);
    expect(player().health).toBeLessThan(900);
    expect(player()).toMatchObject({ x: 5, y: 2, action: "", target: "" });
  });
});
