import {
  DROP_INTENT,
  EAT_INTENT,
  EMPTY_SLOT,
  EQUIP_INTENT,
  INVENTORY_SLOTS,
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
  style: {} as Record<string, string>,
  hidden: false,
  textContent: "",
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
const fakeDocument = {
  getElementById: (id: string) =>
    id === "chat-lines"
      ? chatLines
      : id === "slots"
        ? slotsBox
        : id === "slot-menu"
          ? menu
          : id === "skills"
            ? skillsBox
            : element(),
  createElement: element,
  onpointerdown: undefined as undefined | ((event: unknown) => void),
};
vi.stubGlobal("document", fakeDocument);
vi.stubGlobal("innerHeight", 700);
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
  "Foraging",
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
        foragingXp: 0,
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
  test("shows its item's icon, with its name as a tooltip and no text", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 2]));
    nextFrame();
    expect(slot().style.backgroundImage).toBe('url("/icons/copperOre.png")');
    expect((slot() as unknown as { title: string }).title).toBe("Copper ore");
    expect(slot().textContent).toBe("");
  });

  test("loses both when it empties", () => {
    room.onStateChange.invoke(stateHolding(["copperOre", 2]));
    nextFrame();
    room.onStateChange.invoke(stateHolding());
    nextFrame();
    expect(slot().style.backgroundImage).toBe("");
    expect((slot() as unknown as { title: string }).title).toBe("");
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
    expect((slot(0) as unknown as { title: string }).title).toBe(
      "Iron sword. You need Combat 10 to equip this.",
    );
    const state = stateHolding(["ironSword", 1]);
    state.players.get("me")!.combatXp = LEVEL_10_XP;
    room.onStateChange.invoke(state);
    nextFrame();
    expect(slot(0).dataset.locked).toBe("false");
    expect((slot(0) as unknown as { title: string }).title).toBe("Iron sword");
  });
});

describe("the right-click menu", () => {
  beforeEach(() => {
    room.onStateChange.invoke(
      stateHolding(["berry", 5], ["copperOre", 3], ["herb", 1]),
    );
    nextFrame();
  });

  test("offers Eat and Drop on food", () => {
    rightClick(0);
    expect(menu.hidden).toBe(false);
    expect(menuChoices()).toEqual(["Eat", "Drop"]);
  });

  test("offers only Drop on a material, whose slot can still catch the click", () => {
    expect((slot(1) as unknown as { disabled: boolean }).disabled).toBe(false);
    rightClick(1);
    expect(menu.hidden).toBe(false);
    expect(menuChoices()).toEqual(["Drop"]);
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

  test("Drop drops the slot clicked, and closes", () => {
    rightClick(1);
    menu.children[0]!.onclick!();
    expect(room.send).toHaveBeenCalledWith(DROP_INTENT, 1);
    expect(menu.hidden).toBe(true);
  });

  test("clicking anywhere else closes it, and clicking inside doesn't", () => {
    rightClick(0);
    fakeDocument.onpointerdown!({ target: "inside" });
    expect(menu.hidden).toBe(false);
    fakeDocument.onpointerdown!({ target: "outside" });
    expect(menu.hidden).toBe(true);
  });
});

test("a private line from the server prints as it came, with nothing overhead", () => {
  const said = vi.fn();
  showBottomBar(room as unknown as WorldConnection, said);
  chatLines.children = [];
  room.messages.get(PRIVATE_LINE)!("From Ada: hi");
  expect(chatLines.children.map((line) => line.textContent)).toEqual([
    "From Ada: hi",
  ]);
  expect(said).not.toHaveBeenCalled();
});
