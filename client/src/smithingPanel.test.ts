import { MAKE_INTENT, WALK_INTENT, xpForLevel } from "@runic/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SyncedPlayer } from "./characterSheet.ts";
import { addPanel } from "./panels.ts";
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
  attributes: {} as Record<string, string>,
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  },
  children: [] as any[],
  hidden: false,
  textContent: "",
  className: "",
  type: "",
  style: {} as Record<string, string>,
  dataset: {} as Record<string, string>,
  classList: { toggle() {} },
  querySelector: () => ({ setPointerCapture() {} }),
  onclick: undefined as undefined | (() => void),
});

let byId: Map<string, ReturnType<typeof element>>;
let listeners: Map<string, (event: any) => void>;
vi.stubGlobal("innerWidth", 1000);
vi.stubGlobal("innerHeight", 700);
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
    cookingXp: 0,
    craftingXp: 0,
    fletchingXp: 0,
    runecraftingXp: 0,
    leatherworkingXp: 0,
    jewelsmithingXp: 0,
    inventory: held.map(([item]) => item),
    inventoryCounts: held.map(([, count]) => count),
    ...more,
  }) as unknown as SyncedPlayer;

/** Points at a row, and reads its tooltip line by line. */
const tipOf = (row: any) => {
  row.onpointermove({ clientX: 0, clientY: 0 });
  return byId
    .get("tooltip")!
    .children.map((part: any) =>
      typeof part === "string" ? part : part.textContent,
    )
    .filter(Boolean)
    .join("\n");
};

const send = vi.fn();
let onState: (state: unknown) => void;
let leave: () => void;
let current: SyncedPlayer;
let open: ReturnType<typeof showSmithingPanel>;

const panel = () => byId.get("smithing")!;
/** The open station's tier sections, each a header then its rows. */
const sections = () =>
  byId.get("smithing-rows")!.children.filter((section) => !section.hidden);
const shownRows = () => sections().flatMap((s: any) => s.children.slice(1));
const texts = (row: any) => row.children.map((c: any) => c.textContent);
/** A row's one line: the piece, then its short cost and any reason underneath. */
const line = (row: any) => texts(row).slice(1, 3);
/** What a tier's header reads, and whether its section is unfolded. */
const headers = () =>
  sections().map((s: any) => [...texts(s.children[0]), s.open]);
const buttons = (row: any) => row.children.filter((c: any) => c.type);
/** Whether a Make button is off. Not `disabled`, which would hide the row's tooltip from the pointer over it. */
const off = (button: any) => button.ariaDisabled === "true";
/** The ids of the fires burning now. */
let fires: Set<string>;
const patch = (next: SyncedPlayer) => {
  current = next;
  onState({ players: new Map([["a", current]]), fires });
};

beforeEach(() => {
  byId = new Map();
  listeners = new Map();
  send.mockClear();
  fires = new Set();
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
  expect(shownRows()).toHaveLength(45);
});

test("the range lists every cooking recipe under one Cooking section (#221)", () => {
  open("range");
  expect(byId.get("smithing-title")!.textContent).toBe("Range");
  expect(headers()).toEqual([["Cooking", "", true]]);
  expect(shownRows()).toHaveLength(9);
  expect(texts(shownRows()[0]).slice(1, 2)).toEqual(["Cooked perch"]);
  expect(line(shownRows()[1])).toEqual([
    "Berry perch",
    "1 Perch + 1 Berry · Needs Cooking 5",
  ]);
});

