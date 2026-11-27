import { parseRegion, type WorldEvent } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const BOW = {
  weapon: "birchBow",
  weaponCount: 1,
  ammo: "copperArrow",
  ammoCount: 1,
};

/** Starts a fight scenario with misses unless the test supplies a roll. */
function encounter(
  rows: string[],
  fields: Partial<PlayerSave> = {},
  random = () => 0.99,
) {
  const sim = new Simulation(parseRegion(rows.join("\n")), random);
  sim.addPlayer("a", {
    ...newSave({ x: 1, y: 1 }),
    ...fields,
  });
  const player = sim.state.players.get("a")!;
  const enemy = sim.state.enemies.get("0")!;
  return { sim, player, enemy };
}

function run(sim: Simulation, ticks: number) {
  const events: (WorldEvent & { tick: number })[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      events.push({ ...event, tick: sim.state.tick });
  }
  return events.filter((event) => event.type === "enemySwing");
}

test("a provoked Mage stands five diagonal tiles away and shoots every eight ticks", () => {
  const { sim, enemy } = encounter(
    ["R.......", "........", "........", "........", "........", ".....Z.."],
    { ...BOW, x: 0, y: 0 },
  );
  sim.queueTarget("a", "0");
  expect(run(sim, 21).map(({ tick }) => tick)).toEqual([5, 13, 21]);
  expect(enemy).toMatchObject({ x: 5, y: 5 });
});

test("a provoked Mage six tiles away steps into reach, then stands and shoots", () => {
  const { sim, enemy } = encounter(["TR.....Z.T"], BOW);
  sim.queueTarget("a", "0");
  expect(run(sim, 1)).toEqual([]);
  expect(enemy.x).toBe(6);
  expect(run(sim, 12).map(({ tick }) => tick)).toEqual([5, 13]);
  expect(enemy.x).toBe(6);
});

test.each(["H", "g", "%"])(
  "a Mage walks around cover (%s) before it can shoot",
  (cover) => {
    const { sim, enemy } = encounter([
      "T......T",
      `TR${cover}.Z..T`,
      "TTTTTTTT",
    ]);
    expect(run(sim, 1)).toEqual([]);
    expect(enemy).toMatchObject({ x: 3, y: 0, target: "a" });
    expect(run(sim, 4).map(({ tick }) => tick)).toEqual([5]);
    expect(enemy).toMatchObject({ x: 1, y: 0 });
  },
);

test("a provoked Mage can shoot across water even with no walking route", () => {
  const { sim, enemy, player } = encounter(["TR~Z.T"], BOW);
  sim.queueTarget("a", "0");
  expect(run(sim, 5).map(({ tick }) => tick)).toEqual([5]);
  expect(enemy.x).toBe(3);
  expect(player.defenseXp).toBe(6);
});

test("a Mage stops chasing when its target walks past its leash", () => {
  const { sim, enemy } = encounter(["TR.......Z.T"], { x: 6, y: 0 });
  expect(run(sim, 5).map(({ tick }) => tick)).toEqual([5]);
  sim.queueWalk("a", { x: 1, y: 0 });
  expect(run(sim, 14)).toEqual([]);
  expect(enemy).toMatchObject({ x: 9, target: "", state: "idle" });
});

test.each([
  {
    gear: { shield: "copperShield" },
    health: 1000,
    damage: 0,
    blocked: true,
    defenseXp: 6,
    blockingXp: 40,
  },
  {
    gear: { body: "copperChestplate" },
    health: 1000,
    damage: 96,
    blocked: false,
    defenseXp: 10,
    blockingXp: 0,
  },
  {
    gear: {},
    health: 40,
    damage: 40,
    blocked: false,
    defenseXp: 8,
    blockingXp: 0,
  },
])(
  "a Mage's shot deals $damage damage with $gear and $health health",
  ({ gear, health, damage, blocked, defenseXp, blockingXp }) => {
    const { sim, player, enemy } = encounter(
      ["TR..Z.T"],
      { ...gear, health },
      () => 0,
    );
    expect(run(sim, 5)).toMatchObject([{ damage, blocked }]);
    expect(player).toMatchObject({
      health: health - damage,
      defenseXp,
      blockingXp,
    });
    expect(enemy.x).toBe(4);
    if (health > damage) expect(sim.state.groundItems.size).toBe(0);
  },
);

test.each([
  [{ weapon: "copperSword", weaponCount: 1 }, 0.49, true],
  [{ weapon: "copperSword", weaponCount: 1 }, 0.51, false],
  [BOW, 0.44, true],
  [BOW, 0.46, false],
] as const)(
  "the player's %j hits a Mage on a roll of %d: %s",
  (gear, roll, lands) => {
    const { sim, enemy } = encounter(["TRZ.T"], gear, () => roll);
    sim.queueTarget("a", "0");
    run(sim, 1);
    expect(enemy.health < 3200).toBe(lands);
  },
);

test.each([
  [{ weapon: "copperSword", weaponCount: 1 }, 0.59, true],
  [{ weapon: "copperSword", weaponCount: 1 }, 0.61, false],
  [BOW, 0.69, true],
  [BOW, 0.71, false],
  [{ defenseXp: 4050 }, 0.59, false],
] as const)(
  "a Mage shooting at %j hits on a roll of %d: %s",
  (gear, roll, lands) => {
    const { sim } = encounter(["TR..Z.T"], gear, () => roll);
    const [shot] = run(sim, 5);
    expect(shot!.damage > 0).toBe(lands);
  },
);
