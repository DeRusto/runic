import {
  DELICIOUS_BUFF_INTERVAL_TICKS,
  DELICIOUS_BUFF_TICKS,
  INVENTORY_SLOTS,
  parseRegion,
} from "@runic/shared";
import { describe, expect, test, vi } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), with the Spider's home at (2,1), next to it.
const TILES = parseRegion(
  ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n"),
);
const MISS = 0.99;

/** A player at (1,1) with 1,000 max health and these items from slot 0. */
function eater(health: number, ...food: string[]) {
  const sim = new Simulation(TILES, () => MISS);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  inventory.splice(0, food.length, ...food);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
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
  test("a berry gives 25 on each of the next 4 healing ticks", () => {
    const sim = eater(100, "berry");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([{ type: "eaten", player: "a" }]);
    expect(healthAfter(sim, 2)).toBe(100); // Tick 3.
    expect(healthAfter(sim, 1)).toBe(125); // Tick 4.
    expect(healthAfter(sim, 3)).toBe(125); // Tick 7.
    expect(healthAfter(sim, 1)).toBe(150); // Tick 8.
    expect(healthAfter(sim, 8)).toBe(200); // Tick 16, its last.
    expect(healthAfter(sim, 3)).toBe(200); // Tick 19.
  });

  test("a cooked perch gives 200 on each of the next 4 healing ticks", () => {
    const sim = eater(100, "cookedPerch");
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 3)).toBe(100); // Tick 3.
    expect(healthAfter(sim, 1)).toBe(300); // Tick 4.
    expect(healthAfter(sim, 4)).toBe(500); // Tick 8.
    expect(healthAfter(sim, 8)).toBe(900); // Tick 16, its last.
    expect(healthAfter(sim, 3)).toBe(900); // Tick 19.
  });

  test("a herb is no longer food, so eating it is refused and keeps it (#221)", () => {
    const sim = eater(100, "herb");
    sim.queueEat("a", 0);
    sim.tick();
    expect(sim.events).toEqual([]);
    expect(player(sim).inventory[0]).toBe("herb");
    expect(player(sim).inventoryCounts[0]).toBe(1);
    expect(player(sim).health).toBe(100);
  });

  test("a dish heals more per tick than its fish alone (#221)", () => {
    const fish = eater(5, "cookedTrout");
    fish.state.players.get("a")!.maxHealth = 2000;
    fish.queueEat("a", 0);
    expect(heals(fish, 16)).toEqual([
      [4, 300],
      [8, 300],
      [12, 300],
      [16, 300],
    ]);
    const dish = eater(5, "berryTrout");
    dish.state.players.get("a")!.maxHealth = 2000;
    dish.queueEat("a", 0);
    expect(heals(dish, 16)).toEqual([
      [4, 350],
      [8, 350],
      [12, 350],
      [16, 350],
    ]);
  });

  test("the pool runs on the world's ticks, not from the meal", () => {
    const sim = eater(500, "berry");
    healthAfter(sim, 2);
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 1)).toBe(500); // Tick 3, the meal.
    expect(healthAfter(sim, 1)).toBe(525); // Tick 4.
  });

  test("more food heals for longer, not faster", () => {
    const sim = eater(100, "berry", "berry");
    sim.queueEat("a", 0);
    healthAfter(sim, 4);
    sim.queueEat("a", 1);
    expect(healthAfter(sim, 4)).toBe(150); // Tick 8: 25 per 4 ticks, still.
    expect(healthAfter(sim, 8)).toBe(200); // Tick 16: the first berry's last.
    expect(healthAfter(sim, 3)).toBe(200);
    expect(healthAfter(sim, 1)).toBe(275); // Tick 20: the second's first, and 50 regenerated.
    expect(healthAfter(sim, 12)).toBe(350); // Tick 32: the second's last.
  });

  test("foods heal one at a time, in the order eaten", () => {
    const sim = eater(100, "cookedPerch", "berry");
    expect(
      heals(sim, 40, {
        1: () => sim.queueEat("a", 0),
        5: () => sim.queueEat("a", 1),
        17: () => (player(sim).health = 100), // Room for the berry, after the perch.
      }),
    ).toEqual([
      [4, 200],
      [8, 200],
      [12, 200],
      [16, 200],
      [20, 25],
      [24, 25],
      [28, 25],
      [32, 25],
    ]);
  });

  test("a meal eaten mid-meal waits its turn, then what won't fit is lost", () => {
    const sim = eater(100, "berry", "cookedPerch");
    expect(
      heals(sim, 40, {
        1: () => sim.queueEat("a", 0),
        5: () => sim.queueEat("a", 1),
      }),
    ).toEqual([
      [4, 25],
      [8, 25],
      [12, 25],
      [16, 25],
      [20, 200], // With 50 regenerated, so 450.
      [24, 200],
      [28, 200],
      [32, 150], // What fits of the perch's 200.
    ]);
    expect(player(sim).health).toBe(1000);
  });

  test("regeneration runs alongside it", () => {
    const sim = eater(100, "berry");
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 19)).toBe(200);
    expect(healthAfter(sim, 1)).toBe(250); // Tick 20: 50 regenerated.
    expect(healthAfter(sim, 19)).toBe(250); // The berry gave 100, and no more.
  });

  test("a heal past max health gives what fits, and the rest is lost", () => {
    const sim = eater(900, "cookedPerch");
    expect(heals(sim, 4, { 1: () => sim.queueEat("a", 0) })).toEqual([
      [4, 100],
    ]);
    expect(player(sim).health).toBe(1000);
    player(sim).health = 500;
    expect(heals(sim, 15)).toEqual([]);
    expect(player(sim).health).toBe(500);
  });

  test("regeneration reaching full first leaves the tick nothing to give", () => {
    const sim = eater(950, "berry");
    expect(heals(sim, 20, { 17: () => sim.queueEat("a", 0) })).toEqual([]);
    expect(player(sim).health).toBe(1000);
  });

  test("regeneration alone sends no healed event", () => {
    const sim = eater(100);
    expect(heals(sim, 20)).toEqual([]);
    expect(player(sim).health).toBe(150);
  });

  test("eating at full health heals nothing and uses the food", () => {
    const sim = eater(1000, "berry");
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).inventory[0]).toBe("");
    expect(sim.events).toEqual([{ type: "eaten", player: "a" }]);
    player(sim).health = 500;
    expect(healthAfter(sim, 15)).toBe(500);
  });

  test("death empties the pool", () => {
    const sim = eater(1, "cookedPerch");
    vi.spyOn(sim, "random").mockReturnValue(0); // Every swing lands, for 100.
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
    const sim = eater(1, "cookedPerch");
    sim.queueEat("a", 0);
    sim.tick();
    const saved = sim.saveOf("a")!;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    expect(healthAfter(sim, 15)).toBe(1);
  });

  test("the slot clicked is the one eaten", () => {
    const sim = eater(5, "berry", "cookedPerch");
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

  test("a Delicious fish stacks beside its common form, and eats from its own stack (#221)", () => {
    const sim = eater(5, "cookedPerch", "cookedPerch:delicious");
    const saved = sim.saveOf("a")!;
    saved.inventoryCounts![0] = 3;
    saved.inventoryCounts![1] = 2;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    sim.queueEat("a", 1);
    sim.tick();
    expect(player(sim).inventory[1]).toBe("cookedPerch:delicious");
    expect(player(sim).inventoryCounts[1]).toBe(1);
  });
});

