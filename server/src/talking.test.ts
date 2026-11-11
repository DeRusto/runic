import { parseRegion, type WorldEvent } from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(
  ["TTTTTTTTT", "TR.....BT", "T.......T", "TM......T", "TTTTTTTTT"].join("\n"),
);
const NEXT_TO = { x: 6, y: 1 };
const WORK = 0;
const FURNACE = 1;
const TOOLS = 2;
const BYE = 3;

let sim: Simulation;
let events: WorldEvent[];
const me = () => sim.state.players.get("a")!;
/** Only what a conversation sends: its moves, its end and its lines in the chat box. */
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

/** Opens a conversation with Odo, already beside him. */
const talkToOdo = () => {
  Object.assign(me(), NEXT_TO);
  sim.queueVisit("a", "odo");
  ticks(1);
  events = [];
};

beforeEach(() => {
  events = [];
  sim = new Simulation(TILES, () => 0.99);
  sim.addPlayer("a");
});

test("clicking Odo walks next to him, and the conversation opens on arrival with nothing given", () => {
  sim.queueVisit("a", "odo");
  ticks(1);
  expect(me().action).toBe("walking");
  expect(events).toEqual([]);
  ticks(20);
  expect(me()).toMatchObject({ ...NEXT_TO, action: "" });
  expect(events).toEqual([talk("greet")]);
  expect([...me().tools]).toEqual([]);
});

test("clicking Marta opens her own conversation, and a villager who isn't there is ignored", () => {
  sim.queueVisit("a", "nobody");
  ticks(1);
  expect(me().action).toBe("");
  sim.queueVisit("a", "marta");
  ticks(20);
  expect(me()).toMatchObject({ x: 1, y: 2, action: "" });
  expect(events).toEqual([{ ...talk("greet"), villager: "marta" }]);
});

test("a conversation walks through its choices to its last line, and then takes no more", () => {
  talkToOdo();
  expect(choose(WORK)).toEqual([talk("work")]);
  expect(choose(1)).toEqual([talk("later")]);
  expect(choose(0)).toEqual([]);
});

test("a conversation still showing its last lines ends when the player walks away", () => {
  talkToOdo();
  choose(BYE);
  events = [];
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([
    { type: "told", player: "a", line: "You walk away from Odo." },
    { type: "talkEnded", player: "a" },
  ]);
});

test("a conversation whose last lines the player has read ends quietly", () => {
  talkToOdo();
  choose(BYE);
  sim.endTalk("a");
  events = [];
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([]);
});

test("a node with no choices of its own offers the ones it leads back to", () => {
  talkToOdo();
  expect(choose(FURNACE)).toEqual([talk("furnace")]);
  expect(choose(BYE)).toEqual([talk("bye")]);
  expect(choose(BYE)).toEqual([]);
});

test("asking Odo for tools gives the missing ones, and nothing once every tool is held", () => {
  talkToOdo();
  expect(choose(TOOLS)).toEqual([
    talk("tools"),
    {
      type: "told",
      player: "a",
      line: "Odo gives you a pickaxe and a hammer.",
    },
  ]);
  expect([...me().tools]).toEqual(["pickaxe", "hammer"]);
  talkToOdo();
  expect(choose(TOOLS)).toEqual([talk("tools")]);
  expect([...me().tools]).toEqual(["pickaxe", "hammer"]);
});

test("a choice is refused once the player is no longer beside Odo", () => {
  talkToOdo();
  Object.assign(me(), { x: 1, y: 1 });
  expect(choose(TOOLS)).toEqual([
    { type: "told", player: "a", line: "You walk away from Odo." },
    { type: "talkEnded", player: "a" },
  ]);
  expect([...me().tools]).toEqual([]);
});

test("walking away ends the conversation with a line", () => {
  talkToOdo();
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([
    { type: "told", player: "a", line: "You walk away from Odo." },
    { type: "talkEnded", player: "a" },
  ]);
  expect(choose(TOOLS)).toEqual([]);
});

test("closing the conversation ends it quietly", () => {
  talkToOdo();
  sim.endTalk("a");
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([]);
  expect(choose(TOOLS)).toEqual([]);
});

test("being hit ends the conversation", () => {
  sim = new Simulation(parseRegion("TTTTT\nTBRST\nTTTTT"), () => 0);
  sim.addPlayer("a");
  sim.queueVisit("a", "odo");
  ticks(1);
  sim.queueTarget("a", "0");
  events = [];
  for (let i = 0; i < 50 && me().health === me().maxHealth; i++) ticks(1);
  expect(events).toEqual([
    {
      type: "told",
      player: "a",
      line: "You're hit, and Odo stops talking.",
    },
    { type: "talkEnded", player: "a" },
  ]);
});

describe.each([
  ["B", "odo", undefined, "talkEnded", "Odo stops talking"],
  ["M", "marta", "openStore", "storeClosed", "Marta stops trading"],
  ["$", "aldous", "openBank", "bankClosed", "Aldous shuts the bank"],
])("with %s's window open", (tile, villager, then, closed, says) => {
  /** Opens the window beside the villager, attacks the Spider beyond, and returns every event up to its first swing. */
  const untilSwung = (roll: number, shield: string) => {
    sim = new Simulation(parseRegion(`TTTTT\nT${tile}RST\nTTTTT`), () => roll);
    sim.addPlayer("a");
    me().shield = shield;
    sim.queueVisit("a", villager, then);
    sim.tick();
    sim.queueTarget("a", "0");
    sim.events.splice(0);
    const sent: WorldEvent[] = [];
    for (
      let i = 0;
      i < 50 && !sent.some(({ type }) => type === "enemySwing");
      i++
    ) {
      sim.tick();
      sent.push(...sim.events.splice(0));
    }
    return sent;
  };

  test("a blocked swing closes it", () => {
    const sent = untilSwung(0, "copperShield");
    expect(sent).toContainEqual(expect.objectContaining({ blocked: true }));
    expect(sent).toContainEqual({
      type: "told",
      player: "a",
      line: `You're hit, and ${says}.`,
    });
    expect(sent).toContainEqual({ type: closed, player: "a" });
  });

  test("a miss leaves it open", () => {
    const sent = untilSwung(0.99, "");
    expect(sent).toContainEqual(expect.objectContaining({ damage: 0 }));
    expect(sent.map(({ type }) => type)).not.toContain(closed);
  });
});

test("a choice that isn't one of the current ones is ignored", () => {
  talkToOdo();
  for (const choice of [4, -1, 1.5, "2", null, [2]])
    expect(choose(choice)).toEqual([]);
  expect(choose(BYE)).toEqual([talk("bye")]);
});

test("a choice from a player not talking is ignored", () => {
  expect(choose(TOOLS)).toEqual([]);
  expect(() => sim.choose("nobody", 0)).not.toThrow();
  expect(() => sim.endTalk("nobody")).not.toThrow();
});
