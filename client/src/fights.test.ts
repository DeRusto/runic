import { EVENTS, TICK_MS, xpForLevel, type WorldEvent } from "@runic/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { swingFor } from "./characters.ts";
import { showFights } from "./fights.ts";
import type { WorldConnection } from "./players.ts";

const {
  figure,
  overhead,
  printChatLine,
  holdPick,
  revealPick,
  enemyFigures,
  enemyOverheads,
} = vi.hoisted(() => ({
  figure: {
    moving: false,
    once: vi.fn(),
    onceWithin: vi.fn(() => 2400),
    work: undefined as unknown,
  },
  overhead: { pop: vi.fn() },
  printChatLine: vi.fn(),
  holdPick: vi.fn(),
  revealPick: vi.fn(),
  enemyFigures: new Map<string, unknown>(),
  enemyOverheads: new Map<string, unknown>(),
}));
vi.mock("./players.ts", () => ({
  playerFigures: new Map([["a", figure]]),
  playerOverheads: new Map([["a", overhead]]),
}));
vi.mock("./enemies.ts", () => ({
  ENEMY_CLIPS: { spider: { attack: "Spider_Attack", death: "Spider_Death" } },
  enemyFigures,
  enemyOverheads,
}));
vi.mock("./bottomBar.ts", () => ({ printChatLine, holdPick, revealPick }));
vi.mock("./stations.ts", () => ({
  stationTile: (kind: string) =>
    kind === "anvil" ? { x: 6, y: 1 } : { x: 4, y: 1 },
}));

describe("the make event", () => {
  const send = (event: WorldEvent) => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
    } as unknown as WorldConnection);
    onMessage.mock.calls[0]![1]([event]);
  };

  test("at the anvil, faces it and hammers, fitted to the wait", () => {
    send({ type: "make", player: "a", station: "anvil", ticks: 12 });
    expect(figure.work).toEqual({ tile: { x: 6, y: 1 }, hammer: true });
    expect(figure.onceWithin).toHaveBeenLastCalledWith(
      "Hammering",
      12 * TICK_MS,
    );
  });

  test("at the furnace, faces it and works with empty hands", () => {
    send({ type: "make", player: "a", station: "furnace", ticks: 6 });
    expect(figure.work).toEqual({ tile: { x: 4, y: 1 }, hammer: false });
    expect(figure.onceWithin).toHaveBeenLastCalledWith(
      "Working_A",
      6 * TICK_MS,
    );
  });

  test("for someone no longer here, does nothing", () => {
    expect(() =>
      send({ type: "make", player: "gone", station: "furnace", ticks: 6 }),
    ).not.toThrow();
  });
});

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

describe("the playerSwing event", () => {
  const enemy = { flash: vi.fn(), nudgeFrom: vi.fn(), dieAndSink: vi.fn() };
  const send = (events: WorldEvent[], weapon: string, tick = 408) => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      state: {
        tick,
        players: new Map([["a", { weapon, x: 1, y: 1 }]]),
        enemies: new Map([["0", { kind: "spider" }]]),
      },
    } as unknown as WorldConnection);
    onMessage.mock.calls[0]![1](events);
  };
  const swing = (damage: number): WorldEvent => ({
    type: "playerSwing",
    player: "a",
    enemy: "0",
    damage,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    enemyFigures.set("0", enemy);
    enemyOverheads.set("0", { holdBlow: vi.fn(), showBlow: vi.fn() });
  });
  afterEach(() => vi.useRealTimers());

  test("with a sword, plays the clip every viewer picks and lands at its contact", () => {
    const { clip, contactMs } = swingFor("copperSword", "a", 408);
    send([swing(2)], "copperSword");
    expect(figure.once).toHaveBeenLastCalledWith(clip);
    vi.advanceTimersByTime(contactMs - 1);
    expect(enemy.flash).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(enemy.flash).toHaveBeenCalledOnce();
  });

  test("with no sword, punches and lands at 550 ms", () => {
    send([swing(2)], "");
    expect(figure.once).toHaveBeenLastCalledWith(
      "Melee_Unarmed_Attack_Punch_A",
    );
    vi.advanceTimersByTime(549);
    expect(enemy.flash).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(enemy.flash).toHaveBeenCalledOnce();
  });

  test("the enemy falls at the killing swing's contact, not a punch's", () => {
    const tick = [...Array(100).keys()].find(
      (t) => swingFor("copperSword", "a", t).contactMs === 380,
    )!;
    send([swing(2), { type: "enemyDied", enemy: "0" }], "copperSword", tick);
    vi.advanceTimersByTime(379);
    expect(enemy.dieAndSink).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(enemy.dieAndSink).toHaveBeenCalledOnce();
  });
});

describe("the mine event", () => {
  const send = (event: WorldEvent, miningXp = 0, sessionId = "a") => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      sessionId,
      state: { players: new Map([["a", { miningXp, foragingXp: 0 }]]) },
    } as unknown as WorldConnection);
    onMessage.mock.calls[0]![1]([event]);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  test("plays Pickaxing, fitted to the attempts at the Mining level", () => {
    send({ type: "mine", player: "a", success: false });
    expect(figure.onceWithin).toHaveBeenLastCalledWith(
      "Pickaxing",
      8 * TICK_MS,
    );
    send({ type: "mine", player: "a", success: false }, xpForLevel(60));
    expect(figure.onceWithin).toHaveBeenLastCalledWith(
      "Pickaxing",
      4 * TICK_MS,
    );
  });

  test("holds a success's result until 0.4 of the clip", () => {
    send({ type: "mine", player: "a", success: true });
    expect(holdPick).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(0.4 * 2400 - 1);
    expect(revealPick).not.toHaveBeenCalled();
    expect(overhead.pop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revealPick).toHaveBeenCalledOnce();
    expect(overhead.pop).toHaveBeenCalledWith("Mined!", "pick");
  });

  test("a failure holds nothing, and says so at the same moment", () => {
    send({ type: "mine", player: "a", success: false });
    expect(holdPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.4 * 2400);
    expect(overhead.pop).toHaveBeenCalledWith("No luck", "pick");
  });

  test("someone else's success doesn't hold our bar", () => {
    send({ type: "mine", player: "a", success: true }, 0, "me");
    expect(holdPick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.4 * 2400);
    expect(revealPick).not.toHaveBeenCalled();
    expect(overhead.pop).toHaveBeenCalledWith("Mined!", "pick");
  });
});
