import { parseRegion, QUEST_DONE, type WorldEvent } from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// Odo stands at (3,1), the furnace at (4,1) and the anvil at (6,1); (2,1) is beside Odo.
const TILES = parseRegion(
  ["TTTTTTTTTT", "TR.BF.N..T", "T........T", "TS.......T", "TTTTTTTTTT"].join(
    "\n",
  ),
);
const NEXT_TO_ODO = { x: 2, y: 1 };
/** Odo's greet: his work's offer first. */
const WORK = 0;
/** The turn-in choice, first on both the stage's node and the repeats'. */
const TURN_IN = 0;

let sim: Simulation;
let events: WorldEvent[];
const me = () => sim.state.players.get("a")!;
/** Only what a conversation and a quest send. */
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (["talk", "talkEnded", "told"].includes(event.type))
        events.push(event);
  }
};
/** Picks a choice, and returns what it sent. */
const choose = (choice: unknown) => {
  events = [];
  sim.choose("a", choice as number);
  ticks(1);
  return events;
};
const talk = (node: string) => ({
  type: "talk",
  player: "a",
  villager: "odo",
  node,
});
const told = (line: string) => ({ type: "told", player: "a", line });

/** Opens a conversation with Odo, already beside him. */
const talkToOdo = () => {
  Object.assign(me(), NEXT_TO_ODO);
  sim.queueVisit("a", "odo");
  ticks(1);
};
/** Puts `count` copper ore in the player's first slot. */
const holds = (count: number) => {
  me().inventory[0] = count ? "copperOre" : "";
  me().inventoryCounts[0] = count;
};
/** Accepts Odo's work, starting the quest. */
const starts = () => {
  talkToOdo();
  choose(WORK);
  // "I'll fetch it."
  choose(0);
};
/** Revisits Odo and turns the ore in, finishing the quest. */
const finishes = () => {
  talkToOdo();
  holds(1);
  choose(TURN_IN);
};

beforeEach(() => {
  events = [];
  sim = new Simulation(TILES, () => 0.99);
  sim.addPlayer("a");
});

test("a new player has no quests, no points and no pickaxe", () => {
  expect([...me().quests]).toEqual([]);
  expect([...me().questStages]).toEqual([]);
  expect(me().questPoints).toBe(0);
  expect([...me().tools]).toEqual([]);
});

describe("Odo's quest, accepted and turned in", () => {
  test("accepting the work starts the quest and hands over the pickaxe", () => {
    talkToOdo();
    expect(choose(WORK)).toEqual([talk("work")]);
    // "I'll fetch it."
    expect(choose(0)).toEqual([
      told("Odo gives you a pickaxe."),
      talk("accept"),
    ]);
    expect([...me().quests]).toEqual(["odoCopper"]);
    expect([...me().questStages]).toEqual(["fetch"]);
    expect([...me().tools]).toEqual(["pickaxe"]);
    expect(me().questPoints).toBe(0);
  });

  test("the pickaxe is given only when lacked", () => {
    me().tools.push("pickaxe");
    talkToOdo();
    choose(WORK);
    expect(choose(0)).toEqual([talk("accept")]);
    expect([...me().tools]).toEqual(["pickaxe"]);
  });

  test("while the ore is asked for, Odo opens with the stage's node", () => {
    starts();
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("quest")]);
  });

  test("handing over the ore finishes the quest for its point", () => {
    starts();
    finishes();
    expect(events).toEqual([
      told("You finish Ore for the forge. You earn 1 quest point."),
      talk("ore"),
    ]);
    expect(me().inventoryCounts[0]).toBe(0);
    expect([...me().questStages]).toEqual([QUEST_DONE]);
    expect(me().questPoints).toBe(1);
  });

  test("a turn-in without the ore keeps the stage, and says what's missing", () => {
    starts();
    events = [];
    talkToOdo();
    expect(choose(TURN_IN)).toEqual([
      {
        ...told("You have no [Copper ore] to hand over."),
        items: ["copperOre"],
      },
      talk("quest"),
    ]);
    expect([...me().questStages]).toEqual(["fetch"]);
    expect(me().questPoints).toBe(0);
  });

  test("the smithy's furnace is ignored until the ore is handed over, and works after", () => {
    starts();
    holds(1);
    sim.queueMake("a", { item: "copperBar", all: false });
    ticks(1);
    expect(me().action).toBe("");
    finishes();
    holds(1);
    sim.queueMake("a", { item: "copperBar", all: false });
    ticks(30);
    expect(me().inventory[0]).toBe("copperBar");
    expect(me().inventoryCounts[0]).toBe(1);
  });
});

describe("Odo's repeat turn-ins", () => {
  test("each repeat ore pays Mining, and no Mastery share with it", () => {
    starts();
    finishes();
    for (let turns = 1; turns <= 3; turns++) {
      holds(1);
      events = [];
      talkToOdo();
      expect(events).toEqual([talk("repeat")]);
      expect(choose(TURN_IN)).toEqual([talk("oreAgain")]);
      expect(me().miningXp).toBe(12 * turns);
      expect(me().masteryXp).toBe(0);
    }
    expect([...me().questStages]).toEqual([QUEST_DONE]);
    expect(me().questPoints).toBe(1);
  });

  test("the repeats run out, and the forge node is all that's left", () => {
    starts();
    finishes();
    for (let turns = 1; turns <= 3; turns++) {
      holds(1);
      events = [];
      talkToOdo();
      choose(TURN_IN);
    }
    holds(1);
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("forge")]);
    // The forge node offers no turn-in, so the ore is his no longer.
    expect(me().inventoryCounts[0]).toBe(1);
  });
});

