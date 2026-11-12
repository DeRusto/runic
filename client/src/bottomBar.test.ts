import {
  CHAT,
  DROP_INTENT,
  EAT_INTENT,
  EMPTY_SLOT,
  EQUIP_INTENT,
  MIX_INTENT,
  INVENTORY_SLOTS,
  MAX_XP,
  MOVE_INTENT,
  PRIVATE_LINE,
} from "@runic/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WorldConnection } from "./players.ts";

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  replaceChildren(...children: any[]) {
    this.children = children;
  },
  setAttribute() {},
  contains: (other: unknown) => other === "inside",
  focus() {},
  children: [] as any[],
  dataset: {} as Record<string, string>,
  // The methods sit on the prototype, so a style still equals a plain object of its properties.
  style: Object.create({
    setProperty(this: Record<string, string>, name: string, value: string) {
      this[name] = value;
    },
    getPropertyValue(this: Record<string, string>, name: string) {
      return this[name] ?? "";
    },
  }),
  classList: { toggle() {} },
  querySelector: () => ({ setPointerCapture() {} }),
  hidden: false,
  textContent: "",
  offsetWidth: 100,
  offsetHeight: 20,
  onclick: undefined as undefined | (() => void),
  oncontextmenu: undefined as undefined | ((event: unknown) => void),
  get firstElementChild() {
    return this.children[0];
  },
});
const slotsBox = element();
const menu = element();
const skillsBox = element();
const chatLines = element();
const tip = element();
const fakeDocument = {
  getElementById: (id: string) =>
    id === "chat-lines"
      ? chatLines
      : id === "tooltip"
        ? tip
        : id === "slots"
          ? slotsBox
          : id === "slot-menu"
            ? menu
            : id === "skills"
              ? skillsBox
              : element(),
  createElement: (tagName: string) => Object.assign(element(), { tagName }),
  onpointerdown: undefined as undefined | ((event: unknown) => void),
};
vi.stubGlobal("document", fakeDocument);
vi.stubGlobal("innerHeight", 700);
vi.stubGlobal("innerWidth", 1000);
let frames: (() => void)[] = [];
vi.stubGlobal("requestAnimationFrame", (draw: () => void) => frames.push(draw));
vi.stubGlobal("cancelAnimationFrame", () => (frames = []));
/** The next paint. The server sends a tick's events right after its patch, so both come before it. */
const nextFrame = () => frames.splice(0).forEach((draw) => draw());
// After the stub, since the module looks up the chat box as it loads.
const { holdResult, revealResult, showBottomBar } =
  await import("./bottomBar.ts");

function signal<Args extends unknown[]>() {
  let handlers: ((...args: Args) => void)[] = [];
  const add = (handler: (...args: Args) => void) => void handlers.push(handler);
  return Object.assign(add, {
    invoke: (...args: Args) => handlers.forEach((h) => h(...args)),
    once: (handler: (...args: Args) => void) => {
      const wrapper = (...args: Args) => {
        handlers = handlers.filter((h) => h !== wrapper);
        handler(...args);
      };
      handlers.push(wrapper);
    },
  });
}

const TODAY = [
  "Combat",
  "Defense",
  "Herblaw",
  "Hitpoints",
  "Mining",
  "Smithing",
];

/** Our player, holding these [item, count] stacks from slot 0. */
const stateHolding = (...stacks: [string, number][]) => ({
  players: new Map([
    [
      "me",
      {
        health: 1000,
        maxHealth: 1000,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 0,
        miningXp: 0,
        smithingXp: 0,
        blockingXp: 0,
        masteryXp: 0,
        pinnedSkills: TODAY,
        tools: [],
        weapon: "",
        shield: "",
        inventory: [
          ...stacks.map(([item]) => item),
          ...Array<string>(INVENTORY_SLOTS - stacks.length).fill(EMPTY_SLOT),
        ],
        inventoryCounts: [
          ...stacks.map(([, count]) => count),
          ...Array<number>(INVENTORY_SLOTS - stacks.length).fill(0),
        ],
      },
    ],
  ]),
});
const stateWith = (...food: string[]) =>
  stateHolding(...food.map((item) => [item, 1] as [string, number]));

