import { EMPTY_SLOT, INVENTORY_SLOTS } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import type { WorldConnection } from "./players.ts";

const element = () => ({ append() {}, replaceChildren() {} });
const slotsBox = { ...element(), replaceChildren: vi.fn() };
vi.stubGlobal("document", {
  getElementById: (id: string) => (id === "slots" ? slotsBox : element()),
  createElement: element,
});
// After the stub, since the module looks up the chat box as it loads.
const { revealPick, showBottomBar } = await import("./bottomBar.ts");

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

const stateWith = (...food: string[]) => ({
  players: new Map([
    [
      "me",
      {
        health: 10,
        maxHealth: 10,
        combatXp: 0,
        defenseXp: 0,
        foragingXp: 0,
        hitpointsXp: 0,
        inventory: [
          ...food,
          ...Array<string>(INVENTORY_SLOTS - food.length).fill(EMPTY_SLOT),
        ],
      },
    ],
  ]),
});

let room: ReturnType<typeof fakeRoom>;
const fakeRoom = () => ({
  sessionId: "me",
  onMessage() {},
  onReconnect: signal<[]>(),
  onStateChange: signal<[ReturnType<typeof stateWith>]>(),
});
const shownFood = () =>
  (slotsBox.replaceChildren.mock.lastCall as { textContent: string }[])[0]!
    .textContent;

beforeEach(() => {
  room = fakeRoom();
  showBottomBar(room as unknown as WorldConnection, () => {});
  room.onStateChange.invoke(stateWith());
});

test("a pick's food stays hidden until its clip reveals it", () => {
  room.onStateChange.invoke(stateWith("berry"));
  expect(shownFood()).toBe("");
  revealPick();
  expect(shownFood()).toBe("berry");
});

test("food a reconnect's state brings shows with no pick event to reveal it", () => {
  room.onReconnect.invoke();
  room.onStateChange.invoke(stateWith("berry"));
  expect(shownFood()).toBe("berry");
  room.onStateChange.invoke(stateWith());
  expect(shownFood()).toBe("");
});

test("a reconnect shows a pick already held when the connection dropped", () => {
  room.onStateChange.invoke(stateWith("berry"));
  room.onReconnect.invoke();
  room.onStateChange.invoke(stateWith("berry"));
  expect(shownFood()).toBe("berry");
});
