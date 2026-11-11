import { TAKE_INTENT, WALK_INTENT } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { addPanel } from "./panels.ts";
import { showPileWindow } from "./pileWindow.ts";
import type { WorldConnection } from "./players.ts";

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  replaceChildren(...children: any[]) {
    this.children = children;
  },
  remove() {
    removed.push(this);
  },
  contains(other: unknown): boolean {
    return (
      other === this || this.children.some((child) => child.contains?.(other))
    );
  },
  children: [] as any[],
  style: {} as Record<string, string>,
  classList: { toggle() {} },
  querySelector: () => ({ setPointerCapture() {} }),
  hidden: false,
  textContent: "",
  type: "",
  onclick: undefined as undefined | (() => void),
});

vi.stubGlobal("innerWidth", 1000);
vi.stubGlobal("innerHeight", 700);

let byId: Map<string, ReturnType<typeof element>>;
let listeners: Map<string, (event: any) => void>;
let removed: unknown[];
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

type Seen = { item: string; count: number; owner: string; x: number };
const ore: Seen = { item: "copperOre", count: 12, owner: "", x: 3 };
const sword: Seen = { item: "copperSword", count: 1, owner: "", x: 3 };
const elsewhere: Seen = { item: "tinOre", count: 1, owner: "", x: 9 };

const send = vi.fn();
let onState: (state: unknown) => void;
let leave: () => void;
let state: { players: Map<string, any>; groundItems?: Map<string, any> };
let open: ReturnType<typeof showPileWindow>;

const pile = () => byId.get("pile")!;
const rows = () =>
  byId.get("pile-rows")!.children.filter((row) => !removed.includes(row));
const texts = () => rows().map((row) => row.textContent);
/** A patch with the player at (`x`, 1) and these ground items, all on row 1. */
const patch = (
  x: number,
  items: Record<string, Seen> | undefined,
  more = {},
) => {
  state = {
    players: new Map([
      ["a", { x, y: 1, dead: false, username: "alice", ...more }],
    ]),
    groundItems:
      items &&
      new Map(
        Object.entries(items).map(([id, item]) => [id, { ...item, y: 1 }]),
      ),
  };
  onState(state);
};

beforeEach(() => {
  byId = new Map();
  listeners = new Map();
  removed = [];
  send.mockClear();
  open = showPileWindow({
    sessionId: "a",
    send,
    get state() {
      return state;
    },
    onStateChange: (handler: typeof onState) => (onState = handler),
    onLeave: (handler: typeof leave) => (leave = handler),
  } as unknown as WorldConnection);
  patch(3, { o: ore, s: sword, e: elsewhere });
});

test("on the pile's tile, opens at once listing only that tile's ground items", () => {
  expect(pile().hidden).toBe(true);
  open({ x: 3, y: 1 });
  expect(pile().hidden).toBe(false);
  expect(texts()).toEqual(["Copper ore (12)", "Copper sword (1)"]);
  expect(send).not.toHaveBeenCalled();
});

test("from afar, walks onto the tile and opens on arrival", () => {
  patch(6, { o: ore, s: sword });
  open({ x: 3, y: 1 });
  expect(send.mock.calls).toEqual([[WALK_INTENT, { x: 3, y: 1 }]]);
  expect(pile().hidden).toBe(true);
  patch(4, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
  patch(3, { o: ore, s: sword });
  expect(pile().hidden).toBe(false);
  expect(texts()).toEqual(["Copper ore (12)", "Copper sword (1)"]);
});

test("clicking a row takes exactly that ground item and leaves the window open", () => {
  open({ x: 3, y: 1 });
  rows()[1].onclick();
  expect(send.mock.calls).toEqual([[TAKE_INTENT, "s"]]);
  expect(pile().hidden).toBe(false);
});

test("rows follow the patches in place: taken ones vanish, counts shrink, new ones appear", () => {
  open({ x: 3, y: 1 });
  const [oreRow] = rows();
  patch(3, {
    o: { ...ore, count: 5 },
    s: sword,
    n: { ...ore, owner: "alice" },
  });
  expect(rows()[0]).toBe(oreRow);
  expect(texts()).toEqual([
    "Copper ore (5)",
    "Copper sword (1)",
    "Copper ore (12) · yours for now",
  ]);
  patch(3, { s: sword });
  expect(texts()).toEqual(["Copper sword (1)"]);
  expect(pile().hidden).toBe(false);
});

test("the pile emptying closes it", () => {
  open({ x: 3, y: 1 });
  patch(3, { e: elsewhere });
  expect(pile().hidden).toBe(true);
  patch(3, undefined);
  expect(pile().hidden).toBe(true);
});

test("walking off the tile closes it, and coming back doesn't reopen it", () => {
  open({ x: 3, y: 1 });
  patch(4, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
  patch(3, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
});

test.each([
  ["its X", () => byId.get("pile-close")!.onclick!()],
  ["death", () => patch(3, { o: ore, s: sword }, { dead: true })],
])("%s closes it", (_, close) => {
  open({ x: 3, y: 1 });
  close();
  expect(pile().hidden).toBe(true);
});

test("a press anywhere, inside or out, leaves it open", () => {
  open({ x: 3, y: 1 });
  listeners.get("pointerdown")!({ target: pile() });
  listeners.get("pointerdown")!({ target: element() });
  expect(pile().hidden).toBe(false);
});

test("pressing a row doesn't close it", () => {
  open({ x: 3, y: 1 });
  // In the page, the row list sits inside the window.
  pile().children.push(byId.get("pile-rows")!);
  listeners.get("pointerdown")!({ target: rows()[0] });
  expect(pile().hidden).toBe(false);
});

test("a press elsewhere on the way cancels it, so it never opens on arrival", () => {
  patch(6, { o: ore, s: sword });
  open({ x: 3, y: 1 });
  listeners.get("pointerdown")!({ target: element() });
  patch(3, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
});

test("a press on another open panel on the way cancels it too", () => {
  const other = element() as unknown as HTMLElement;
  const placed = addPanel(other, () => {});
  placed.opened();
  patch(6, { o: ore, s: sword });
  open({ x: 3, y: 1 });
  listeners.get("pointerdown")!({ target: other });
  placed.closed();
  patch(3, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
});

test("a walk that stops short forgets the pile, so standing on it later doesn't open it", () => {
  patch(6, { o: ore, s: sword });
  open({ x: 3, y: 1 });
  patch(5, { o: ore, s: sword }, { action: "walking" });
  patch(5, { o: ore, s: sword }, { action: "" });
  patch(3, { o: ore, s: sword });
  expect(pile().hidden).toBe(true);
});

test("leaving the room closes it and lets go of the page", () => {
  open({ x: 3, y: 1 });
  leave();
  expect(pile().hidden).toBe(true);
  expect(listeners.size).toBe(0);
});
