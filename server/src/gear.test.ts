import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  MAX_XP,
  parseRegion,
  type GearSlot,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), with the Spider's home at (2,1), next to it.
const TILES = parseRegion(
  ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n"),
);
const LEVEL_10_XP = 4050;
const LEVEL_20_XP = 18050;
const MISS = 0.99;

type Start = Partial<PlayerSave> & {
  held?: string[];
  tiles?: ReturnType<typeof parseRegion>;
};

let sim: Simulation;
/** Rolls come in order, and then everything misses (and nothing wanders). */
let rolls: number[];
const me = () => sim.state.players.get("a")!;
const start = ({ held = [], tiles = TILES, ...fields }: Start = {}) => {
  rolls = [];
  sim = new Simulation(tiles, () => rolls.shift() ?? MISS);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: LEVEL_10_XP,
    health: 1000,
    inventory: [
      ...held,
      ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
    ],
    ...fields,
  });
};
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) sim.tick();
};
const told = () =>
  sim.events.flatMap((event) => (event.type === "told" ? [event.line] : []));
const swings = () =>
  sim.events.flatMap((event) =>
    event.type === "playerSwing" ? [event.damage] : [],
  );

beforeEach(() => start());

describe("equipping", () => {
  test("moves gear from the inventory to its gear slot, freeing the slot", () => {
    start({ held: ["berry", "copperSword"], inventoryCounts: [3, 1] });
    sim.equip("a", 1);
    expect(me().weapon).toBe("copperSword");
    expect(me().inventory[1]).toBe(EMPTY_SLOT);
    expect(me().inventoryCounts[1]).toBe(0);
  });

  test("with one worn, the two trade places, even in a full inventory", () => {
    start({
      held: Array<string>(INVENTORY_SLOTS).fill("ironSword"),
      combatXp: LEVEL_10_XP,
      weapon: "copperSword",
    });
    sim.equip("a", 4);
    expect(me().weapon).toBe("ironSword");
    expect(me().inventory[4]).toBe("copperSword");
    expect(me().inventoryCounts[4]).toBe(1);
    expect(told()).toEqual([]);
  });

  test("gear above the player's level is refused with a line", () => {
    start({ held: ["ironSword"], combatXp: LEVEL_10_XP - 1 });
    sim.equip("a", 0);
    expect(me().weapon).toBe("");
    expect(me().inventory[0]).toBe("ironSword");
    expect(sim.events).toEqual([
      { type: "told", player: "a", line: "You need Combat 10 to equip this." },
    ]);
  });

  test("gear at the player's level is allowed", () => {
    start({ held: ["emberiteSword"], combatXp: LEVEL_20_XP });
    sim.equip("a", 0);
    expect(me().weapon).toBe("emberiteSword");
  });

  test("a drop waiting on that slot doesn't drop the sword traded into it", () => {
    start({
      held: ["ironSword"],
      combatXp: LEVEL_10_XP,
      weapon: "copperSword",
    });
    sim.queueDrop("a", 0, 20);
    sim.equip("a", 0);
    sim.tick();
    expect(me().inventory[0]).toBe("copperSword");
  });
});

describe("taking off", () => {
  test("moves gear to the first empty slot", () => {
    start({
      held: ["berry", "", "herb"],
      inventoryCounts: [1, 0, 1],
      weapon: "copperSword",
    });
    sim.takeOff("a", "weapon");
    expect(me().weapon).toBe("");
    expect(me().inventory[1]).toBe("copperSword");
    expect(me().inventoryCounts[1]).toBe(1);
  });

  test("with no empty slot is refused with a line", () => {
    start({
      held: Array<string>(INVENTORY_SLOTS).fill("berry"),
      weapon: "copperSword",
    });
    sim.takeOff("a", "weapon");
    expect(me().weapon).toBe("copperSword");
    expect(told()).toEqual(["You have no empty slot to take that off into."]);
  });

  test("an empty gear slot does nothing, even with a full inventory", () => {
    start({ held: Array<string>(INVENTORY_SLOTS).fill("berry") });
    sim.takeOff("a", "weapon");
    expect(sim.events).toEqual([]);
  });
});