test("the workbench lists Crafting's and Fletching's recipes under two sections (#225, #228)", () => {
  open("workbench");
  expect(byId.get("smithing-title")!.textContent).toBe("Workbench");
  expect(headers()).toEqual([
    ["Crafting", "", true],
    ["Fletching", "", true],
    ["Leatherworking", "", true],
  ]);
  expect(shownRows()).toHaveLength(38);
  expect(texts(shownRows()[0]).slice(1, 2)).toEqual(["Rope"]);
  expect(line(shownRows()[1])).toEqual([
    "Torch",
    "1 Birch log + 1 Rope · Needs Crafting 5",
  ]);
  expect(line(shownRows()[2])).toEqual([
    "Vial",
    "1 Cinderglass · Needs Crafting 10",
  ]);
  // The cloak's own tip says what it keeps, and its cape is any cape.
  expect(line(shownRows()[3])).toEqual([
    "Gossamer cloak",
    "1 Spider silk + 1 Cape · Needs Crafting 15",
  ]);
  // A shaft's log is any tier's, and the arrow's head is its own tier's.
  expect(line(shownRows()[4])).toEqual([
    "Arrow shaft",
    "1 Log · Not enough materials",
  ]);
  expect(line(shownRows()[5])).toEqual([
    "Copper arrow",
    "10 Arrow shaft + 10 Copper arrowhead + 10 Feather · Not enough materials",
  ]);
  expect(line(shownRows()[9])).toEqual([
    "Emberite arrow",
    "10 Arrow shaft + 10 Emberite arrowhead + 10 Feather · Not enough materials",
  ]);
  expect(line(shownRows()[10])).toEqual([
    "Birch bow",
    "1 Birch log + 1 Rope · Not enough materials",
  ]);
  expect(line(shownRows()[11])).toEqual([
    "Oak bow",
    "1 Oak log + 1 Rope · Needs Fletching 10",
  ]);
  expect(line(shownRows()[12])).toEqual([
    "Charwood bow",
    "1 Charwood log + 1 Rope · Needs Fletching 20",
  ]);
});

test("the altar lists the four elemental runes under one Runecrafting section (#232)", () => {
  open("altar");
  expect(byId.get("smithing-title")!.textContent).toBe("Altar");
  expect(headers()).toEqual([["Runecrafting", "", true]]);
  expect(shownRows()).toHaveLength(4);
  expect(line(shownRows()[0])).toEqual([
    "Air rune",
    "1 Rune essence · Not enough materials",
  ]);
  expect(line(shownRows()[1])).toEqual([
    "Water rune",
    "1 Rune essence · Needs Runecrafting 5",
  ]);
  expect(line(shownRows()[3])).toEqual([
    "Fire rune",
    "1 Rune essence · Needs Runecrafting 20",
  ]);
});

test("a rune row is refused on Runecrafting alone, whatever the Smithing level", () => {
  open("altar");
  patch(me([], { runecraftingXp: xpForLevel(9), smithingXp: xpForLevel(99) }));
  expect(line(shownRows()[2])).toEqual([
    "Earth rune",
    "1 Rune essence · Needs Runecrafting 10",
  ]);
  patch(me([["runeEssence", 1]], { runecraftingXp: xpForLevel(10) }));
  expect(line(shownRows()[2])).toEqual(["Earth rune", "1 Rune essence"]);
});

test("a crafting row is refused on Crafting, and the cloak also on its cape and silk", () => {
  open("workbench");
  patch(
    me([["spiderSilk", 2]], {
      smithingXp: xpForLevel(50),
      craftingXp: xpForLevel(15),
    }),
  );
  expect(line(shownRows()[0])).toEqual(["Rope", "2 Spider silk"]);
  expect(line(shownRows()[3])).toEqual([
    "Gossamer cloak",
    "1 Spider silk + 1 Cape · Not enough materials",
  ]);
  patch(
    me(
      [
        ["spiderSilk", 1],
        ["bronzeMightCape", 1],
      ],
      { craftingXp: xpForLevel(15) },
    ),
  );
  expect(line(shownRows()[3])).toEqual([
    "Gossamer cloak",
    "1 Spider silk + 1 Cape",
  ]);
  const make = buttons(shownRows()[3])[1]!;
  make.onclick!(undefined as never);
  expect(send).toHaveBeenCalledWith("make", {
    item: "gossamerCloak",
    all: true,
  });
});

test("a cooking row is refused on Cooking, whatever the Smithing level", () => {
  open("range");
  patch(me([], { smithingXp: xpForLevel(50), cookingXp: xpForLevel(9) }));
  expect(line(shownRows()[3])).toEqual([
    "Cooked trout",
    "1 Trout · Needs Cooking 10",
  ]);
  patch(me([["trout", 1]], { cookingXp: xpForLevel(10) }));
  expect(line(shownRows()[3])).toEqual(["Cooked trout", "1 Trout"]);
});

