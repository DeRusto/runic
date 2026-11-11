import { MAKE_INTENT, WALK_INTENT, xpForLevel } from "@runic/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";
import { showSmithingPanel } from "./smithingPanel.ts";

vi.mock("./stations.ts", () => ({
  stationTile: (kind: string) =>
    kind === "anvil" ? { x: 6, y: 1 } : { x: 4, y: 1 },
}));

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
    // Next to both stations, unless a test walks away.
    x: 5,
    y: 1,
    dead: false,
    smithingXp: 0,
    miningXp: 0,
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
  expect(shownRows()).toHaveLength(5);
  open("anvil");
  expect(byId.get("smithing-title")!.textContent).toBe("Anvil");
  expect(shownRows()).toHaveLength(25);
});

test("the Emberite rows show both materials, greyed until the player qualifies", () => {
  const held: [string, number][] = [
    ["emberiteBar", 3],
    ["emberbone", 1],
  ];
  patch(me(held, { smithingXp: xpForLevel(19) }));
  open("anvil");
  const sword = shownRows()[20];
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
  expect(shownRows()[21].className).toBe("cant");
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
  const iron = shownRows()[10];
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
])("%s sends one intent and leaves the panel open", (label, all) => {
  patch(me([["copperOre", 1]]));
  open("furnace");
  buttons(shownRows()[0])
    .find((b: any) => b.textContent === label)
    .onclick();
  expect(send.mock.calls).toEqual([[MAKE_INTENT, { item: "copperBar", all }]]);
  expect(panel().hidden).toBe(false);
});

test("a second pick sends its own intent, for the server to replace the action with", () => {
  patch(me([["copperOre", 2]]));
  open("furnace");
  const [makeOne, makeAll] = buttons(shownRows()[0]);
  makeAll.onclick();
  makeOne.onclick();
  expect(send.mock.calls).toEqual([
    [MAKE_INTENT, { item: "copperBar", all: true }],
    [MAKE_INTENT, { item: "copperBar", all: false }],
  ]);
});

test("the row greys itself as a pick uses up the materials, with the panel still open", () => {
  patch(me([["copperOre", 1]]));
  open("furnace");
  const [bar] = shownRows();
  buttons(bar)[0].onclick();
  patch(me([["copperBar", 1]], { smithingXp: 10 }));
  expect(panel().hidden).toBe(false);
  expect(bar.className).toBe("cant");
  expect(texts(bar)).toContain("1 Copper ore (have 0)");
  expect(texts(bar)).toContain("Not enough materials");
  expect(buttons(bar).every((b: any) => b.disabled)).toBe(true);
});

test("a level gained while it's open lifts that row's level reason", () => {
  patch(me([["ironBar", 3]], { smithingXp: xpForLevel(9) }));
  open("anvil");
  const iron = shownRows()[10];
  expect(texts(iron)).toContain("Needs Smithing 10");
  patch(me([["ironBar", 3]], { smithingXp: xpForLevel(10) }));
  expect(iron.className).toBe("");
  expect(texts(iron)).not.toContain("Needs Smithing 10");
});

test("a furnace row names Mining as its gate, whatever the Smithing level", () => {
  patch(
    me([["ironOre", 1]], {
      smithingXp: xpForLevel(50),
      miningXp: xpForLevel(9),
    }),
  );
  open("furnace");
  const iron = shownRows()[2];
  expect(texts(iron).slice(0, 3)).toEqual([
    "Iron bar",
    "1 Iron ore (have 1)",
    "Mining 10",
  ]);
  expect(texts(iron)).toContain("Needs Mining 10");
  expect(buttons(iron).every((b: any) => b.disabled)).toBe(true);

  patch(me([["ironOre", 1]], { smithingXp: 0, miningXp: xpForLevel(10) }));
  expect(iron.className).toBe("");
  expect(texts(iron)).not.toContain("Needs Mining 10");
  expect(buttons(iron).every((b: any) => !b.disabled)).toBe(true);
});

test("its X closes it", () => {
  open("furnace");
  byId.get("smithing-close")!.onclick!();
  expect(panel().hidden).toBe(true);
});

describe("clicking a station from afar", () => {
  const far = { x: 20, y: 20 };
  const walkingToAnvil = () => {
    patch(me([], far));
    send.mockClear();
    open("anvil");
  };

  test("walks there and stays closed until the player arrives", () => {
    walkingToAnvil();
    expect(send.mock.calls).toEqual([[WALK_INTENT, { x: 6, y: 1 }]]);
    expect(panel().hidden).toBe(true);
    patch(me([], { x: 8, y: 1 }));
    expect(panel().hidden).toBe(true);
    patch(me([], { x: 7, y: 2 }));
    expect(panel().hidden).toBe(false);
    expect(byId.get("smithing-title")!.textContent).toBe("Anvil");
    expect(shownRows()).toHaveLength(25);
  });

  test("already next to it, opens at once and leaves the action alone", () => {
    open("anvil");
    expect(panel().hidden).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  test.each([
    [
      "a press elsewhere",
      () => listeners.get("pointerdown")!({ target: element() }),
    ],
    ["Esc", () => listeners.get("keydown")!({ key: "Escape" })],
    ["death", () => patch(me([], { ...far, dead: true }))],
  ])("%s cancels it, so it never opens later", (_, cancel) => {
    walkingToAnvil();
    cancel();
    patch(me([], { x: 7, y: 1 }));
    expect(panel().hidden).toBe(true);
  });

  test("opens only once, so closing it next to the station stays closed", () => {
    walkingToAnvil();
    patch(me([], { x: 7, y: 1 }));
    listeners.get("keydown")!({ key: "Escape" });
    patch(me([], { x: 7, y: 1 }));
    expect(panel().hidden).toBe(true);
  });
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