let room: ReturnType<typeof fakeRoom>;
const fakeRoom = () => ({
  sessionId: "me",
  messages: new Map<string, (payload: any) => void>(),
  onMessage(type: string, handler: (payload: any) => void) {
    this.messages.set(type, handler);
  },
  send: vi.fn(),
  onReconnect: signal<[]>(),
  onStateChange: signal<[ReturnType<typeof stateWith>]>(),
});
const slot = (i = 0) => slotsBox.children[i]!;
const shownFood = () => slot().dataset.item;
const rightClick = (i = 0) =>
  slot(i).oncontextmenu!({
    preventDefault() {},
    clientX: 50,
    clientY: 600,
  });
const menuChoices = () => menu.children.map((choice) => choice.textContent);
/** Points at a slot, and reads the tooltip it shows: a coloured name as `[quality]name`, or undefined when hidden. */
const pointAt = (i = 0) => {
  slot(i).onpointermove!({ clientX: 50, clientY: 600 });
  return tip.hidden
    ? undefined
    : tip.children
        .map((part) =>
          typeof part === "string"
            ? part
            : `[${part.className}]${part.textContent}`,
        )
        .join("");
};

beforeEach(() => {
  frames = [];
  room = fakeRoom();
  showBottomBar(room as unknown as WorldConnection, () => {});
  room.onStateChange.invoke(stateWith());
  nextFrame();
});

describe("holding a pick's result", () => {
  test("a pick's food stays hidden until its clip reveals it", () => {
    room.onStateChange.invoke(stateWith("berry"));
    holdResult();
    nextFrame();
    expect(shownFood()).toBe("");
    revealResult();
    expect(shownFood()).toBe("berry");
  });

  test("so does food landing on an existing stack, which fills no new slot", () => {
    room.onStateChange.invoke(stateHolding(["berry", 3]));
    nextFrame();
    room.onStateChange.invoke(stateHolding(["berry", 4]));
    holdResult();
    nextFrame();
    expect(slot().dataset.count).toBe("3");
    revealResult();
    expect(slot().dataset.count).toBe("4");
  });

  test("a slot filling with no pick event isn't held", () => {
    room.onStateChange.invoke(stateWith("berry"));
    nextFrame();
    expect(shownFood()).toBe("berry");
  });

  test("patches during the hold don't show until the reveal", () => {
    holdResult();
    room.onStateChange.invoke(stateWith("berry"));
    nextFrame();
    room.onStateChange.invoke(stateWith("berry"));
    nextFrame();
    expect(shownFood()).toBe("");
    revealResult();
    expect(shownFood()).toBe("berry");
  });

  test("food a reconnect's state brings shows with no pick event to reveal it", () => {
    room.onReconnect.invoke();
    room.onStateChange.invoke(stateWith("berry"));
    expect(shownFood()).toBe("berry");
    room.onStateChange.invoke(stateWith());
    nextFrame();
    expect(shownFood()).toBe("");
  });

  test("a reconnect shows a pick already held when the connection dropped", () => {
    room.onStateChange.invoke(stateWith("berry"));
    holdResult();
    room.onReconnect.invoke();
    room.onStateChange.invoke(stateWith("berry"));
    expect(shownFood()).toBe("berry");
  });
});

describe("a filled slot", () => {
  test("shows its item's icon, with its name as a tooltip and label and no text", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 2]));
    nextFrame();
    expect(slot().style.getPropertyValue("--icon")).toBe(
      'url("/icons/copperOre.png")',
    );
    expect(slot().ariaLabel).toBe("Copper ore");
    expect(pointAt()).toBe("[tip-name common]Copper ore[tip-kind]Material");
    expect(slot().textContent).toBe("");
  });

  test("loses them all when it empties", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 2]));
    nextFrame();
    room.onStateChange.invoke(stateHolding());
    nextFrame();
    expect(slot().style.getPropertyValue("--icon")).toBe("");
    expect(slot().ariaLabel).toBe("Empty slot");
    expect(pointAt()).toBe(undefined);
  });

  test("an improved item's tooltip shows its name in its Quality's colour, beside the cursor, until the pointer leaves (spec §5)", () => {
    room.onStateChange.invoke(stateHolding(["copperSword:rare:might", 1]));
    nextFrame();
    expect(pointAt()).toMatch(
      /^\[tip-name rare\]Copper sword of Might\[tip-kind\].*\[tip-stat\]/,
    );
    expect(tip.style).toEqual({ left: "62px", top: "568px" });
    slot().onpointerleave!();
    expect(tip.hidden).toBe(true);
  });

  test("the tooltip flips to the left of the cursor at the window's right edge", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 1]));
    nextFrame();
    slot().onpointermove!({ clientX: 990, clientY: 600 });
    expect(tip.style.left).toBe("878px");
  });

  test("a click hides the tooltip, so it never names what the slot held before", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 1]));
    nextFrame();
    pointAt();
    slot().onpointerdown!();
    expect(tip.hidden).toBe(true);
  });
});