test("the anvil at Smithing 1 opens Copper and folds the other tiers with their gates, beside the Jewelsmithing section", () => {
  open("anvil");
  expect(headers()).toEqual([
    ["Copper", "", true],
    ["Bronze", "Smithing 5", false],
    ["Iron", "Smithing 10", false],
    ["Steel", "Smithing 15", false],
    ["Emberite", "Smithing 20", false],
    ["Jewelsmithing", "", true],
  ]);
});

test("the anvil lists the ten necks and rings under one Jewelsmithing section (#238)", () => {
  open("anvil");
  const jewels = sections().find(
    (s: any) => texts(s.children[0])[0] === "Jewelsmithing",
  )!;
  expect(jewels.children).toHaveLength(11);
  expect(texts(jewels.children[1])).toEqual([
    expect.any(String),
    "Copper amulet",
    "1 Copper bar · Not enough materials",
    expect.anything(),
    expect.anything(),
  ]);
  expect(line(jewels.children[6])).toEqual([
    "Iron ring",
    "1 Iron bar + 1 Ashstone · Needs Jewelsmithing 10",
  ]);
  // A Smithing level alone doesn't lift a Jewelsmithing row.
  patch(
    me(
      [
        ["steelBar", 1],
        ["cinderglass", 1],
      ],
      { smithingXp: xpForLevel(99) },
    ),
  );
  expect(line(jewels.children[7])).toEqual([
    "Steel amulet",
    "1 Steel bar + 1 Cinderglass · Needs Jewelsmithing 15",
  ]);
  patch(
    me(
      [
        ["steelBar", 1],
        ["cinderglass", 1],
      ],
      { jewelsmithingXp: xpForLevel(15) },
    ),
  );
  expect(line(jewels.children[7])).toEqual([
    "Steel amulet",
    "1 Steel bar + 1 Cinderglass",
  ]);
});

test("the workbench lists Leatherworking's hides and capes under its own section (#238)", () => {
  open("workbench");
  const leather = sections().find(
    (s: any) => texts(s.children[0])[0] === "Leatherworking",
  )!;
  expect(leather.children).toHaveLength(26);
  expect(texts(leather.children[1]).slice(1, 3)).toEqual([
    "Copper gloves",
    "2 Tarn hide · Not enough materials",
  ]);
  expect(texts(leather.children[2]).slice(1, 3)).toEqual([
    "Copper boots",
    "2 Tarn hide · Not enough materials",
  ]);
  expect(line(leather.children[14])).toEqual([
    "Bronze might cape",
    "2 Tarn hide + 1 Rope · Needs Leatherworking 5",
  ]);
  expect(line(leather.children[25])).toEqual([
    "Emberite avoidance cape",
    "2 Cinder hide + 1 Rope · Needs Leatherworking 20",
  ]);
  // A Crafting level alone doesn't lift a Leatherworking row.
  patch(me([["tarnHide", 3]], { craftingXp: xpForLevel(99) }));
  expect(line(leather.children[3])).toEqual([
    "Bronze gloves",
    "3 Tarn hide · Needs Leatherworking 5",
  ]);
  patch(me([["tarnHide", 3]], { leatherworkingXp: xpForLevel(5) }));
  expect(line(leather.children[3])).toEqual(["Bronze gloves", "3 Tarn hide"]);
});

test("the anvil's arrowhead and knife rows name the piece alone, and a fletching row opens with the materials held (#228)", () => {
  patch(
    me(
      [
        ["copperBar", 2],
        ["birchLog", 1],
        ["rope", 1],
        ["arrowShaft", 10],
        ["copperArrowhead", 10],
        ["feather", 10],
      ],
      { fletchingXp: xpForLevel(1) },
    ),
  );
  open("anvil");
  expect(line(shownRows()[5])).toEqual(["Arrowhead", "1 bars"]);
  expect(line(shownRows()[6])).toEqual(["Throwing knife", "1 bars"]);
  open("workbench");
  expect(line(shownRows()[4])).toEqual(["Arrow shaft", "1 Log"]);
  expect(line(shownRows()[5])).toEqual([
    "Copper arrow",
    "10 Arrow shaft + 10 Copper arrowhead + 10 Feather",
  ]);
});