describe("a Delicious fish's buff (#221)", () => {
  test("eating one starts it with 200 ticks of events", () => {
    const sim = eater(100, "cookedPerch:delicious");
    sim.queueEat("a", 0);
    sim.tick();
    expect(sim.events).toEqual([
      { type: "delicious", player: "a", ticks: DELICIOUS_BUFF_TICKS },
      { type: "eaten", player: "a" },
    ]);
  });

  test("its healing is capped by missing health", () => {
    const sim = eater(100, "cookedPerch:delicious");
    // The fish's pool first: 200 on ticks 4–16, then the buff's 40, with regeneration along the way.
    expect(heals(sim, 201, { 1: () => sim.queueEat("a", 0) })).toEqual([
      [4, 200],
      [8, 200],
      [12, 200],
      [16, 200],
      [21, 40], // Regeneration reaching full health caps the buff's next heals to nothing.
    ]);
    expect(player(sim).health).toBe(1000);
  });

  test("with room for all of it, the buff pays 20% of the fish's per-tick heal every 20 ticks, ten times over", () => {
    const sim = eater(100, "cookedPerch:delicious");
    // Big enough that the pool, the buff and ten regeneration ticks never reach full health.
    player(sim).maxHealth = 2800;
    expect(heals(sim, 201, { 1: () => sim.queueEat("a", 0) })).toEqual([
      [4, 200],
      [8, 200],
      [12, 200],
      [16, 200],
      ...Array.from(
        { length: DELICIOUS_BUFF_TICKS / DELICIOUS_BUFF_INTERVAL_TICKS },
        (_, i) =>
          [21 + i * DELICIOUS_BUFF_INTERVAL_TICKS, 40] as [number, number],
      ),
    ]);
    // The fish's pool, its buff, and ten silent regeneration ticks of 140.
    expect(player(sim).health).toBe(100 + 800 + 400 + 1400);
  });

  test("a common fish's meal and a Delicious fish's buff can run at once", () => {
    const sim = eater(100, "cookedPerch", "cookedTrout:delicious");
    expect(
      ticksOf(sim, "delicious", 6, {
        1: () => sim.queueEat("a", 0),
        5: () => sim.queueEat("a", 1),
      }),
    ).toEqual([5]);
    const both = eater(100, "cookedPerch", "cookedTrout:delicious");
    // The perch's pool, then the trout's first entry lands on tick 20 with regeneration's 50.
    expect(
      heals(both, 24, {
        1: () => both.queueEat("a", 0),
        5: () => both.queueEat("a", 1),
      }),
    ).toEqual([
      [4, 200],
      [8, 200],
      [12, 200],
      [16, 200],
      [20, 50], // The last 50 of missing health, of the trout's 300.
    ]);
    expect(player(both).health).toBe(1000);
  });

  test("it heals through a fight, where regeneration pauses", () => {
    const sim = eater(5, "cookedPerch:delicious");
    sim.queueTarget("a", "0");
    sim.tick();
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 19)).toBe(805); // Ticks 4–16: the fish's pool, with no regeneration yet.
    expect(sim.lockRunning("a")).toBe(true);
    expect(healthAfter(sim, 2)).toBe(845); // Tick 21: the buff's first, though the lock holds.
  });

  test("healing stops at max health, and the buff still runs out", () => {
    const sim = eater(1000, "cookedTrout:delicious");
    expect(heals(sim, 205, { 1: () => sim.queueEat("a", 0) })).toEqual([]);
    expect(player(sim).health).toBe(1000);
  });

  test("another Delicious eat refreshes it, and never stacks it", () => {
    const sim = eater(5, "cookedPerch:delicious", "cookedTrout:delicious");
    // 100 ticks in, a trout refreshes the buff: its 60 takes over, with no second stream of 40s.
    expect(
      ticksOf(sim, "delicious", 101, {
        1: () => sim.queueEat("a", 0),
        101: () => sim.queueEat("a", 1),
      }),
    ).toEqual([1, 101]);
    const fresh = eater(5, "cookedPerch:delicious", "cookedTrout:delicious");
    const seen = heals(fresh, 305, {
      1: () => fresh.queueEat("a", 0),
      101: () => fresh.queueEat("a", 1),
    });
    expect(seen).toEqual([
      [4, 200],
      [8, 200],
      [12, 200],
      [16, 200],
      [21, 40],
      [41, 40],
    ]);
    // No perch-buff heal on the refresh tick itself, and no second stream of 40s after it;
    // at full health the trout's pool is skipped and the refreshed buff heals nothing.
    expect(player(fresh).health).toBe(1000);
  });

  test("death clears it, and nothing heals after respawning", () => {
    const sim = eater(1, "cookedPerch:delicious");
    vi.spyOn(sim, "random").mockReturnValue(0); // Every swing lands, for 100.
    sim.queueTarget("a", "0");
    healthAfter(sim, 4);
    sim.queueEat("a", 0);
    sim.tick();
    expect(player(sim).dead).toBe(true);
    while (player(sim).dead) sim.tick();
    expect(player(sim).health).toBe(player(sim).maxHealth);
    expect(heals(sim, 200)).toEqual([]);
  });
});

