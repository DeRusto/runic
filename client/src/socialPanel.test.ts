import {
  CHAT,
  FRIENDS_LIST,
  IGNORE_LIST,
  LIST_FRIENDS_INTENT,
  LIST_IGNORES_INTENT,
  type Friend,
} from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import type { WorldConnection } from "./players.ts";
import { showSocialPanel } from "./socialPanel.ts";

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
  send: ReturnType<typeof vi.fn>;
  messages: Map<string, (payload: any) => void>;
  onMessage: (type: string, handler: (payload: any) => void) => void;
  leave: () => void;
  onLeave: (handler: () => void) => void;
  onReconnect: (handler: () => void) => void;
  reconnect: () => void;
};
const isOpen = () => !el("social").hidden;
const sendFriends = (friends: Friend[]) =>
  room.messages.get(FRIENDS_LIST)!(friends);
/** Each row's text is the name, then its status. */
const rows = () =>
  el("friends").children.map((row) =>
    row.children.map((cell: { textContent: string }) => cell.textContent),
  );

beforeEach(() => {
  byId = new Map();
  keyListeners = [];
  let leave = () => {};
  let reconnect = () => {};
  room = {
    send: vi.fn(),
    messages: new Map(),
    onMessage(type, handler) {
      this.messages.set(type, handler);
    },
    onLeave: (handler) => (leave = handler),
    onReconnect: (handler) => (reconnect = handler),
    leave: () => leave(),
    reconnect: () => reconnect(),
  };
  showSocialPanel(room as unknown as WorldConnection);
});

test("asks for the friends list once it listens for it", () => {
  expect(room.messages.has(FRIENDS_LIST)).toBe(true);
  expect(room.send).toHaveBeenCalledWith(LIST_FRIENDS_INTENT);
});

test("asks for both lists again after a reconnect", () => {
  room.send.mockClear();
  room.reconnect();
  expect(room.send).toHaveBeenCalledWith(LIST_FRIENDS_INTENT);
  expect(room.send).toHaveBeenCalledWith(LIST_IGNORES_INTENT);
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

test("opens and closes from its button and with O", () => {
  expect(isOpen()).toBe(false);
  el("social-button").onclick!();
  expect(isOpen()).toBe(true);
  expect(el("social-button").attributes["aria-pressed"]).toBe("true");
  el("social-button").onclick!();
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

test("asks for the ignore list, and lists names only", () => {
  expect(room.send).toHaveBeenCalledWith(LIST_IGNORES_INTENT);
  room.messages.get(IGNORE_LIST)!(["Ada", "Bo"]);
  expect(
    el("ignores").children.map((row) => row.children[0].textContent),
  ).toEqual(["Ada", "Bo"]);
});

test("unignoring from the panel sends the same command as typing it", () => {
  room.messages.get(IGNORE_LIST)!(["Ada"]);
  el("ignores").children[0].children[1].onclick();
  expect(room.send).toHaveBeenCalledWith(CHAT, "/unignore Ada");
});

test("the tabs show one list at a time", () => {
  el("social-tab-ignores").onclick!();
  expect(el("social-friends").hidden).toBe(true);
  expect(el("social-ignores").hidden).toBe(false);
  expect(el("social-tab-ignores").attributes["aria-selected"]).toBe("true");
  el("social-tab-friends").onclick!();
  expect(el("social-friends").hidden).toBe(false);
  expect(el("social-ignores").hidden).toBe(true);
});
