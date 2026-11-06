import { MAKE_INTENT, xpForLevel } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";
import { showSmithingPanel } from "./smithingPanel.ts";

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  replaceChildren(...children: any[]) {
    this.children = children;
  },
  contains(other: unknown) {
    return other === this;
  },
  children: [] as any[],
  hidden: false,
  disabled: false,
  textContent: "",
  className: "",
  type: "",
  onclick: undefined as undefined | (() => void),
});

let byId: Map<string, ReturnType<typeof element>>;
let listeners: Map<string, (event: any) => void>;
vi.stubGlobal("document", {
  getElementById: (id: string) => {
    if (!byId.has(id)) byId.set(id, element());
    return byId.get(id)!;
  },
  createElement: element,
  addEventListener: (type: string, listener: (event: any) => void) =>
    listeners.set(type, listener),
  removeEventListener: (type: string) => listeners.delete(type),
});

const me = (held: [string, number][], more: Partial<SyncedPlayer> = {}) =>
  ({
    dead: false,
    smithingXp: 0,
    inventory: held.map(([item]) => item),
    inventoryCounts: held.map(([, count]) => count),
    ...more,
  }) as unknown as SyncedPlayer;

const send = vi.fn();
let onState: (state: unknown) => void;
let leave: () => void;
let current: SyncedPlayer;
let open: ReturnType<typeof showSmithingPanel>;

const panel = () => byId.get("smithing")!;
const shownRows = () =>
  byId.get("smithing-rows")!.children.filter((row) => !row.hidden);
const texts = (row: any) => row.children.map((c: any) => c.textContent);
const buttons = (row: any) => row.children.filter((c: any) => c.type);
const patch = (next: SyncedPlayer) => {
  current = next;
  onState({ players: new Map([["a", current]]) });
};

beforeEach(() => {
  byId = new Map();
  listeners = new Map();
  send.mockClear();
  current = me([]);
  open = showSmithingPanel({
    sessionId: "a",
    send,
    state: { players: { get: () => current } },
    onStateChange: (handler: typeof onState) => (onState = handler),
    onLeave: (handler: typeof leave) => (leave = handler),
  } as unknown as WorldConnection);
  patch(current);
});

test("starts closed, and opens at a station with that station's rows", () => {
  expect(panel().hidden).toBe(true);
  open("furnace");
  expect(panel().hidden).toBe(false);
  expect(byId.get("smithing-title")!.textContent).toBe("Furnace");
  expect(shownRows()).toHaveLength(3);
  open("anvil");
  expect(byId.get("smithing-title")!.textContent).toBe("Anvil");
  expect(shownRows()).toHaveLength(6);
});

test("the Emberite rows show both materials, greyed until the player qualifies", () => {
  const held: [string, number][] = [
    ["emberiteBar", 3],
    ["emberbone", 1],
  ];
  patch(me(held, { smithingXp: xpForLevel(19) }));
  open("anvil");
  const sword = shownRows()[4];
  expect(texts(sword).slice(0, 2)).toEqual([
    "Emberite sword",
    "3 Emberite bar (have 3), 2 Emberbone (have 1)",
  ]);
  expect(texts(sword)).toContain("Needs Smithing 20");
  expect(buttons(sword).every((b: any) => b.disabled)).toBe(true);

  patch(me(held, { smithingXp: xpForLevel(20) }));
  expect(texts(sword)).toContain("Not enough materials");

  patch(me([held[0]!, ["emberbone", 2]], { smithingXp: xpForLevel(20) }));
  expect(sword.className).toBe("");
  expect(buttons(sword).every((b: any) => !b.disabled)).toBe(true);
  expect(shownRows()[5].className).toBe("cant");
});

test("a row shows the name, cost, materials held and level", () => {
  patch(
    me([
      ["copperBar", 2],
      ["copperBar", 3],
    ]),
  );
  open("anvil");
  const [sword] = shownRows();
  expect(texts(sword).slice(0, 3)).toEqual([
    "Copper sword",
    "3 Copper bar (have 5)",
    "Smithing 1",
  ]);
  expect(sword.className).toBe("");
  expect(buttons(sword).map((b: any) => b.textContent)).toEqual([
    "Make 1",
    "Make all",
  ]);
  expect(buttons(sword).every((b: any) => !b.disabled)).toBe(true);
});

test("a row that can't be made is greyed with the reason, and its buttons are off", () => {
  patch(me([["ironBar", 20]], { smithingXp: xpForLevel(9) }));
  open("anvil");
  const iron = shownRows()[2];
  expect(iron.className).toBe("cant");
  expect(texts(iron)).toContain("Needs Smithing 10");
  expect(buttons(iron).every((b: any) => b.disabled)).toBe(true);
});

test("having too few materials greys a row too", () => {
  open("anvil");
  const [sword] = shownRows();
  expect(sword.className).toBe("cant");
  expect(texts(sword)).toContain("Not enough materials");
});

test("an open panel follows the patches", () => {
  open("furnace");
  const [bar] = shownRows();
  expect(bar.className).toBe("cant");
  patch(me([["copperOre", 1]]));
  expect(shownRows()[0]).toBe(bar);
  expect(bar.className).toBe("");
  expect(texts(bar)).toContain("1 Copper ore (have 1)");
});

test("a row opens right away, with no patch in between", () => {
  current = me([["copperOre", 4]]);
  open("furnace");
  expect(texts(shownRows()[0])).toContain("1 Copper ore (have 4)");
});

test.each([
  ["Make 1", false],
  ["Make all", true],
])("%s sends one intent and closes the panel", (label, all) => {
  patch(me([["copperOre", 1]]));
  open("furnace");
  buttons(shownRows()[0])
    .find((b: any) => b.textContent === label)
    .onclick();
  expect(send.mock.calls).toEqual([[MAKE_INTENT, { item: "copperBar", all }]]);
  expect(panel().hidden).toBe(true);
});

test("Esc closes it", () => {
  open("furnace");
  listeners.get("keydown")!({ key: "a" });
  expect(panel().hidden).toBe(false);
  listeners.get("keydown")!({ key: "Escape" });
  expect(panel().hidden).toBe(true);
});

test("a press anywhere else closes it, and a press inside doesn't", () => {
  open("furnace");
  listeners.get("pointerdown")!({ target: panel() });
  expect(panel().hidden).toBe(false);
  listeners.get("pointerdown")!({ target: element() });
  expect(panel().hidden).toBe(true);
});

test("death closes it, and a dead player can't open it", () => {
  open("furnace");
  patch(me([], { dead: true }));
  expect(panel().hidden).toBe(true);
  open("furnace");
  expect(panel().hidden).toBe(true);
});

test("leaving the room closes it and lets go of the page", () => {
  open("furnace");
  leave();
  expect(panel().hidden).toBe(true);
  expect(listeners.size).toBe(0);
});
