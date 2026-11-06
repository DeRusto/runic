import { EVENTS, type WorldEvent } from "@runic/shared";
import { expect, test, vi } from "vitest";
import { showFights } from "./fights.ts";
import type { WorldConnection } from "./players.ts";

const { figure, overhead, printChatLine } = vi.hoisted(() => ({
  figure: { moving: false, once: vi.fn() },
  overhead: { pop: vi.fn() },
  printChatLine: vi.fn(),
}));
vi.mock("./players.ts", () => ({
  playerFigures: new Map([["a", figure]]),
  playerOverheads: new Map([["a", overhead]]),
}));
vi.mock("./enemies.ts", () => ({}));
vi.mock("./bottomBar.ts", () => ({ printChatLine }));

test("a told line prints only for the player it's for", () => {
  const onMessage = vi.fn();
  showFights({
    onReconnect: vi.fn(),
    onMessage,
    sessionId: "a",
  } as unknown as WorldConnection);
  const handler = onMessage.mock.calls[0]![1];
  const told: WorldEvent[] = [
    { type: "told", player: "b", line: "Not for you." },
    { type: "told", player: "a", line: "For you." },
  ];
  handler(told);
  expect(printChatLine.mock.calls).toEqual([["For you."]]);
});

test("eating plays Use_Item and shows no number", () => {
  const onMessage = vi.fn();
  showFights({ onReconnect: vi.fn(), onMessage } as unknown as WorldConnection);
  const [type, handler] = onMessage.mock.calls[0]!;
  expect(type).toBe(EVENTS);
  const eaten: WorldEvent[] = [{ type: "eaten", player: "a" }];
  handler(eaten);
  expect(figure.once).toHaveBeenCalledWith("Use_Item", expect.any(Number));
  expect(overhead.pop).not.toHaveBeenCalled();
});