test("the furnace folds on Mining, whatever the Smithing level", () => {
  patch(me([], { smithingXp: xpForLevel(50), miningXp: xpForLevel(15) }));
  open("furnace");
  expect(headers()).toEqual([
    ["Copper", "", true],
    ["Bronze", "", true],
    ["Iron", "", true],
    ["Steel", "", true],
    ["Emberite", "Mining 20", false],
  ]);
});

test("folding stays as the player left it while open, and starts over at the next opening", () => {
  open("anvil");
  const [copper, bronze] = sections();
  copper.open = false;
  bronze.open = true;
  patch(me([["copperBar", 3]], { smithingXp: xpForLevel(5) }));
  expect(headers().slice(0, 2)).toEqual([
    ["Copper", "", false],
    ["Bronze", "", true],
  ]);
  open("anvil");
  expect(headers().slice(0, 3)).toEqual([
    ["Copper", "", true],
    ["Bronze", "", true],
    ["Iron", "Smithing 10", false],
  ]);
});

test("the Emberite rows show both materials, greyed until the player qualifies", () => {
  const held: [string, number][] = [
    ["emberiteBar", 3],
    ["emberbone", 1],
  ];
  patch(me(held, { smithingXp: xpForLevel(19) }));
  open("anvil");
  const sword = shownRows()[28];
  expect(line(sword)).toEqual([
    "Sword",
    "3 bars + 2 Emberbone · Needs Smithing 20",
  ]);
  expect(tipOf(sword)).toBe(
    [
      "Emberite sword",
      "Weapon, needs Combat 20",
      "Adds 300 to your minimum and maximum hit.",
      "3 Emberite bar (have 3), 2 Emberbone (have 1)",
      "108 Smithing experience",
      "Needs Smithing 20",
    ].join("\n"),
  );
  expect(buttons(sword).every(off)).toBe(true);

  patch(me(held, { smithingXp: xpForLevel(20) }));
  expect(tipOf(sword)).toContain("Not enough materials");

  patch(me([held[0]!, ["emberbone", 2]], { smithingXp: xpForLevel(20) }));
  expect(sword.className).toBe("");
  expect(buttons(sword).every((b: any) => !off(b))).toBe(true);
  expect(shownRows()[29].className).toBe("cant");
});

test("a row shows its icon, piece and short cost, with the full cost and experience in its tooltip", () => {
  patch(
    me([
      ["copperBar", 2],
      ["copperBar", 3],
    ]),
  );
  open("anvil");
  const [sword] = shownRows();
  expect(sword.children[0].src).toBe("/icons/copperSword.png");
  expect(line(sword)).toEqual(["Sword", "3 bars"]);
  expect(tipOf(sword)).toBe(
    [
      "Copper sword",
      "Weapon, needs Combat 1",
      "Adds 100 to your minimum and maximum hit.",
      "3 Copper bar (have 5)",
      "18 Smithing experience",
    ].join("\n"),
  );
  expect(sword.className).toBe("");
  expect(buttons(sword).map((b: any) => b.textContent)).toEqual([
    "Make 1",
    "Make all",
  ]);
  expect(buttons(sword).every((b: any) => !off(b))).toBe(true);
});

test("a row that can't be made is greyed with the reason, and its buttons are off", () => {
  patch(me([["ironBar", 20]], { smithingXp: xpForLevel(9) }));
  open("anvil");
  const iron = shownRows()[14];
  expect(iron.className).toBe("cant");
  expect(tipOf(iron)).toContain("Needs Smithing 10");
  expect(buttons(iron).every(off)).toBe(true);
});

test("an off button sends nothing when clicked", () => {
  open("anvil");
  const [sword] = shownRows();
  buttons(sword).forEach((b: any) => b.onclick());
  expect(send).not.toHaveBeenCalled();
});