describe("the skills column", () => {
  const statePinning = (...pinnedSkills: string[]) => {
    const state = stateWith();
    Object.assign(state.players.get("me")!, { pinnedSkills });
    return state;
  };
  /** Each row's first child is its "Name level" text. */
  const shown = () =>
    skillsBox.children
      .filter((child) => !child.hidden)
      .map((child) => child.children[0]?.textContent ?? child.textContent);

  test("shows pinned skills in the sheet's order, not the order of pinning", () => {
    room.onStateChange.invoke(statePinning("Smithing", "Blocking", "Combat"));
    nextFrame();
    expect(shown()).toEqual(["Combat 1", "Smithing 1", "Blocking 1"]);
  });

  test("a skill's bar shows its total experience in the tooltip (spec §5)", () => {
    const state = statePinning("Combat");
    state.players.get("me")!.combatXp = 12345;
    room.onStateChange.invoke(state);
    nextFrame();
    const bar = skillsBox.children[0].children.at(-1);
    bar.onpointermove({ clientX: 50, clientY: 600 });
    expect(tip.children).toEqual(["12,345 XP"]);
  });

  test("asks for pins when there are none", () => {
    room.onStateChange.invoke(statePinning());
    nextFrame();
    expect(shown()).toEqual(["Pin skills from the sheet"]);
  });

  test("a pin shows at once, even while a pick's result is held", () => {
    holdResult();
    room.onStateChange.invoke(statePinning("Blocking"));
    expect(shown()).toEqual(["Blocking 1"]);
    revealResult();
  });

  /** The right-hand label over Mining's bar, with this much Mining experience. */
  const nextLevelLabel = (miningXp: number) => {
    const state = statePinning("Mining");
    Object.assign(state.players.get("me")!, { miningXp });
    room.onStateChange.invoke(state);
    nextFrame();
    return skillsBox.children.find((child) => !child.hidden).children[1]
      .textContent;
  };

  test("shows the experience its next level needs, with thousands separated by commas", () => {
    expect(nextLevelLabel(1000)).toBe("250 XP to level 6");
    expect(nextLevelLabel(5050)).toBe("1,000 XP to level 12");
  });

  test("counts the whole level at its first experience", () => {
    expect(nextLevelLabel(5000)).toBe("1,050 XP to level 12");
  });

  test("reads Max level at the max level", () => {
    expect(nextLevelLabel(MAX_XP)).toBe("Max level");
  });
});

describe("a slot's stack count", () => {
  test("shows above 1", () => {
    room.onStateChange.invoke(stateHolding(["berry", 2], ["herb", 20]));
    nextFrame();
    expect(slot(0).dataset.count).toBe("2");
    expect(slot(1).dataset.count).toBe("20");
  });

  test("doesn't show at 1 or on an empty slot", () => {
    room.onStateChange.invoke(stateHolding(["berry", 1]));
    nextFrame();
    expect(slot(0).dataset.count).toBe("");
    expect(slot(1).dataset.count).toBe("");
  });

  test("of coins shows in short form, and the tooltip gives the exact count", () => {
    room.onStateChange.invoke(
      stateHolding(["coins", 999], ["coins", 12_345], ["coins", 3_456_789]),
    );
    nextFrame();
    expect([0, 1, 2].map((i) => slot(i).dataset.count)).toEqual([
      "999",
      "12K",
      "3.4M",
    ]);
    expect(pointAt(2)).toBe("[tip-name common]Coins[tip-kind]3,456,789 coins");
  });
});

test("a left-click eats food, and does nothing on a material", () => {
  room.onStateChange.invoke(stateHolding(["berry", 5], ["copperOre", 3]));
  nextFrame();
  room.send.mockClear();
  slot(1).onclick!();
  expect(room.send).not.toHaveBeenCalled();
  slot(0).onclick!();
  expect(room.send).toHaveBeenCalledWith(EAT_INTENT, 0);
});

