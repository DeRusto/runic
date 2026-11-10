import { FRIENDS, type Friend } from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import type { WorldConnection } from "./players.ts";
import { showSocialPanel } from "./socialPanel.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);

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
  send: ReturnType<typeof vi.fn>;
  messages: Map<string, (payload: any) => void>;
  onMessage: (type: string, handler: (payload: any) => void) => void;
  leave: () => void;
  onLeave: (handler: () => void) => void;
  onReconnect: (handler: () => void) => void;
};
const isOpen = () => !el("social").hidden;
const sendFriends = (friends: Friend[]) => room.messages.get(FRIENDS)!(friends);
/** Each row's text is the name, then its status. */
const rows = () =>
  el("friends").children.map((row) =>
    row.children.map((cell: { textContent: string }) => cell.textContent),
  );

beforeEach(() => {
  byId = new Map();
  keyListeners = [];
  let leave = () => {};
  room = {
    send: vi.fn(),
    messages: new Map(),
    onMessage(type, handler) {
      this.messages.set(type, handler);
    },
    onLeave: (handler) => (leave = handler),
    onReconnect() {},
    leave: () => leave(),
  };
  showSocialPanel(room as unknown as WorldConnection);
});

test("asks for the friends list once it listens for it", () => {
  expect(room.messages.has(FRIENDS)).toBe(true);
  expect(room.send).toHaveBeenCalledWith(FRIENDS);
});

test("lists each friend with whether they are online", () => {
  sendFriends([
    { username: "Ada", online: true },
    { username: "Bo", online: false },
  ]);
  expect(rows()).toEqual([
    ["Ada", "Online"],
    ["Bo", "Offline"],
  ]);
  expect(el("friends").children[0].dataset.online).toBe("true");
  sendFriends([]);
  expect(rows()).toEqual([]);
});

test("opens from its button and from O, and closes with Escape", () => {
  expect(isOpen()).toBe(false);
  el("social-button").onclick!();
  expect(isOpen()).toBe(true);
  expect(el("social-button").attributes["aria-pressed"]).toBe("true");
  press("Escape");
  expect(isOpen()).toBe(false);
  press("o");
  expect(isOpen()).toBe(true);
  press("O");
  expect(isOpen()).toBe(false);
  el("social-button").onclick!();
  el("social-close").onclick!();
  expect(isOpen()).toBe(false);
});

test("O typed in chat, or with a modifier, does nothing", () => {
  press("o", { target: new FakeInput() });
  press("o", { ctrlKey: true });
  expect(isOpen()).toBe(false);
});

test("C belongs to the character sheet", () => {
  press("c");
  expect(isOpen()).toBe(false);
});

test("leaving the world stops the O key", () => {
  room.leave();
  press("o");
  expect(isOpen()).toBe(false);
});