describe("mid-fight", () => {
  test("changing gear keeps the action and the swing timer", () => {
    start({ held: ["copperSword"] });
    sim.queueTarget("a", "0");
    sim.tick(); // The first swing, so the next is due on tick 9.
    sim.events.length = 0;
    ticks(3);
    sim.equip("a", 0);
    sim.takeOff("a", "weapon");
    sim.equip("a", 0);
    expect(me().action).toBe("fighting");
    ticks(4);
    expect(swings()).toEqual([]);
    sim.tick();
    expect(swings()).toHaveLength(1);
    expect(me().action).toBe("fighting");
  });

  test("it doesn't stop a walk either", () => {
    start({ held: ["copperSword"] });
    sim.queueWalk("a", { x: 5, y: 2 });
    sim.tick();
    sim.equip("a", 0);
    sim.tick();
    expect(me().action).toBe("walking");
  });
});

describe("what lasts", () => {
  test("gear is saved and loaded", () => {
    start({ weapon: "copperSword", shield: "copperShield" });
    expect(me().weapon).toBe("copperSword");
    expect(me().shield).toBe("copperShield");
    expect(sim.saveOf("a")).toMatchObject({
      weapon: "copperSword",
      shield: "copperShield",
    });
  });

  test("a new player and a save from before gear wear nothing", () => {
    sim.addPlayer("b");
    expect(sim.state.players.get("b")).toMatchObject({
      weapon: "",
      shield: "",
    });
    expect(sim.saveOf("b")).toMatchObject({ weapon: "", shield: "" });
    expect(me().weapon).toBe("");
  });

  test("worn gear can't be dropped, as no slot holds it", () => {
    start({ weapon: "copperSword" });
    for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
      sim.queueDrop("a", slot, 20);
      sim.tick();
    }
    expect(me().weapon).toBe("copperSword");
  });
});

