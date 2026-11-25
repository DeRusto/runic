import { ENEMIES, parseRegion, type WorldEvent } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const BOW = {
  weapon: "birchBow",
  weaponCount: 1,
  ammo: "copperArrow",
  ammoCount: 30,
};

function encounter(rows: string[], gear: Partial<PlayerSave> = BOW) {
  let roll = 0.99;
  const sim = new Simulation(parseRegion(rows.join("\n")), () => roll);
  sim.addPlayer("a", { ...newSave({ x: 1, y: 0 }), ...gear });
  return {
    sim,
    enemy: sim.state.enemies.get("0")!,
    player: sim.state.players.get("a")!,
    setRoll: (value: number) => {
      roll = value;
    },
  };
}

function advance(sim: Simulation, ticks: number) {
  const events: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    events.push(...sim.events.splice(0));
  }
  return events;
}

test("a Thornling ignores passers-by and shoots from exactly four tiles after a hit", () => {
  const { sim, enemy, setRoll } = encounter([".R...I."]);
  sim.queueWalk("a", { x: 4, y: 0 });
  expect(advance(sim, 10)).not.toContainEqual(
    expect.objectContaining({ type: "enemySwing" }),
  );
  expect(enemy.state).toBe("idle");
  sim.queueWalk("a", { x: 1, y: 0 });
  advance(sim, 10);
  setRoll(0.2);
  sim.queueTarget("a", "0");
  expect(advance(sim, 5)).toContainEqual(
    expect.objectContaining({ type: "enemySwing", enemy: "0" }),
  );
  expect(enemy).toMatchObject({ x: 5, target: "a" });
  expect(enemy.health).toBeLessThan(1000);
});

test("a Thornling has its own stats and no drops", () => {
  expect(ENEMIES.thornling).toEqual({
    health: 1000,
    hitChance: 0.4,
    accuracy: 0,
    maxDamage: 250,
    style: "ranged",
    reachTiles: 4,
    leashTiles: 4,
    loot: [],
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
  });
});

test("a Thornling steps into reach before shooting at a bow user", () => {
  const { sim, enemy } = encounter([".R....I."]);
  sim.queueTarget("a", "0");
  expect(advance(sim, 1)).not.toContainEqual(
    expect.objectContaining({ type: "enemySwing" }),
  );
  expect(enemy.x).toBe(5);
  expect(advance(sim, 4)).toContainEqual(
    expect.objectContaining({ type: "enemySwing" }),
  );
  expect(enemy.x).toBe(5);
});

test("a Thornling steps around cover before shooting after being struck", () => {
  const { sim, enemy } = encounter([".RI....", "...T...", "......."]);
  sim.queueTarget("a", "0");
  advance(sim, 1);
  sim.queueWalk("a", { x: 4, y: 2 });
  const events = advance(sim, 8);
  expect(events).toContainEqual(
    expect.objectContaining({ type: "enemySwing" }),
  );
  expect(enemy.x === 2 && enemy.y === 0).toBe(false);
});

test.each([
  [0.29, true, true],
  [0.31, true, false],
  [0.49, true, false],
  [0.51, false, false],
])(
  "with a sword and roll %s the player lands: %s and the Thornling lands: %s",
  (roll, playerLands, thornlingLands) => {
    const { sim, enemy, setRoll } = encounter([".RI."], {
      weapon: "copperSword",
      weaponCount: 1,
    });
    setRoll(roll);
    sim.queueTarget("a", "0");
    const events = advance(sim, 5);
    expect(enemy.health < 1000).toBe(playerLands);
    expect(
      events.some((event) => event.type === "enemySwing" && event.damage > 0),
    ).toBe(thornlingLands);
  },
);

test("killing a Thornling pays damage experience, drops nothing, and returns it home", () => {
  const { sim, enemy, player, setRoll } = encounter([".R....I."], {
    ...BOW,
    defenseXp: 40500,
  });
  const startingXp = player.hitpointsXp;
  setRoll(0.2);
  sim.queueTarget("a", "0");
  const events: WorldEvent[] = [];
  for (let i = 0; i < 100 && enemy.state !== "dead"; i++)
    events.push(...advance(sim, 1));
  expect(enemy).toMatchObject({ x: 5, state: "dead", health: 0 });
  const damage = events.flatMap((event) =>
    event.type === "playerSwing" ? [event.damage] : [],
  );
  expect(damage.reduce((total, hit) => total + hit, 0)).toBe(1000);
  expect(player.hitpointsXp - startingXp).toBe(
    damage.reduce((total, hit) => total + Math.round(hit * 0.06), 0),
  );
  expect(sim.state.groundItems.size).toBe(0);
  setRoll(0.99);
  advance(sim, 149);
  expect(enemy.state).toBe("dead");
  expect(advance(sim, 1)).toContainEqual({ type: "enemyReturned", enemy: "0" });
  expect(enemy).toMatchObject({ x: 6, y: 0, state: "idle", health: 1000 });
});
