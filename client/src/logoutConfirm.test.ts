import { LOGOUT_INTENT } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import { showLogoutConfirm } from "./logoutConfirm.ts";
import type { WorldConnection } from "./players.ts";

const element = () => ({
  hidden: false,
  onclick: undefined as undefined | (() => void),
  focus: vi.fn(),
});

let byId: Map<string, ReturnType<typeof element>>;
const el = (id: string) => {
  if (!byId.has(id)) byId.set(id, element());
  return byId.get(id)!;
};
let keyListeners: ((event: unknown) => void)[];
vi.stubGlobal("HTMLInputElement", class {});
vi.stubGlobal("document", {
  getElementById: el,
  addEventListener: (type: string, listener: (event: unknown) => void) =>
    type === "keydown" && keyListeners.push(listener),
  removeEventListener: (type: string, listener: (event: unknown) => void) =>
    (keyListeners = keyListeners.filter((other) => other !== listener)),
});

/** Presses a key and says whether the box kept it from the panels. */
const press = (key: string, target: unknown = {}) => {
  const stopPropagation = vi.fn();
  keyListeners.forEach((listener) =>
    listener({ key, target, stopPropagation }),
  );
  return stopPropagation.mock.calls.length > 0;
};

let room: { send: ReturnType<typeof vi.fn>; leave: () => void };

beforeEach(() => {
  byId = new Map();
  keyListeners = [];
  let leave = () => {};
  room = {
    send: vi.fn(),
    leave: () => leave(),
  };
  showLogoutConfirm({
    send: room.send,
    onLeave: (handler: () => void) => (leave = handler),
  } as unknown as WorldConnection);
});

const box = () => el("logout-confirm");

test("Log out asks first, and only the box's Log out sends the intent", () => {
  expect(box().hidden).toBe(true);
  el("logout").onclick!();
  expect(box().hidden).toBe(false);
  expect(room.send).not.toHaveBeenCalled();

  el("logout-confirm-yes").onclick!();
  expect(room.send).toHaveBeenCalledExactlyOnceWith(LOGOUT_INTENT);
  expect(box().hidden).toBe(true);
});

test.each([
  ["Cancel", () => el("logout-confirm-no").onclick!()],
  ["Escape", () => press("Escape")],
  ["a second click on Log out", () => el("logout").onclick!()],
])("%s closes the box without logging out", (_, close) => {
  el("logout").onclick!();
  close();
  expect(box().hidden).toBe(true);
  expect(room.send).not.toHaveBeenCalled();
});

test("Escape closes the box before any panel, and reaches the panels once it is shut", () => {
  el("logout").onclick!();
  expect(press("Escape")).toBe(true);
  expect(press("Escape")).toBe(false);
});

test("leaving the room shuts the box and stops listening", () => {
  el("logout").onclick!();
  room.leave();
  expect(box().hidden).toBe(true);
  expect(keyListeners).toHaveLength(0);
});

test("Escape typed in the chat box leaves the box open", () => {
  el("logout").onclick!();
  expect(press("Escape", new HTMLInputElement())).toBe(false);
  expect(box().hidden).toBe(false);
});