describe("gear in the bar", () => {
  const LEVEL_10_XP = 4050;
  beforeEach(() => {
    room.onStateChange.invoke(stateHolding(["ironSword", 1]));
    nextFrame();
    room.send.mockClear();
  });

  test("a left-click equips, even gear above the player's level, so the server can say why not", () => {
    slot(0).onclick!();
    expect(room.send).toHaveBeenCalledWith(EQUIP_INTENT, 0);
  });

  test("a right-click offers Equip and Drop", () => {
    rightClick(0);
    expect(menuChoices()).toEqual(["Equip", "Drop"]);
    menu.children[0].onclick!();
    expect(room.send).toHaveBeenCalledWith(EQUIP_INTENT, 0);
  });

  test("gear they can't wear yet is greyed with the reason, until they can", () => {
    expect(slot(0).dataset.locked).toBe("true");
    expect(slot(0).ariaLabel).toBe(
      "Iron sword. You need Combat 10 to equip this.",
    );
    expect(pointAt(0)).toMatch(
      /\[tip-refusal\]You need Combat 10 to equip this\.$/,
    );
    const state = stateHolding(["ironSword", 1]);
    state.players.get("me")!.combatXp = LEVEL_10_XP;
    room.onStateChange.invoke(state);
    nextFrame();
    expect(slot(0).dataset.locked).toBe("false");
    expect(slot(0).ariaLabel).toBe("Iron sword");
  });
});

test("improved gear equips from the bar like its common form, and names its Virtue", () => {
  room.onStateChange.invoke(stateHolding(["copperSword:uncommon:might", 1]));
  nextFrame();
  room.send.mockClear();
  slot(0).onclick!();
  expect(room.send).toHaveBeenCalledWith(EQUIP_INTENT, 0);
  rightClick(0);
  expect(menuChoices()).toEqual(["Equip", "Drop"]);
  expect(slot(0).ariaLabel).toBe("Copper sword of Might");
});

describe("the right-click menu", () => {
  beforeEach(() => {
    room.onStateChange.invoke(
      stateHolding(["berry", 5], ["copperOre", 3], ["cookedPerch", 1]),
    );
    nextFrame();
  });

  test("offers Eat and each Drop amount on a stack of food", () => {
    rightClick(0);
    expect(menu.hidden).toBe(false);
    expect(menuChoices()).toEqual([
      "Eat",
      "Drop 1",
      "Drop 5",
      "Drop 10",
      "Drop X",
      "Drop All",
    ]);
  });

  test("offers only plain Drop on a lone item", () => {
    rightClick(2);
    expect(menuChoices()).toEqual(["Eat", "Drop"]);
  });

  test("offers only the Drop amounts on a material, whose slot can still catch the click", () => {
    expect(slot(1).ariaDisabled).toBe("false");
    rightClick(1);
    expect(menu.hidden).toBe(false);
    expect(menuChoices()[0]).toBe("Drop 1");
  });

  test("opens nothing on an empty slot", () => {
    menu.hidden = true;
    rightClick(9);
    expect(menu.hidden).toBe(true);
  });

  test("Eat eats from the slot clicked, and closes", () => {
    rightClick(2);
    menu.children[0]!.onclick!();
    expect(room.send).toHaveBeenCalledWith(EAT_INTENT, 2);
    expect(menu.hidden).toBe(true);
  });

  test("a Delicious fish eats like its common form (#221)", () => {
    room.onStateChange.invoke(stateHolding(["cookedTrout:delicious", 1]));
    nextFrame();
    rightClick(0);
    expect(menuChoices()).toEqual(["Eat", "Drop"]);
  });

  test("a potion drinks on a click and from the menu, by the eat flow (#222)", () => {
    room.onStateChange.invoke(stateHolding(["mightPotion", 1]));
    nextFrame();
    slot(0).onclick!();
    expect(room.send).toHaveBeenCalledWith(EAT_INTENT, 0);
    rightClick(0);
    expect(menuChoices()).toEqual(["Drink", "Drop"]);
    menu.children[0]!.onclick!();
    expect(room.send).toHaveBeenCalledWith(EAT_INTENT, 0);
    expect(menu.hidden).toBe(true);
  });

  test("a potion plant offers Mix potion, which sends the plant's slot (#222)", () => {
    room.onStateChange.invoke(stateHolding(["dewpetal", 1]));
    nextFrame();
    rightClick(0);
    expect(menuChoices()).toEqual(["Mix potion", "Drop"]);
    menu.children[0]!.onclick!();
    expect(room.send).toHaveBeenCalledWith(MIX_INTENT, { slot: 0 });
    expect(menu.hidden).toBe(true);
  });

  test("the base herb, which the range cooks, offers no mixing (#222)", () => {
    room.onStateChange.invoke(stateHolding(["herb", 1]));
    nextFrame();
    rightClick(0);
    expect(menuChoices()).toEqual(["Drop"]);
  });

  test.each([
    ["Drop 1", 1],
    ["Drop 5", 5],
    ["Drop 10", 10],
    ["Drop All", 3],
  ])(
    "%s drops that many from the slot clicked, and closes",
    (label, amount) => {
      rightClick(1);
      menu.children.find((choice) => choice.textContent === label)!.onclick!();
      expect(room.send).toHaveBeenCalledWith(DROP_INTENT, { slot: 1, amount });
      expect(menu.hidden).toBe(true);
    },
  );

  test("Drop X asks how many, and sends even more than the stack for the server to cap", () => {
    vi.stubGlobal("prompt", () => "300");
    rightClick(1);
    menu.children.find((choice) => choice.textContent === "Drop X")!.onclick!();
    expect(room.send).toHaveBeenCalledWith(DROP_INTENT, {
      slot: 1,
      amount: 300,
    });
  });

  test.each([[null], [""], ["0"], ["2.5"], ["lots"]])(
    "Drop X answered with %j sends nothing",
    (answer) => {
      vi.stubGlobal("prompt", () => answer);
      room.send.mockClear();
      rightClick(1);
      menu.children.find((choice) => choice.textContent === "Drop X")!
        .onclick!();
      expect(room.send).not.toHaveBeenCalled();
    },
  );

  test("clicking anywhere else closes it, and clicking inside doesn't", () => {
    rightClick(0);
    fakeDocument.onpointerdown!({ target: "inside" });
    expect(menu.hidden).toBe(false);
    fakeDocument.onpointerdown!({ target: "outside" });
    expect(menu.hidden).toBe(true);
  });
});