describe("damage on a hit is (100 + bonus)..(200 + 100 per 20 Combat levels + bonus)", () => {
  const LOWEST = 0;
  const HIGHEST = 0.999;
  const swing = (roll: number, fields: Start) => {
    start(fields);
    rolls = [0, roll];
    sim.queueTarget("a", "0");
    sim.tick();
    return swings()[0];
  };

  test.each([
    ["", 0, 100, 200],
    ["copperSword", 0, 200, 300],
    ["ironSword", LEVEL_10_XP, 300, 400],
    ["emberiteSword", LEVEL_20_XP, 400, 600],
  ])("%j at %i experience", (weapon, combatXp, low, high) => {
    expect(swing(LOWEST, { weapon, combatXp })).toBe(low);
    expect(swing(HIGHEST, { weapon, combatXp })).toBe(high);
  });

  // 1,000 evenly spread damage rolls stand in for many swings.
  test.each([
    ["", 0, 150, 9],
    ["copperSword", 0, 250, 15],
    ["ironSword", LEVEL_10_XP, 350, 21],
    ["emberiteSword", LEVEL_20_XP, 500, 30],
  ])(
    "%j at %i experience averages today's hit ×100, and today's experience",
    (weapon, combatXp, hit, xp) => {
      const swung = Array.from({ length: 1000 }, (_, i) => {
        const damage = swing((i + 0.5) / 1000, { weapon, combatXp });
        return { damage, xp: me().combatXp - combatXp };
      });
      const mean = (of: (one: (typeof swung)[number]) => number) =>
        swung.reduce((total, one) => total + of(one), 0) / swung.length;
      expect(mean((one) => one.damage)).toBeCloseTo(hit, 0);
      expect(mean((one) => one.xp)).toBeCloseTo(xp, 1);
    },
  );

  test("a crit multiplies the hit with its sword bonus", () => {
    start({ weapon: "emberiteSword", combatXp: LEVEL_20_XP });
    rolls = [0, LOWEST, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([600]); // 400 × 1.5.
  });

  test("a miss is still a miss with a sword", () => {
    start({ weapon: "emberiteSword" });
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([0]);
  });

  test("a shield adds nothing to a hit", () => {
    expect(swing(LOWEST, { shield: "emberiteShield" })).toBe(100);
  });

  test("the bonus earns experience, but not for overkill", () => {
    start({ weapon: "copperSword" });
    sim.state.enemies.get("0")!.health = 100;
    rolls = [0, HIGHEST];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([100]);
    expect(me().combatXp).toBe(6);
  });
});

describe("shields", () => {
  test("equip, swap and take off as swords do, freeing and filling slots", () => {
    start({ held: ["copperShield", "ironShield"], defenseXp: LEVEL_10_XP });
    sim.equip("a", 0);
    expect(me().shield).toBe("copperShield");
    expect(me().inventory[0]).toBe(EMPTY_SLOT);
    sim.equip("a", 1);
    expect(me().shield).toBe("ironShield");
    expect(me().inventory[1]).toBe("copperShield");
    sim.takeOff("a", "shield");
    expect(me().shield).toBe("");
    expect(me().inventory[0]).toBe("ironShield");
    expect(told()).toEqual([]);
  });

  test("above the Defense level is refused, at any Blocking level", () => {
    start({
      held: ["ironShield"],
      defenseXp: LEVEL_10_XP - 1,
      blockingXp: LEVEL_20_XP,
    });
    sim.equip("a", 0);
    expect(me().shield).toBe("");
    expect(told()).toEqual(["You need Defense 10 to equip this."]);
  });

  test("a level 1 Blocking player can wear the top tier", () => {
    start({ held: ["emberiteShield"], defenseXp: LEVEL_20_XP });
    sim.equip("a", 0);
    expect(me().shield).toBe("emberiteShield");
  });
});

describe("blocking", () => {
  const HIT = 0;
  // The player's own swing on tick 1 misses, and the Spider's first swing comes on tick 5.
  const spiderSwing = (fields: Start, ...swingRolls: number[]) => {
    start({ health: 1000, ...fields });
    rolls = [MISS, ...swingRolls];
    sim.queueTarget("a", "0");
    ticks(5);
    return sim.events.find((event) => event.type === "enemySwing")!;
  };
  // Hit, damage 100, then the block roll.
  const blockRolled = (roll: number, fields: Start) =>
    spiderSwing(fields, HIT, 0, roll);

  test("a block does no damage, gives 40 Blocking, and Defense still gets its 6", () => {
    const swing = blockRolled(0, { shield: "copperShield" });
    expect(swing).toMatchObject({ damage: 0, blocked: true });
    expect(me().health).toBe(1000);
    expect(me().blockingXp).toBe(40);
    expect(me().defenseXp).toBe(6);
  });

  test("a hit that isn't blocked lands as usual and trains no Blocking", () => {
    const swing = blockRolled(0.1, { shield: "copperShield" });
    expect(swing).toMatchObject({ damage: 100, blocked: false });
    expect(me().health).toBe(900);
    expect(me().blockingXp).toBe(0);
    expect(me().defenseXp).toBe(10);
  });

  test("a miss stays a miss, with no block roll or Blocking experience", () => {
    const swing = spiderSwing({ shield: "copperShield" }, MISS, 0);
    expect(swing).toMatchObject({ damage: 0, blocked: false });
    expect(rolls).toEqual([0]);
    expect(me().blockingXp).toBe(0);
    expect(me().defenseXp).toBe(6);
  });

  test("with no shield there is no block roll", () => {
    const swing = spiderSwing({}, HIT, 0, 0);
    expect(swing).toMatchObject({ damage: 100, blocked: false });
    expect(rolls).toEqual([0]);
  });

  // Level 2 adds 0.2 points, and level 99 adds 98 * 0.2 = 19.6.
  test.each([
    ["copperShield", 0, 0.0999, 0.1],
    ["ironShield", 0, 0.1999, 0.2],
    ["emberiteShield", 0, 0.2999, 0.3],
    ["copperShield", 50, 0.1019, 0.1021],
    ["emberiteShield", MAX_XP, 0.4959, 0.4961],
  ])("%s at %i Blocking experience", (shield, blockingXp, blocks, lands) => {
    const fields = { shield, blockingXp };
    expect(blockRolled(blocks, fields)).toMatchObject({ blocked: true });
    expect(blockRolled(lands, fields)).toMatchObject({ blocked: false });
  });

  test("a killing blow can be blocked", () => {
    const swing = blockRolled(0, { shield: "copperShield", health: 1 });
    expect(swing).toMatchObject({ damage: 0, blocked: true });
    expect(me().dead).toBe(false);
  });

  test("Blocking experience is saved and loaded", () => {
    blockRolled(0, { shield: "copperShield" });
    expect(sim.saveOf("a")).toMatchObject({ blockingXp: 40 });
    start({ blockingXp: 40 });
    expect(me().blockingXp).toBe(40);
  });
});

describe("armour", () => {
  // As the Spider's region, with a Skeleton in its place.
  const SKELETON_TILES = parseRegion(
    ["TTTTTTT", "TRK...T", "T.....T", "TTTTTTT"].join("\n"),
  );
  const HIT = 0;
  // 100 + floor(0.5 * 401) = 300 on a Skeleton's 100..500.
  const HIT_300 = 0.5;
  const FULL_EMBERITE = {
    head: "emberiteHelmet",
    body: "emberiteChestplate",
    legs: "emberiteLeggings",
  };
  // The player's own swing on tick 1 misses, and the Skeleton's first swing comes on tick 5.
  const skeletonSwing = (fields: Start, ...swingRolls: number[]) => {
    start({ health: 1000, tiles: SKELETON_TILES, ...fields });
    rolls = [MISS, ...swingRolls];
    sim.queueTarget("a", "0");
    ticks(5);
    return sim.events.find((event) => event.type === "enemySwing")!;
  };

  test.each([
    ["iron", 10, LEVEL_10_XP],
    ["emberite", 20, LEVEL_20_XP],
  ])("%s armour needs Defense %i", (tier, level, xp) => {
    for (const piece of ["Helmet", "Chestplate", "Leggings"]) {
      start({ held: [tier + piece], defenseXp: xp - 1 });
      sim.equip("a", 0);
      expect(told()).toEqual([`You need Defense ${level} to equip this.`]);
      start({ held: [tier + piece], defenseXp: xp });
      sim.equip("a", 0);
      expect(me().inventory[0]).toBe(EMPTY_SLOT);
    }
  });

  test("head, body and legs go in their own slots, and come off again", () => {
    start({
      held: ["copperHelmet", "copperChestplate", "copperLeggings"],
    });
    for (const slot of [0, 1, 2]) sim.equip("a", slot);
    expect([me().head, me().body, me().legs]).toEqual([
      "copperHelmet",
      "copperChestplate",
      "copperLeggings",
    ]);
    sim.takeOff("a", "body");
    expect(me().body).toBe("");
    expect(me().inventory[0]).toBe("copperChestplate");
  });

  test("full Emberite turns a Skeleton hit of 300 into 228", () => {
    const swing = skeletonSwing(FULL_EMBERITE, HIT, HIT_300);
    expect(swing).toMatchObject({ damage: 228, blocked: false });
    expect(me().health).toBe(772);
  });

  test.each([
    ["copper", 276],
    ["iron", 252],
    ["emberite", 228],
  ])("a full %s set takes its table's percentage off", (tier, damage) => {
    const fields = {
      head: `${tier}Helmet`,
      body: `${tier}Chestplate`,
      legs: `${tier}Leggings`,
    };
    expect(skeletonSwing(fields, HIT, HIT_300)).toMatchObject({ damage });
  });

  test("pieces add together, and round to the nearest whole number", () => {
    // 300 less 12% + 4% = 252.
    const mixed = { body: "emberiteChestplate", head: "ironHelmet" };
    expect(skeletonSwing(mixed, HIT, HIT_300)).toMatchObject({ damage: 252 });
    // 101 less 2% is 98.98.
    const helmet = { head: "copperHelmet" };
    expect(skeletonSwing(helmet, HIT, 1 / 401)).toMatchObject({ damage: 99 });
  });

  test("a blocked hit still does nothing", () => {
    const fields = { ...FULL_EMBERITE, shield: "copperShield" };
    const swing = skeletonSwing(fields, HIT, HIT_300, 0);
    expect(swing).toMatchObject({ damage: 0, blocked: true });
    expect(me().health).toBe(1000);
  });

  test("a hit that lands is never reduced to 0", () => {
    // The smallest hit, 100, through the most armour.
    expect(skeletonSwing(FULL_EMBERITE, HIT, 0)).toMatchObject({ damage: 76 });
  });

  test("the health cap comes after armour, so a big enough hit still kills", () => {
    const swing = skeletonSwing(
      { ...FULL_EMBERITE, health: 228 },
      HIT,
      HIT_300,
    );
    expect(swing).toMatchObject({ damage: 228 });
    expect(me().dead).toBe(true);
    const survives = skeletonSwing(
      { ...FULL_EMBERITE, health: 229 },
      HIT,
      HIT_300,
    );
    expect(survives).toMatchObject({ damage: 228 });
    expect(me().health).toBe(1);
  });

  test("armour on or off gives the same Defense experience for the same hit", () => {
    skeletonSwing({}, HIT, HIT_300);
    const bare = me().defenseXp;
    skeletonSwing(FULL_EMBERITE, HIT, HIT_300);
    expect(me().defenseXp).toBe(bare);
    // 6 for the swing, and 4 per 100 of the 300 hit.
    expect(bare).toBe(18);
  });

  test("armour is saved and loaded", () => {
    start(FULL_EMBERITE);
    expect(sim.saveOf("a")).toMatchObject(FULL_EMBERITE);
    start(FULL_EMBERITE);
    expect(me()).toMatchObject(FULL_EMBERITE);
  });
});

describe("anything invalid off the network is ignored", () => {
  test.each([-1, INVENTORY_SLOTS, 1.5, "0", null, undefined, [0], {}, NaN])(
    "equipping slot %j",
    (slot) => {
      start({ held: ["copperSword"] });
      sim.equip("a", slot as number);
      expect(me().weapon).toBe("");
      expect(sim.events).toEqual([]);
    },
  );

  test("equipping an empty slot, food or a material", () => {
    start({ held: ["berry", "copperOre"] });
    for (const slot of [0, 1, 2]) sim.equip("a", slot);
    expect(me().weapon).toBe("");
    expect(me().inventory[0]).toBe("berry");
    expect(me().inventory[1]).toBe("copperOre");
    expect(sim.events).toEqual([]);
  });

  test.each(["", "health", "inventory", "__proto__", null, 0, ["weapon"], {}])(
    "taking off %j",
    (slot) => {
      start({ weapon: "copperSword" });
      sim.takeOff("a", slot as GearSlot);
      expect(me().weapon).toBe("copperSword");
      expect(sim.events).toEqual([]);
    },
  );

  test("a player who isn't there", () => {
    sim.equip("nobody", 0);
    sim.takeOff("nobody", "weapon");
    expect(sim.events).toEqual([]);
  });

  test("a dead player, as for eating and dropping", () => {
    start({ held: ["copperSword"], weapon: "copperSword" });
    me().dead = true;
    sim.equip("a", 0);
    sim.takeOff("a", "weapon");
    expect(me().inventory[0]).toBe("copperSword");
    expect(me().weapon).toBe("copperSword");
  });
});

describe("improved gear", () => {
  test("is equipped at its common form's gate", () => {
    start({ held: ["ironSword:uncommon:might"], combatXp: LEVEL_10_XP - 1 });
    sim.equip("a", 0);
    expect(me().weapon).toBe("");
    expect(told()).toEqual(["You need Combat 10 to equip this."]);
    start({ held: ["ironSword:uncommon:might"], combatXp: LEVEL_10_XP });
    sim.equip("a", 0);
    expect(me().weapon).toBe("ironSword:uncommon:might");
    expect(me().inventory[0]).toBe(EMPTY_SLOT);
  });

  test("swings with its common form's hit bonus", () => {
    start({ weapon: "emberiteSword:rare:fortitude", combatXp: LEVEL_20_XP });
    rolls = [0, 0, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([600]);
  });

  test("takes off back into the inventory whole", () => {
    start({ body: "copperChestplate:rare:avoidance" });
    sim.takeOff("a", "body");
    expect(me().body).toBe("");
    expect(me().inventory[0]).toBe("copperChestplate:rare:avoidance");
  });
});

describe("Virtues", () => {
  const FORTITUDE_20 = "copperChestplate:uncommon:fortitude";
  const FORTITUDE_40 = "copperHelmet:rare:fortitude";

  test("Might adds to a hit that lands, with the sword's bonus", () => {
    start({ weapon: "copperSword:uncommon:might" });
    rolls = [0, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([203]); // 100 + 100 for the sword + 3.
  });

  test("Might from several pieces adds up", () => {
    start({
      weapon: "copperSword:uncommon:might",
      body: "emberiteChestplate:rare:might",
    });
    rolls = [0, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([233]); // 200 + 3 + 30.
  });

  test("Might adds nothing to a miss", () => {
    start({ weapon: "emberiteSword:rare:might" });
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([0]);
  });

  test("a critical multiplies Might with the rest of the hit", () => {
    start({ weapon: "emberiteSword:rare:might", combatXp: LEVEL_20_XP });
    rolls = [0, 0, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([645]); // (400 + 30) × 1.5.
  });

  test("Avoidance takes points off the enemy's chance to hit, after Defense", () => {
    // The Spider hits on a roll under 35% at Defense 1; a rare Emberite piece takes 1 point off.
    const spiderSwing = (fields: Start, roll: number) => {
      start(fields);
      rolls = [MISS, roll, 0];
      sim.queueTarget("a", "0");
      ticks(5);
      return sim.events.find((event) => event.type === "enemySwing")!;
    };
    const avoids = { body: "emberiteChestplate:rare:avoidance" };
    expect(spiderSwing({}, 0.345)).not.toMatchObject({ damage: 0 });
    expect(spiderSwing(avoids, 0.345)).toMatchObject({ damage: 0 });
    expect(spiderSwing(avoids, 0.335)).not.toMatchObject({ damage: 0 });
    // Defense 10 makes it 33.2%, and the Avoidance 32.2%.
    const trained = { ...avoids, defenseXp: LEVEL_10_XP };
    expect(spiderSwing({ defenseXp: LEVEL_10_XP }, 0.325)).not.toMatchObject({
      damage: 0,
    });
    expect(spiderSwing(trained, 0.325)).toMatchObject({ damage: 0 });
    expect(spiderSwing(trained, 0.32)).not.toMatchObject({ damage: 0 });
  });

  test("Fortitude adds to max health on load, and worn pieces add up", () => {
    start({ body: FORTITUDE_20, head: FORTITUDE_40 });
    expect(me().maxHealth).toBe(1060);
  });

  test("equipping Fortitude raises max health, never health", () => {
    start({ held: [FORTITUDE_20] });
    sim.equip("a", 0);
    expect(me()).toMatchObject({ maxHealth: 1020, health: 1000 });
  });

  test("taking Fortitude off lowers health to the new max, only if above it", () => {
    start({ body: FORTITUDE_20, health: 1020 });
    sim.takeOff("a", "body");
    expect(me()).toMatchObject({ maxHealth: 1000, health: 1000 });
    start({ body: FORTITUDE_20, health: 500 });
    sim.takeOff("a", "body");
    expect(me()).toMatchObject({ maxHealth: 1000, health: 500 });
  });

  test("swapping for less Fortitude lowers health to the new max", () => {
    start({
      held: ["copperHelmet:uncommon:fortitude"],
      head: FORTITUDE_40,
      health: 1040,
    });
    sim.equip("a", 0);
    expect(me()).toMatchObject({ maxHealth: 1020, health: 1020 });
  });

  test("Fortitude dropped on death leaves max health with it, so the respawn fills only the rest", () => {
    start({ weapon: "copperSword:uncommon:fortitude", health: 100 });
    rolls = [MISS, 0, 0]; // The Spider's first swing hits for 100.
    sim.queueTarget("a", "0");
    ticks(5);
    expect(me().dead).toBe(true);
    ticks(10);
    expect(me()).toMatchObject({ dead: false, maxHealth: 1000, health: 1000 });
  });

  test("a Hitpoints level-up keeps worn Fortitude in max health", () => {
    start({ body: FORTITUDE_20, hitpointsXp: LEVEL_10_XP - 5, health: 500 });
    expect(me().maxHealth).toBe(920);
    rolls = [0, 0];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(me()).toMatchObject({ maxHealth: 1020, health: 500 });
  });
});