test("having too few materials greys a row too", () => {
  open("anvil");
  const [sword] = shownRows();
  expect(sword.className).toBe("cant");
  expect(tipOf(sword)).toContain("Not enough materials");
});

test("an open panel follows the patches", () => {
  open("furnace");
  const [bar] = shownRows();
  expect(bar.className).toBe("cant");
  patch(me([["copperOre", 1]]));
  expect(shownRows()[0]).toBe(bar);
  expect(bar.className).toBe("");
  expect(tipOf(bar)).toContain("1 Copper ore (have 1)");
});

test("a row opens right away, with no patch in between", () => {
  current = me([["copperOre", 4]]);
  open("furnace");
  expect(tipOf(shownRows()[0])).toContain("1 Copper ore (have 4)");
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
  expect(tipOf(bar)).toContain("1 Copper ore (have 0)");
  expect(tipOf(bar)).toContain("Not enough materials");
  expect(buttons(bar).every(off)).toBe(true);
});

test("a level gained while it's open lifts that row's level reason", () => {
  patch(me([["ironBar", 3]], { smithingXp: xpForLevel(9) }));
  open("anvil");
  const iron = shownRows()[14];
  expect(tipOf(iron)).toContain("Needs Smithing 10");
  patch(me([["ironBar", 3]], { smithingXp: xpForLevel(10) }));
  expect(iron.className).toBe("");
  expect(tipOf(iron)).not.toContain("Needs Smithing 10");
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
  expect(line(iron)).toEqual(["Iron bar", "1 Iron ore · Needs Mining 10"]);
  expect(tipOf(iron)).toContain("Needs Mining 10");
  expect(buttons(iron).every(off)).toBe(true);

  patch(me([["ironOre", 1]], { smithingXp: 0, miningXp: xpForLevel(10) }));
  expect(iron.className).toBe("");
  expect(tipOf(iron)).not.toContain("Needs Mining 10");
  expect(buttons(iron).every((b: any) => !off(b))).toBe(true);
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
    expect(shownRows()).toHaveLength(45);
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
    ["death", () => patch(me([], { ...far, dead: true }))],
  ])("%s cancels it, so it never opens later", (_, cancel) => {
    walkingToAnvil();
    cancel();
    patch(me([], { x: 7, y: 1 }));
    expect(panel().hidden).toBe(true);
  });

  test("a press on another open panel cancels it too", () => {
    const other = element() as unknown as HTMLElement;
    const placed = addPanel(other, () => {});
    placed.opened();
    walkingToAnvil();
    listeners.get("pointerdown")!({ target: other });
    placed.closed();
    patch(me([], { x: 7, y: 1 }));
    expect(panel().hidden).toBe(true);
  });

  test("opens only once, so closing it next to the station stays closed", () => {
    walkingToAnvil();
    patch(me([], { x: 7, y: 1 }));
    byId.get("smithing-close")!.onclick!();
    patch(me([], { x: 7, y: 1 }));
    expect(panel().hidden).toBe(true);
  });
});

test("a press anywhere, inside or out, leaves it open", () => {
  open("furnace");
  listeners.get("pointerdown")!({ target: panel() });
  listeners.get("pointerdown")!({ target: element() });
  expect(panel().hidden).toBe(false);
});

test("walking out of reach of the station closes it, and coming back doesn't reopen it", () => {
  open("anvil");
  patch(me([], { x: 7, y: 2 }));
  expect(panel().hidden).toBe(false);
  patch(me([], { x: 8, y: 1 }));
  expect(panel().hidden).toBe(true);
  patch(me([], { x: 7, y: 1 }));
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

test("a fire burning out closes its panel, and cancels a walk to it", () => {
  fires.add("5,2");
  open("fire", { x: 5, y: 2 });
  patch(current);
  expect(panel().hidden).toBe(false);
  fires.delete("5,2");
  patch(current);
  expect(panel().hidden).toBe(true);

  fires.add("9,1");
  open("fire", { x: 9, y: 1 });
  fires.delete("9,1");
  patch(current);
  patch(me([], { x: 8, y: 1 }));
  expect(panel().hidden).toBe(true);
});
