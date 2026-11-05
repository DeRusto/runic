import { INVENTORY_SLOTS, parseRegion } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), with the Spider's home at (2,1), next to it.
const TILES = parseRegion(
  ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n"),
);
const MISS = 0.99;

/** A player at (1,1) with 10 max health and these items from slot 0. */
function eater(health: number, ...food: string[]) {
  const sim = new Simulation(TILES, () => MISS);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  inventory.splice(0, food.length, ...food);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health,
    inventory,
  });
  return sim;
}

const player = (sim: Simulation) => sim.state.players.get("a")!;

/** Ticks, running `onTick[tick]` first, and returns the tick of each event of this type. */
function ticksOf(
  sim: Simulation,
  type: string,
  ticks: number,
  onTick: Record<number, () => void> = {},
) {
  const seen: number[] = [];
  for (let i = 1; i <= ticks; i++) {
    onTick[i]?.();
    sim.tick();
    for (const event of sim.events.splice(0)) {
      if (event.type === type) seen.push(i);
    }
  }
  return seen;
}

describe("what eating does", () => {
  test.each([
    ["berry", 7],
    ["herb", 10],
  ])("%s heals its amount and frees the slot", (food, health) => {
    const sim = eater(5, food);
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).health).toBe(health);
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([
      { type: "eaten", player: "a", healed: health - 5 },
    ]);
  });

  test("healing stops at max health", () => {
    const sim = eater(9, "herb");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).health).toBe(10);
    expect(sim.events).toEqual([{ type: "eaten", player: "a", healed: 1 }]);
  });

  test("eating at full health heals nothing and frees the slot", () => {
    const sim = eater(10, "berry");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).health).toBe(10);
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([{ type: "eaten", player: "a", healed: 0 }]);
  });

  test("the slot clicked is the one eaten", () => {
    const sim = eater(5, "berry", "herb");
    sim.queueEat("a", 1);
    sim.tick();
    expect([...player(sim).inventory].slice(0, 2)).toEqual(["berry", ""]);
  });
});

describe("what the server ignores", () => {
  test.each([[-1], [1.5], [30], ["0"], ["constructor"], [null], [undefined]])(
    "a slot of %j",
    (slot) => {
      const sim = eater(5, "berry");
      sim.queueEat("a", slot as number);
      sim.tick();
      expect(sim.events).toEqual([]);
      expect(player(sim).health).toBe(5);
    },
  );

  test("an empty slot, which doesn't use up the next eat either", () => {
    const sim = eater(5, "berry");
    expect(
      ticksOf(sim, "eaten", 2, {
        1: () => sim.queueEat("a", 5),
        2: () => sim.queueEat("a", 0),
      }),
    ).toEqual([2]);
  });

  test("something in the slot that isn't food", () => {
    const sim = eater(5, "rock");
    sim.queueEat("a", 0);
    sim.tick();
    expect(sim.events).toEqual([]);
    expect(player(sim).inventory[0]).toBe("rock");
  });

  test("a player who isn't here, or who left with an eat queued", () => {
    const sim = eater(5, "berry");
    sim.queueEat("nobody", 0);
    sim.queueEat("a", 0);
    sim.removePlayer("a");
    expect(() => sim.tick()).not.toThrow();
  });
});

describe("eat timing", () => {
  test("at most once every 4 ticks, and a refused click keeps its food", () => {
    const sim = eater(1, "berry", "berry", "berry");
    const click = (slot: number) => () => sim.queueEat("a", slot);
    expect(
      ticksOf(sim, "eaten", 6, {
        1: click(0),
        2: click(1),
        3: click(1),
        4: click(1),
        5: click(1),
        6: click(2),
      }),
    ).toEqual([1, 5]);
    expect([...player(sim).inventory].slice(0, 3)).toEqual(["", "", "berry"]);
  });

  test("several clicks in one tick eat once", () => {
    const sim = eater(1, "berry", "berry");
    sim.queueEat("a", 0);
    sim.queueEat("a", 1);
    sim.tick();
    expect(player(sim).health).toBe(3);
    expect(player(sim).inventory[1]).toBe("");
    expect(player(sim).inventory[0]).toBe("berry");
  });
});

describe("eating in a fight", () => {
  test("adds 4 ticks to the next swing", () => {
    const sim = eater(5, "berry");
    sim.queueTarget("a", "0");
    expect(
      ticksOf(sim, "playerSwing", 21, { 3: () => sim.queueEat("a", 0) }),
    ).toEqual([1, 13, 21]);
  });

  test("each eat adds 4 more", () => {
    const sim = eater(5, "berry", "berry");
    sim.queueTarget("a", "0");
    expect(
      ticksOf(sim, "playerSwing", 17, {
        3: () => sim.queueEat("a", 0),
        7: () => sim.queueEat("a", 1),
      }),
    ).toEqual([1, 17]);
  });

  test("on the tick a swing is due, it waits 4", () => {
    const sim = eater(5, "berry");
    sim.queueTarget("a", "0");
    expect(
      ticksOf(sim, "playerSwing", 13, { 9: () => sim.queueEat("a", 0) }),
    ).toEqual([1, 13]);
  });

  test("with no swing waiting, the next one is still 4 off", () => {
    const sim = eater(5, "berry");
    expect(
      ticksOf(sim, "playerSwing", 6, {
        1: () => sim.queueEat("a", 0),
        2: () => sim.queueTarget("a", "0"),
      }),
    ).toEqual([5]);
  });

  test("a health point eaten shows in the fight and the target stays", () => {
    const sim = eater(5, "berry");
    sim.queueTarget("a", "0");
    sim.tick();
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).target).toBe("0");
    expect(player(sim).health).toBe(7);
  });
});

test("eating doesn't stop a walk", () => {
  const sim = eater(5, "berry");
  sim.queueWalk("a", { x: 5, y: 2 });
  sim.queueEat("a", 0);
  for (let i = 0; i < 8; i++) sim.tick();
  expect(player(sim).health).toBe(7);
  expect({ x: player(sim).x, y: player(sim).y }).toEqual({ x: 5, y: 2 });
});
