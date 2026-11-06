import { INVENTORY_SLOTS, parseRegion } from "@runic/shared";
import { describe, expect, test, vi } from "vitest";
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

/** Ticks, running `onTick[tick]` first, and returns each `healed` event as [tick, amount]. */
function heals(
  sim: Simulation,
  ticks: number,
  onTick: Record<number, () => void> = {},
) {
  const seen: [number, number][] = [];
  for (let i = 1; i <= ticks; i++) {
    onTick[i]?.();
    sim.tick();
    for (const event of sim.events.splice(0)) {
      if (event.type === "healed") seen.push([i, event.amount]);
    }
  }
  return seen;
}

/** Ticks `ticks` times and returns the health at the end. */
function healthAfter(sim: Simulation, ticks: number) {
  for (let i = 0; i < ticks; i++) sim.tick();
  return player(sim).health;
}

describe("what eating does", () => {
  test("a berry gives 1 on each of the next 4 healing ticks", () => {
    const sim = eater(1, "berry");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([{ type: "eaten", player: "a" }]);
    expect(healthAfter(sim, 2)).toBe(1); // Tick 3.
    expect(healthAfter(sim, 1)).toBe(2); // Tick 4.
    expect(healthAfter(sim, 3)).toBe(2); // Tick 7.
    expect(healthAfter(sim, 1)).toBe(3); // Tick 8.
    expect(healthAfter(sim, 8)).toBe(5); // Tick 16, its last.
    expect(healthAfter(sim, 3)).toBe(5); // Tick 19.
  });

  test("a herb gives 2 on each of the next 4 healing ticks", () => {
    const sim = eater(1, "herb");
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 3)).toBe(1); // Tick 3.
    expect(healthAfter(sim, 1)).toBe(3); // Tick 4.
    expect(healthAfter(sim, 4)).toBe(5); // Tick 8.
    expect(healthAfter(sim, 8)).toBe(9); // Tick 16, its last.
    expect(healthAfter(sim, 3)).toBe(9); // Tick 19.
  });

  test("the pool runs on the world's ticks, not from the meal", () => {
    const sim = eater(5, "berry");
    healthAfter(sim, 2);
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 1)).toBe(5); // Tick 3, the meal.
    expect(healthAfter(sim, 1)).toBe(6); // Tick 4.
  });

  test("more food heals for longer, not faster", () => {
    const sim = eater(1, "berry", "berry");
    sim.queueEat("a", 0);
    healthAfter(sim, 4);
    sim.queueEat("a", 1);
    expect(healthAfter(sim, 4)).toBe(3); // Tick 8: one point per 4 ticks, still.
    expect(healthAfter(sim, 8)).toBe(5); // Tick 16: the first berry's last.
    expect(healthAfter(sim, 3)).toBe(5);
    expect(healthAfter(sim, 1)).toBe(7); // Tick 20: the second's first, and 1 regenerated.
    expect(healthAfter(sim, 12)).toBe(10); // Tick 32: the second's last.
  });

  test("foods heal one at a time, in the order eaten", () => {
    const sim = eater(1, "herb", "berry");
    expect(
      heals(sim, 40, {
        1: () => sim.queueEat("a", 0),
        5: () => sim.queueEat("a", 1),
        17: () => (player(sim).health = 1), // Room for the berry, after the herb.
      }),
    ).toEqual([
      [4, 2],
      [8, 2],
      [12, 2],
      [16, 2],
      [20, 1],
      [24, 1],
      [28, 1],
      [32, 1],
    ]);
  });

  test("a meal eaten mid-meal waits its turn, then what won't fit is lost", () => {
    const sim = eater(1, "berry", "herb");
    expect(
      heals(sim, 40, {
        1: () => sim.queueEat("a", 0),
        5: () => sim.queueEat("a", 1),
      }),
    ).toEqual([
      [4, 1],
      [8, 1],
      [12, 1],
      [16, 1],
      [20, 2], // With 1 regenerated, so 8.
      [24, 2],
    ]);
    expect(player(sim).health).toBe(10);
  });

  test("regeneration runs alongside it", () => {
    const sim = eater(1, "berry");
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 19)).toBe(5);
    expect(healthAfter(sim, 1)).toBe(6); // Tick 20: 1 regenerated.
    expect(healthAfter(sim, 19)).toBe(6); // The berry gave 4, and no more.
  });

  test("a heal past max health gives what fits, and the rest is lost", () => {
    const sim = eater(9, "herb");
    expect(heals(sim, 4, { 1: () => sim.queueEat("a", 0) })).toEqual([[4, 1]]);
    expect(player(sim).health).toBe(10);
    player(sim).health = 5;
    expect(heals(sim, 15)).toEqual([]);
    expect(player(sim).health).toBe(5);
  });

  test("regeneration reaching full first leaves the tick nothing to give", () => {
    const sim = eater(9, "berry");
    expect(heals(sim, 20, { 17: () => sim.queueEat("a", 0) })).toEqual([]);
    expect(player(sim).health).toBe(10);
  });

  test("regeneration alone sends no healed event", () => {
    const sim = eater(1);
    expect(heals(sim, 20)).toEqual([]);
    expect(player(sim).health).toBe(2);
  });

  test("eating at full health heals nothing and uses the food", () => {
    const sim = eater(10, "berry");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([{ type: "eaten", player: "a" }]);
    player(sim).health = 5;
    expect(healthAfter(sim, 15)).toBe(5);
  });

  test("death empties the pool", () => {
    const sim = eater(1, "herb");
    vi.spyOn(sim, "random").mockReturnValue(0); // Every swing lands, for 1.
    sim.queueTarget("a", "0");
    healthAfter(sim, 4);
    sim.queueEat("a", 0); // On the tick of the Spider's first swing, so it can't heal first.
    sim.tick();
    expect(player(sim).dead).toBe(true);
    while (player(sim).dead) sim.tick();
    player(sim).health = 5;
    expect(healthAfter(sim, 8)).toBe(5);
  });

  test("it isn't saved, so logging out loses it", () => {
    const sim = eater(1, "herb");
    sim.queueEat("a", 0);
    sim.tick();
    const saved = sim.saveOf("a")!;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    expect(healthAfter(sim, 15)).toBe(1);
  });

  test("the slot clicked is the one eaten", () => {
    const sim = eater(5, "berry", "herb");
    sim.queueEat("a", 1);
    sim.tick();
    expect([...player(sim).inventory].slice(0, 2)).toEqual(["berry", ""]);
  });
});