describe("dropping", () => {
  const twenty = () => {
    const sim = eater(5, "berry", "herb");
    const saved = sim.saveOf("a")!;
    saved.inventoryCounts![0] = 20;
    sim.removePlayer("a");
    sim.addPlayer("a", saved);
    return sim;
  };

  test("empties the whole slot, including a stack of 20", () => {
    const sim = twenty();
    sim.queueDrop("a", 0, 20);
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
    sim.queueDrop("a", 0, 20);
    sim.queueGather("a", "herblaw", "2,1");
    sim.tick();
    expect(player(sim).inventory[0]).toBe("berry");
    expect(player(sim).inventoryCounts[0]).toBe(1);
  });

  test("mid-fight it interrupts nothing: not the target, not the swing timer", () => {
    const sim = twenty();
    sim.queueTarget("a", "0");
    expect(
      ticksOf(sim, "playerSwing", 17, { 3: () => sim.queueDrop("a", 0, 20) }),
    ).toEqual([1, 9, 17]);
    expect(player(sim).target).toBe("0");
    expect(player(sim).inventory[0]).toBe("");
  });

  test("doesn't stop a walk", () => {
    const sim = twenty();
    sim.queueWalk("a", { x: 5, y: 2 });
    sim.queueDrop("a", 0, 20);
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
    sim.queueDrop("a", slot as number, 20);
    sim.tick();
    expect([...player(sim).inventory].slice(0, 2)).toEqual(["berry", "herb"]);
    expect(player(sim).inventoryCounts[0]).toBe(20);
    expect(player(sim).inventory).toHaveLength(30);
  });

  test("an empty slot is ignored", () => {
    const sim = twenty();
    sim.queueDrop("a", 5, 20);
    sim.tick();
    expect(player(sim).inventory[5]).toBe("");
    expect(player(sim).inventoryCounts[5]).toBe(0);
  });

  test("a player who isn't here, or who left with a drop queued", () => {
    const sim = twenty();
    sim.queueDrop("nobody", 0, 20);
    sim.queueDrop("a", 0, 20);
    sim.removePlayer("a");
    expect(() => sim.tick()).not.toThrow();
  });

  test("a drop queued before the connection drops is forgotten", () => {
    const sim = twenty();
    sim.queueDrop("a", 0, 20);
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
    const sim = eater(100, "cookedPerch");
    sim.queueTarget("a", "0");
    sim.tick();
    sim.queueEat("a", 0);
    expect(healthAfter(sim, 19)).toBe(900); // Tick 20: all eight, and nothing regenerated.
    expect(sim.lockRunning("a")).toBe(true);
    expect(player(sim).target).toBe("0");
  });
});

test("eating doesn't stop a walk", () => {
  const sim = eater(500, "berry");
  sim.queueWalk("a", { x: 5, y: 2 });
  sim.queueEat("a", 0);
  for (let i = 0; i < 8; i++) sim.tick();
  expect(player(sim).health).toBe(550);
  expect({ x: player(sim).x, y: player(sim).y }).toEqual({ x: 5, y: 2 });
});
