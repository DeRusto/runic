import { QUEST_DONE } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { showJournal } from "./journal.ts";
import type { WorldConnection } from "./players.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);
vi.stubGlobal("innerWidth", 1000);
vi.stubGlobal("innerHeight", 700);

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  replaceChildren(...children: any[]) {
    this.children = children;
  },
  attributes: {} as Record<string, string>,
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  },
  children: [] as any[],
  dataset: {} as Record<string, string>,
  style: {} as Record<string, string>,
  classList: { toggle() {} },
  querySelector: () => ({ setPointerCapture() {} }),
  hidden: false,
  textContent: "",
  onclick: undefined as undefined | (() => void),
});

let byId: Map<string, ReturnType<typeof element>>;
const el = (id: string) => {
  if (!byId.has(id)) byId.set(id, element());
  return byId.get(id)!;
};
let keyListeners: ((event: unknown) => void)[];
vi.stubGlobal("document", {
  getElementById: el,
  createElement: element,
  addEventListener: (type: string, listener: (event: unknown) => void) =>
    type === "keydown" && keyListeners.push(listener),
  removeEventListener: (type: string, listener: (event: unknown) => void) =>
    (keyListeners = keyListeners.filter((other) => other !== listener)),
});

const press = (key: string, more: object = {}) =>
  keyListeners.forEach((listener) => listener({ key, target: {}, ...more }));

let room: {
  onStateChange: (handler: (state: any) => void) => void;
  onLeave: (handler: () => void) => void;
  leave: () => void;
};
let draw: (state: any) => void;
const isOpen = () => !el("journal").hidden;

/** Draws a player whose quest ids and parallel stages are these. */
const questsOf = (quests: string[], stages: string[], points = 0) =>
  draw({
    players: {
      get: () => ({ quests, questStages: stages, questPoints: points }),
    },
  });
/** Each row's title and stage text. */
const rows = () =>
  el("journal-quests").children.map((row) =>
    row.children.map((cell: { textContent: string }) => cell.textContent),
  );

beforeEach(() => {
  byId = new Map();
  keyListeners = [];
  let leave = () => {};
  room = {
    onStateChange: (handler) => (draw = handler),
    onLeave: (handler) => (leave = handler),
    leave: () => leave(),
  };
  showJournal(room as unknown as WorldConnection);
});

test("opens and closes from its button and with J", () => {
  expect(isOpen()).toBe(false);
  el("journal-button").onclick!();
  expect(isOpen()).toBe(true);
  expect(el("journal-button").attributes["aria-pressed"]).toBe("true");
  el("journal-button").onclick!();
  expect(isOpen()).toBe(false);
  press("j");
  expect(isOpen()).toBe(true);
  press("J");
  expect(isOpen()).toBe(false);
  el("journal-button").onclick!();
  el("journal-close").onclick!();
  expect(isOpen()).toBe(false);
});

test("J typed in chat, or with a modifier, does nothing", () => {
  press("j", { target: new FakeInput() });
  press("j", { ctrlKey: true });
  expect(isOpen()).toBe(false);
});

test("leaving the world stops the J key", () => {
  room.leave();
  press("j");
  expect(isOpen()).toBe(false);
});

test("an empty journal asks the player to talk to the villagers", () => {
  questsOf([], []);
  expect(el("journal-quests").children[0].textContent).toBe(
    "You have no quests yet. Talk to the villagers.",
  );
  expect(el("journal-points").textContent).toBe("Quest points: 0");
});

test("lists each quest with its current stage, and the points with it", () => {
  questsOf(["odoCopper"], ["fetch"], 1);
  expect(rows()).toEqual([
    [
      "Ore for the forge",
      "Odo wants one copper ore from the vein past the east road.",
    ],
  ]);
  expect(el("journal-points").textContent).toBe("Quest points: 1");
});

test("a stage the quest moved past shows in place, and a finished one reads completed", () => {
  questsOf(["odoCopper"], [QUEST_DONE], 1);
  expect(rows()).toEqual([["Ore for the forge", "Completed."]]);
  expect(el("journal-quests").children[0].dataset.done).toBe("true");
});
