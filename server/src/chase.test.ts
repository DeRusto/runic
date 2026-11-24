import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const CORRIDOR = ["TTTTTTTTTTTTTTTT", "TR.....S.......T", "TTTTTTTTTTTTTTTT"];

function fight(rows = CORRIDOR, ...rolls: number[]) {
  const s = new Simulation(
    parseRegion(rows.join("\n")),
    () => rolls.shift() ?? 0.99,
  );
  const addArcher = (id: string, x: number) =>
    s.addPlayer(id, {
      x,
      y: 1,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 1000,
      inventory: [],
      weapon: "birchBow",
      weaponCount: 1,
      ammo: "copperArrow",
      ammoCount: 10,
    });
  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) s.tick();
  };
  addArcher("a", 1);
  return { s, addArcher, run, enemy: s.state.enemies.get("0")! };
}

test("a missed shot from beyond the leash brings a Spider into melee reach", () => {
  const { s, run, enemy } = fight();
  s.queueTarget("a", "0");
  run(1);
  expect(s.events).toContainEqual(
    expect.objectContaining({ type: "playerSwing", damage: 0 }),
  );
  expect(enemy).toMatchObject({ x: 6, state: "fighting", target: "a" });
  run(8);
  expect(enemy.x).toBe(2);
  expect(s.events).toContainEqual(
    expect.objectContaining({ type: "enemySwing", player: "a" }),
  );
});

test("a Spider gives up across water and fights again when shot from its bank", () => {
  const { s, addArcher, run, enemy } = fight([
    "TTTTTTTTTT",
    "TR.~..S..T",
    "TTTTTTTTTT",
  ]);
  s.queueTarget("a", "0");
  run(1);
  expect(s.events).toContainEqual(
    expect.objectContaining({ type: "playerSwing", player: "a" }),
  );
  expect(enemy).toMatchObject({ x: 6, state: "idle", target: "" });

  addArcher("b", 8);
  s.queueTarget("b", "0");
  run(1);
  expect(enemy).toMatchObject({ x: 7, state: "fighting", target: "b" });
});

test("a landed shot starts a chase the archer can escape by walking past the leash", () => {
  const { s, run, enemy } = fight(CORRIDOR, 0, 0, 0.99);
  // Shoot east from (6,1), then walk west, past four tiles from the shot.
  const archer = s.state.players.get("a")!;
  archer.x = 6;
  enemy.x = 12;
  s.queueTarget("a", "0");
  run(1);
  expect(enemy.health).toBeLessThan(800);
  expect(enemy.target).toBe("a");
  s.queueWalk("a", { x: 2, y: 1 });
  run(8);
  expect(archer.x).toBe(2);
  expect(enemy.target).toBe("a");
  s.queueWalk("a", { x: 1, y: 1 });
  run(2);
  expect(archer.x).toBe(1);
  expect(enemy.target).toBe("");
});

test.each(["dies", "leaves"])(
  "the latest attacker gets the chase until that attacker %s",
  (end) => {
    // Two missed shots and two failed recovery rolls, then the Spider lands its swing.
    const { s, addArcher, run, enemy } = fight(
      CORRIDOR,
      0.99,
      0.99,
      0.99,
      0.99,
      0,
      0,
    );
    addArcher("b", 7);
    s.queueTarget("a", "0");
    run(1);
    expect(enemy.target).toBe("a");
    s.queueTarget("b", "0");
    run(1);
    expect(enemy.target).toBe("b");

    s.queueWalk("a", { x: 1, y: 1 });
    if (end === "dies") {
      const latest = s.state.players.get("b")!;
      latest.health = 1;
      s.queueWalk("b", { x: 7, y: 1 });
      run(3);
      expect(latest.dead).toBe(true);
    } else {
      s.removePlayer("b");
      run(1);
    }
    expect(enemy.target).toBe("");

    s.queueTarget("a", "0");
    run(8);
    expect(enemy.target).toBe("a");
  },
);

test("a Tarn Ox takes a ranged hit without chasing or swinging", () => {
  const { s, run, enemy } = fight(
    ["TTTTTTTTTT", "TR...X...T", "TTTTTTTTTT"],
    0,
    0,
    0.99,
  );
  enemy.health = 500;
  s.queueTarget("a", "0");
  run(1);
  expect(enemy.health).toBeLessThan(500);
  s.queueWalk("a", { x: 1, y: 1 });
  run(10);
  expect(enemy).toMatchObject({ x: 5, state: "idle", target: "" });
  expect(s.events).not.toContainEqual(
    expect.objectContaining({ type: "enemySwing" }),
  );
});