describe("Odo's second quest, the strange material (#232)", () => {
  /** Puts `count` strange material in the player's first slot. */
  const holdsEssence = (count: number) => {
    me().inventory[0] = count ? "strangeMaterial" : "";
    me().inventoryCounts[0] = count;
  };
  /** Runs Odo's first quest and its three repeats, so the forge talk is next. */
  const spendsTheForge = () => {
    starts();
    finishes();
    for (let turns = 1; turns <= 3; turns++) {
      holds(1);
      talkToOdo();
      choose(TURN_IN);
    }
  };

  test("the forge's offer starts it once the copper ore and its repeats are done", () => {
    spendsTheForge();
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("forge")]);
    // "About the strange material the veins give..."
    expect(choose(0)).toEqual([talk("essence")]);
    expect([...me().quests]).toEqual(["odoCopper", "odoEssence"]);
    expect([...me().questStages]).toEqual([QUEST_DONE, "essence"]);
    expect(me().questPoints).toBe(1);
  });

  test("while the strange material is asked for, Odo opens with the stage's node", () => {
    spendsTheForge();
    talkToOdo();
    choose(0);
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("essenceQuest")]);
  });

  test("handing over a piece names it and moves to the proof", () => {
    spendsTheForge();
    talkToOdo();
    choose(0);
    holdsEssence(1);
    talkToOdo();
    events = [];
    expect(choose(TURN_IN)).toEqual([talk("essenceGiven")]);
    expect([...me().questStages]).toEqual([QUEST_DONE, "proof"]);
    // The second quest's point comes with the second stage's turn-in.
    expect(me().questPoints).toBe(1);
    expect(me().identifiesEssence).toBe(false);
  });

  test("a turn-in without the piece keeps the stage, and says what's missing", () => {
    spendsTheForge();
    talkToOdo();
    choose(0);
    talkToOdo();
    events = [];
    expect(choose(TURN_IN)).toEqual([
      {
        ...told("You have no [Strange material] to hand over."),
        items: ["strangeMaterial"],
      },
      talk("essenceQuest"),
    ]);
    expect([...me().questStages]).toEqual([QUEST_DONE, "essence"]);
  });

  test("the proof's three finish the quest: they teach identification, and what's held turns", () => {
    spendsTheForge();
    talkToOdo();
    choose(0);
    holdsEssence(1);
    talkToOdo();
    choose(TURN_IN);
    holdsEssence(3);
    // Two more besides the proof's three, and five in the bank.
    me().inventory[1] = "strangeMaterial";
    me().inventoryCounts[1] = 2;
    me().bank[0] = "strangeMaterial";
    me().bankCounts[0] = 5;
    talkToOdo();
    events = [];
    expect(choose(TURN_IN)).toEqual([
      told("You finish The strange material. You earn 1 quest point."),
      talk("taught"),
    ]);
    expect(me().questPoints).toBe(2);
    // The teaching sets the flag at once, and every strange material held —
    // inventory and bank alike — turns to rune essence. The turn-in took the
    // proof's three from the last slot first, so one stack of two is left.
    expect(me().identifiesEssence).toBe(true);
    expect([...me().inventory].slice(0, 2)).toEqual(["runeEssence", ""]);
    expect(me().inventoryCounts[0]).toBe(2);
    expect(me().bank[0]).toBe("runeEssence");
    expect(me().bankCounts[0]).toBe(5);
  });

  test("done, the conversation opens with the runes' node", () => {
    spendsTheForge();
    talkToOdo();
    choose(0);
    holdsEssence(1);
    talkToOdo();
    choose(TURN_IN);
    holdsEssence(3);
    talkToOdo();
    choose(TURN_IN);
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("runes")]);
  });
});

describe("the quest is saved with the player", () => {
  test("a save carries each quest's stage and repeat turn-ins, and the points", () => {
    starts();
    finishes();
    for (let turns = 1; turns <= 2; turns++) {
      holds(1);
      talkToOdo();
      choose(TURN_IN);
    }
    const save = sim.saveOf("a")!;
    expect(save.questPoints).toBe(1);
    expect(save.quests).toEqual({
      odoCopper: { stage: QUEST_DONE, turns: 2 },
    });
  });

  test("loading a save brings the progress back, repeats included", () => {
    starts();
    finishes();
    for (let turns = 1; turns <= 2; turns++) {
      holds(1);
      events = [];
      talkToOdo();
      choose(TURN_IN);
    }
    const save = sim.saveOf("a")!;
    sim = new Simulation(TILES, () => 0.99);
    sim.addPlayer("a", save);
    expect([...me().quests]).toEqual(["odoCopper"]);
    expect([...me().questStages]).toEqual([QUEST_DONE]);
    expect(me().questPoints).toBe(1);
    // The last of the three repeats is still owed, on top of the two already paid.
    holds(1);
    events = [];
    talkToOdo();
    expect(events).toEqual([talk("repeat")]);
    choose(TURN_IN);
    expect(me().miningXp).toBe(36);
  });

  test("a save from before the quests starts fresh", () => {
    sim = new Simulation(TILES, () => 0.99);
    sim.addPlayer("a", {
      x: 1,
      y: 1,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 1000,
      inventory: Array(30).fill(""),
    });
    expect([...me().quests]).toEqual([]);
    expect([...me().questStages]).toEqual([]);
    expect(me().questPoints).toBe(0);
  });
});
