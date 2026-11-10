import {
  CHAT,
  MAX_CHAT_LINE_LENGTH,
  STARTING_HITPOINTS_XP,
} from "@runic/shared";
import { beforeEach, expect, test, vi } from "vitest";
import type { WorldConnection } from "./players.ts";

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  children: [] as any[],
  scrollTop: 0,
  scrollHeight: 0,
  childElementCount: 0,
  textContent: "",
  value: "",
  maxLength: 0,
  focus: vi.fn(),
});
const chatLines = element();
const chatInput = element();
vi.stubGlobal("document", {
  getElementById: (id: string) =>
    id === "chat-lines" ? chatLines : id === "chat-input" ? chatInput : null,
  createElement: element,
});
// After the stub, since printChatLine's module looks up the chat box as it loads.
const { playerMenuChoices } = await import("./playerMenu.ts");

const send = vi.fn();
const room = {
  send,
  state: {
    players: new Map([
      ["ada", { username: "Ada", hitpointsXp: STARTING_HITPOINTS_XP }],
    ]),
  },
} as unknown as WorldConnection;
const choose = (label: string) =>
  playerMenuChoices(room, "ada").find(([option]) => option === label)![1]();
const printed = () => chatLines.children.map((line) => line.textContent);

beforeEach(() => {
  chatLines.children = [];
  send.mockClear();
});

test("the menu offers Trade, Follow, Attack, Examine, Message and Duel in that order", () => {
  expect(playerMenuChoices(room, "ada").map(([label]) => label)).toEqual([
    "Trade",
    "Follow",
    "Attack",
    "Examine",
    "Message",
    "Duel",
  ]);
});

test("Follow sends the same /follow as typing it, so the server decides", () => {
  choose("Follow");
  expect(send).toHaveBeenCalledWith(CHAT, "/follow Ada");
});

test("Trade, Attack and Duel each refuse with a private line and send nothing", () => {
  choose("Trade");
  choose("Attack");
  choose("Duel");
  expect(printed()).toEqual([
    "Trading isn't here yet.",
    "You can't attack here.",
    "Duelling isn't here yet.",
  ]);
  expect(send).not.toHaveBeenCalled();
});

test("Examine prints the player's name and combat level", () => {
  choose("Examine");
  expect(printed()).toEqual(["Ada, combat level 3"]);
});

test("Message prefills /pm and the name in the chat input, ready to type", () => {
  choose("Message");
  expect(chatInput.value).toBe("/pm Ada ");
  expect(chatInput.maxLength).toBe(MAX_CHAT_LINE_LENGTH);
  expect(chatInput.focus).toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