describe("dragging", () => {
  beforeEach(() => {
    room.onStateChange.invoke(stateHolding(["berry", 5], ["copperOre", 3]));
    nextFrame();
  });

  const drag = (from: number, to: number) => {
    slot(from).ondragstart!({});
    slot(to).ondragover!({ preventDefault() {} });
    slot(to).ondrop!({ preventDefault() {} });
    slot(from).ondragend!();
  };

  test("only a filled slot can be dragged", () => {
    expect(slot(0).draggable).toBe(true);
    expect(slot(5).draggable).toBe(false);
  });

  test("a slot dropped onto another, empty or not, asks the server to move it", () => {
    drag(0, 7);
    expect(room.send).toHaveBeenCalledWith(MOVE_INTENT, { from: 0, to: 7 });
    drag(1, 0);
    expect(room.send).toHaveBeenCalledWith(MOVE_INTENT, { from: 1, to: 0 });
  });

  test("dropping a slot back onto itself, or something from outside, sends nothing", () => {
    room.send.mockClear();
    drag(0, 0);
    slot(3).ondrop!({ preventDefault() {} });
    expect(room.send).not.toHaveBeenCalled();
  });
});

test("a private line from the server prints as it came, with nothing overhead", () => {
  const said = vi.fn();
  showBottomBar(room as unknown as WorldConnection, said);
  chatLines.children = [];
  room.messages.get(PRIVATE_LINE)!("From Ada: hi");
  expect(chatLines.children.map((line) => line.children.join(""))).toEqual([
    "From Ada: hi",
  ]);
  expect(said).not.toHaveBeenCalled();
});

test("public chat prints with a colon and says the text overhead", () => {
  const said = vi.fn();
  showBottomBar(room as unknown as WorldConnection, said);
  chatLines.children = [];
  room.messages.get(CHAT)!({
    id: "ada",
    username: "Ada",
    text: "hi",
    emote: false,
  });
  expect(chatLines.children.map((line) => line.children.join(""))).toEqual([
    "Ada: hi",
  ]);
  expect(said).toHaveBeenCalledWith("ada", "hi");
});

test("an emote prints bold as the name then the text, and says the text alone overhead", () => {
  const said = vi.fn();
  showBottomBar(room as unknown as WorldConnection, said);
  chatLines.children = [];
  room.messages.get(CHAT)!({
    id: "ada",
    username: "DeRusto",
    text: "dances",
    emote: true,
  });
  const [bold] = chatLines.children[0].children;
  expect(bold.tagName).toBe("b");
  expect(bold.textContent).toBe("DeRusto dances");
  expect(said).toHaveBeenCalledWith("ada", "dances");
});
