import { parseRegion, type WorldEvent } from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
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
      line: "The Blacksmith gives you a pickaxe and a hammer.",
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
  while (me().health === me().maxHealth) ticks(1);
  expect(events).toEqual([
    {
      type: "told",
      player: "a",
      line: "You're hit, and Odo stops talking.",
    },
    { type: "talkEnded", player: "a" },
  ]);
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
