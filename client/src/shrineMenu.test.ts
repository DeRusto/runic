import { OFFER_INTENT, PRAY_INTENT } from "@runic/shared";
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
});
const chatLines = element();
vi.stubGlobal("document", {
  getElementById: (id: string) => (id === "chat-lines" ? chatLines : null),
  createElement: element,
});
// After the stub, since printChatLine's module looks up the chat box as it loads.
const { shrineMenuChoices } = await import("./shrineMenu.ts");

const send = vi.fn();
const me = { inventory: ["rope", "bones"], inventoryCounts: [1, 3] };
const room = {
  send,
  sessionId: "me",
  state: { players: new Map([["me", me]]) },
} as unknown as WorldConnection;
const shrine = { x: 21, y: 45 };

beforeEach(() => {
  me.inventoryCounts = [1, 3];
  send.mockClear();
  chatLines.children = [];
});

test("a shrine offers Pray and Offer bones, which send their intents with the shrine's tile", () => {
  const choices = shrineMenuChoices(room, shrine);
  expect(choices.map(([label]) => label)).toEqual(["Pray", "Offer bones"]);
  choices[0]![1]();
  choices[1]![1]();
  expect(send.mock.calls).toEqual([
    [PRAY_INTENT, shrine],
    [OFFER_INTENT, shrine],
  ]);
});

test("offering with no bones shows the refusal in the chat and sends nothing", () => {
  me.inventoryCounts = [1, 0];
  shrineMenuChoices(room, shrine)[1]![1]();
  expect(send).not.toHaveBeenCalled();
  expect(chatLines.children.map((line) => line.children)).toEqual([
    ["You have no bones to offer."],
  ]);
});