describe("eating from a stack", () => {
  const stacked = (...counts: number[]) => {
    const sim = eater(5, ...counts.map(() => "berry"));
    const saved = sim.saveOf("a")!;
    counts.forEach((count, slot) => (saved.inventoryCounts![slot] = count));
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    return sim;
  };

  test("one click eats one food and leaves the rest", () => {
    const sim = stacked(3);
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("berry");
    expect(player(sim).inventoryCounts[0]).toBe(2);
  });

  test("eating the last one frees the slot", () => {
    const sim = stacked(1);
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(player(sim).inventoryCounts[0]).toBe(0);
  });

  test("the slot clicked is the one eaten from", () => {
    const sim = stacked(4, 4);
    sim.queueEat("a", 1);
    sim.tick();
    expect([...player(sim).inventoryCounts].slice(0, 2)).toEqual([4, 3]);
  });
});

describe("discarding", () => {
  const twenty = () => {
    const sim = eater(5, "berry", "herb");
    const saved = sim.saveOf("a")!;
    saved.inventoryCounts![0] = 20;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    return sim;
  };

  test("destroys the whole slot, including a stack of 20", () => {
    const sim = twenty();
    sim.queueDiscard("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(player(sim).inventoryCounts[0]).toBe(0);
    expect(player(sim).inventory[1]).toBe("herb");
    expect(player(sim).inventoryCounts[1]).toBe(1);
  });

  test("the freed slot takes the next item from scratch", () => {
    const sim = new Simulation(
      parseRegion(["TTTTT", "TRb.T", "TTTTT"].join("\n")),
      () => 0,
    );
    sim.addPlayer("a");
    const saved = sim.saveOf("a")!;
    saved.inventory[0] = "berry";
    saved.inventoryCounts![0] = 20;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    sim.queueDiscard("a", 0);
    sim.queueGather("a", "foraging", "2,1");
    sim.tick();
    expect(player(sim).inventory[0]).toBe("berry");
    expect(player(sim).inventoryCounts[0]).toBe(1);
  });

  test("mid-fight it interrupts nothing: not the target, not the swing timer", () => {
    const sim = twenty();
    sim.queueTarget("a", "0");
    expect(
      ticksOf(sim, "playerSwing", 17, { 3: () => sim.queueDiscard("a", 0) }),
    ).toEqual([1, 9, 17]);
    expect(player(sim).target).toBe("0");
    expect(player(sim).inventory[0]).toBe("");
  });

  test("doesn't stop a walk", () => {
    const sim = twenty();
    sim.queueWalk("a", { x: 5, y: 2 });
    sim.queueDiscard("a", 0);
    for (let i = 0; i < 10; i++) sim.tick();
    expect({ x: player(sim).x, y: player(sim).y }).toEqual({ x: 5, y: 2 });
    expect(player(sim).inventory[0]).toBe("");
  });

  test.each([
    [-1],
    [1.5],
    [30],
    ["0"],
    ["constructor"],
    [null],
    [undefined],
    [{}],
  ])("a slot of %j is ignored", (slot) => {
    const sim = twenty();
    sim.queueDiscard("a", slot as number);
    sim.tick();
    expect([...player(sim).inventory].slice(0, 2)).toEqual(["berry", "herb"]);
    expect(player(sim).inventoryCounts[0]).toBe(20);
    expect(player(sim).inventory).toHaveLength(30);
  });

  test("an empty slot is ignored", () => {
    const sim = twenty();
    sim.queueDiscard("a", 5);
    sim.tick();
    expect(player(sim).inventory[5]).toBe("");
    expect(player(sim).inventoryCounts[5]).toBe(0);
  });

  test("a player who isn't here, or who left with a discard queued", () => {
    const sim = twenty();
    sim.queueDiscard("nobody", 0);
    sim.queueDiscard("a", 0);
    sim.removePlayer("a");
    expect(() => sim.tick()).not.toThrow();
  });

  test("a discard queued before a drop is forgotten", () => {
    const sim = twenty();
    sim.queueDiscard("a", 0);
    sim.dropPlayer("a");
    sim.tick();
    expect(player(sim).inventory[0]).toBe("berry");
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

  test("the combat lock pauses regeneration but not the pool, and the target stays", () => {
    const sim = eater(1, "herb");
    sim.queueTarget("a", "0");
    sim.tick();
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 19)).toBe(9); // Tick 20: all eight, and nothing regenerated.
    expect(sim.lockRunning("a")).toBe(true);
    expect(player(sim).target).toBe("0");
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
