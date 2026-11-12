import { EVENTS, TICK_MS, xpForLevel, type WorldEvent } from "@runic/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { armedSwing, swingFor } from "./characters.ts";
import { showFights } from "./fights.ts";
import type { WorldConnection } from "./players.ts";

const {
  figure,
  overhead,
  printChatLine,
  holdResult,
  revealResult,
  enemyFigures,
  enemyOverheads,
  stationTile,
} = vi.hoisted(() => ({
  figure: {
    tile: { x: 3, y: 2 },
    moving: false,
    once: vi.fn(),
    onceWithin: vi.fn(() => 2400),
    work: undefined as unknown,
  },
  overhead: { pop: vi.fn() },
  printChatLine: vi.fn(),
  holdResult: vi.fn(),
  revealResult: vi.fn(),
  enemyFigures: new Map<string, unknown>(),
  enemyOverheads: new Map<string, unknown>(),
  stationTile: vi.fn((kind: string, _near: unknown) =>
    kind === "anvil" ? { x: 6, y: 1 } : { x: 4, y: 1 },
  ),
}));
vi.mock("./players.ts", () => ({
  playerFigures: new Map([["a", figure]]),
  playerOverheads: new Map([["a", overhead]]),
}));
vi.mock("./enemies.ts", () => ({
  enemyFigures,
  enemyOverheads,
}));
vi.mock("./bottomBar.ts", () => ({ printChatLine, holdResult, revealResult }));
vi.mock("./stations.ts", () => ({ stationTile }));

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

  test("faces the station's tile nearest where the maker stands", () => {
    send({ type: "make", player: "a", station: "furnace", ticks: 6 });
    expect(stationTile).toHaveBeenLastCalledWith("furnace", { x: 3, y: 2 });
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

test("making an improved item prints a line for its maker, with the name in its Quality's colour, and a common one stays silent (spec §5)", () => {
  vi.stubGlobal("document", {
    createElement: () => ({ className: "", textContent: "" }),
  });
  const onMessage = vi.fn();
  showFights({
    onReconnect: vi.fn(),
    onMessage,
    sessionId: "a",
  } as unknown as WorldConnection);
  const made: WorldEvent[] = [
    { type: "made", player: "a", item: "copperChestplate:uncommon:fortitude" },
    { type: "made", player: "a", item: "ironSword:rare:might" },
    { type: "made", player: "a", item: "emberiteHelmet:uncommon:avoidance" },
    { type: "made", player: "a", item: "copperSword" },
    { type: "made", player: "b", item: "copperSword:rare:might" },
  ];
  onMessage.mock.calls[0]![1](made);
  expect(printChatLine.mock.calls).toEqual([
    [
      "You make a [",
      { className: "uncommon", textContent: "Copper chestplate of Fortitude" },
      "]!",
    ],
    [
      "You make an [",
      { className: "rare", textContent: "Iron sword of Might" },
      "]!",
    ],
    [
      "You make an [",
      { className: "uncommon", textContent: "Emberite helmet of Avoidance" },
      "]!",
    ],
  ]);
  vi.unstubAllGlobals();
});

test("eating plays Use_Item and shows no number until a healing tick", () => {
  const onMessage = vi.fn();
  showFights({ onReconnect: vi.fn(), onMessage } as unknown as WorldConnection);
  const [type, handler] = onMessage.mock.calls[0]!;
  expect(type).toBe(EVENTS);
  const eaten: WorldEvent[] = [{ type: "eaten", player: "a" }];
  handler(eaten);
  expect(figure.once).toHaveBeenCalledWith("Use_Item", expect.any(Number));
  expect(overhead.pop).not.toHaveBeenCalled();
});

describe("the healed event", () => {
  const send = (event: WorldEvent) => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      sessionId: "someone else",
    } as unknown as WorldConnection);
    onMessage.mock.calls[0]![1]([event]);
  };

  beforeEach(() => vi.clearAllMocks());

  test("shows a green number over that player, for every viewer", () => {
    send({ type: "healed", player: "a", amount: 2 });
    expect(overhead.pop).toHaveBeenCalledWith("+2", "heal");
  });

  test("faces the station's tile nearest where the maker stands", () => {
    send({ type: "make", player: "a", station: "furnace", ticks: 6 });
    expect(stationTile).toHaveBeenLastCalledWith("furnace", { x: 3, y: 2 });
  });

  test("for someone no longer here, does nothing", () => {
    expect(() =>
      send({ type: "healed", player: "gone", amount: 1 }),
    ).not.toThrow();
  });
});

describe("the playerSwing event", () => {
  const enemy = {
    flash: vi.fn(),
    nudgeFrom: vi.fn(),
    dieAndSink: vi.fn(),
  };
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
    critical: false,
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

  test("a critical hit shows as one at contact", () => {
    const showBlow = vi.fn();
    enemyOverheads.set("0", { holdBlow: vi.fn(), showBlow });
    send([{ ...swing(300), critical: true } as WorldEvent], "");
    vi.advanceTimersByTime(550);
    expect(showBlow).toHaveBeenCalledWith(300, true);
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

describe("an enemy's swing", () => {
  const enemy = {
    flash: vi.fn(),
    nudgeFrom: vi.fn(),
    dieAndSink: vi.fn(),
    once: vi.fn(),
    respawn: vi.fn(),
    reappear: vi.fn(),
    playingOnce: false,
  };
  const send = (kind: string, events: WorldEvent[], tick = 408) => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      state: {
        tick,
        players: new Map([["a", { weapon: "", x: 1, y: 1 }]]),
        enemies: new Map([["0", { kind }]]),
      },
    } as unknown as WorldConnection);
    onMessage.mock.calls[0]![1](events);
  };
  const swing = (damage: number): WorldEvent => ({
    type: "enemySwing",
    enemy: "0",
    player: "a",
    damage,
    blocked: false,
  });
  /** A tick on which Skeleton "0" swings with the given contact. */
  const tickWith = (contactMs: number) =>
    [...Array(100).keys()].find(
      (tick) => armedSwing("0", tick).contactMs === contactMs,
    )!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    enemy.playingOnce = false;
    enemyFigures.set("0", enemy);
    enemyOverheads.set("0", { holdBlow: vi.fn(), showBlow: vi.fn() });
    Object.assign(overhead, { holdBlow: vi.fn(), showBlow: vi.fn() });
  });
  afterEach(() => vi.useRealTimers());

  test("a Spider's plays its clip and lands at 450 ms", () => {
    send("spider", [swing(1)]);
    expect(enemy.once).toHaveBeenLastCalledWith("Spider_Attack");
    vi.advanceTimersByTime(449);
    expect(figure.once).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(figure.once).toHaveBeenLastCalledWith("Hit_A");
  });

  test.each([580, 420, 380])(
    "a Skeleton's plays the armed swing every viewer picks, landing at %d ms",
    (contactMs) => {
      const tick = tickWith(contactMs);
      send("skeleton", [swing(1)], tick);
      expect(enemy.once).toHaveBeenLastCalledWith(armedSwing("0", tick).clip);
      vi.advanceTimersByTime(contactMs - 1);
      expect(figure.once).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(figure.once).toHaveBeenLastCalledWith("Hit_A");
    },
  );

  test("the player falls at the killing swing's contact", () => {
    const death: WorldEvent = { type: "playerDied", player: "a" };
    send("skeleton", [swing(1), death], tickWith(380));
    vi.advanceTimersByTime(379);
    expect(figure.once).not.toHaveBeenCalledWith("Death_A", 1, true);
    vi.advanceTimersByTime(1);
    expect(figure.once).toHaveBeenLastCalledWith("Death_A", 1, true);
  });

  test("a player's landed hit plays a Skeleton's Hit_A, unless it's mid-clip", () => {
    const hit: WorldEvent = {
      type: "playerSwing",
      player: "a",
      enemy: "0",
      damage: 1,
      critical: false,
    };
    send("skeleton", [hit]);
    vi.advanceTimersByTime(550);
    expect(enemy.once).toHaveBeenLastCalledWith("Hit_A");
    enemy.once.mockClear();
    enemy.playingOnce = true;
    send("skeleton", [hit]);
    vi.advanceTimersByTime(550);
    expect(enemy.once).not.toHaveBeenCalled();
  });

  test("a player's landed hit doesn't play a clip on a Spider", () => {
    send("spider", [
      {
        type: "playerSwing",
        player: "a",
        enemy: "0",
        damage: 1,
        critical: false,
      },
    ]);
    vi.advanceTimersByTime(550);
    expect(enemy.once).not.toHaveBeenCalled();
  });

  test("a Skeleton dies on Death_A and returns rising, a Spider scaling up", () => {
    const kill: WorldEvent[] = [
      {
        type: "playerSwing",
        player: "a",
        enemy: "0",
        damage: 1,
        critical: false,
      },
      { type: "enemyDied", enemy: "0" },
    ];
    send("skeleton", kill);
    vi.advanceTimersByTime(550);
    expect(enemy.dieAndSink).toHaveBeenLastCalledWith("Death_A");
    send("skeleton", [{ type: "enemyReturned", enemy: "0" }]);
    expect(enemy.respawn).toHaveBeenCalledOnce();
    expect(enemy.reappear).not.toHaveBeenCalled();
    send("spider", [{ type: "enemyReturned", enemy: "0" }]);
    expect(enemy.reappear).toHaveBeenCalledOnce();
  });

  test("a block on a Skeleton's swing shows at that swing's contact", () => {
    send(
      "skeleton",
      [{ ...swing(0), blocked: true } as WorldEvent],
      tickWith(380),
    );
    vi.advanceTimersByTime(379);
    expect(overhead.pop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
  });
});

describe("the enemySwing event", () => {
  const holdBlow = vi.fn();
  const showBlow = vi.fn();
  const send = (damage: number, blocked: boolean) => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      state: { enemies: new Map([["0", { kind: "spider" }]]) },
    } as unknown as WorldConnection);
    const swing: WorldEvent = {
      type: "enemySwing",
      enemy: "0",
      player: "a",
      damage,
      blocked,
    };
    onMessage.mock.calls[0]![1]([swing]);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    enemyFigures.set("0", { once: vi.fn() });
    Object.assign(overhead, { holdBlow, showBlow });
  });
  afterEach(() => vi.useRealTimers());

  test("a block shows Blocked and Melee_Block_Hit at contact, with no line", () => {
    send(0, true);
    vi.advanceTimersByTime(449);
    expect(overhead.pop).not.toHaveBeenCalled();
    expect(figure.once).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
    expect(figure.once).toHaveBeenCalledWith("Melee_Block_Hit");
    expect(showBlow).not.toHaveBeenCalled();
    expect(printChatLine).not.toHaveBeenCalled();
  });

  test("a block shows its clip over one already playing", () => {
    Object.assign(figure, { playingOnce: true });
    send(0, true);
    vi.advanceTimersByTime(450);
    Object.assign(figure, { playingOnce: false });
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
    expect(figure.once).toHaveBeenCalledWith("Melee_Block_Hit");
  });

  test("a block doesn't lift a player off their death clip", () => {
    Object.assign(figure, { downed: true });
    send(0, true);
    vi.advanceTimersByTime(450);
    Object.assign(figure, { downed: false });
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
    expect(figure.once).not.toHaveBeenCalled();
  });

  test("damage 0 alone is still a miss", () => {
    send(0, false);
    vi.advanceTimersByTime(450);
    expect(showBlow).toHaveBeenCalledWith(0, false);
    expect(figure.once).not.toHaveBeenCalled();
  });

  test("a landed hit plays Hit_A", () => {
    send(2, false);
    vi.advanceTimersByTime(450);
    expect(showBlow).toHaveBeenCalledWith(2, false);
    expect(figure.once).toHaveBeenCalledWith("Hit_A");
  });
});

describe("a block during the player's own swing", () => {
  const enemy = { flash: vi.fn(), nudgeFrom: vi.fn(), once: vi.fn() };
  const playerSwing: WorldEvent = {
    type: "playerSwing",
    player: "a",
    enemy: "0",
    damage: 1,
    critical: false,
  };
  const blockedSwing: WorldEvent = {
    type: "enemySwing",
    enemy: "0",
    player: "a",
    damage: 0,
    blocked: true,
  };
  const connect = () => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      state: {
        tick: 408,
        players: new Map([["a", { weapon: "", x: 1, y: 1 }]]),
        enemies: new Map([["0", { kind: "spider" }]]),
      },
    } as unknown as WorldConnection);
    return onMessage.mock.calls[0]![1] as (events: WorldEvent[]) => void;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    enemyFigures.set("0", enemy);
    enemyOverheads.set("0", { holdBlow: vi.fn(), showBlow: vi.fn() });
  });
  afterEach(() => vi.useRealTimers());

  test("says Blocked on time, and plays the clip once the swing has connected", () => {
    connect()([playerSwing, blockedSwing]);
    figure.once.mockClear();
    vi.advanceTimersByTime(450);
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
    expect(figure.once).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(enemy.flash).not.toHaveBeenCalled();
    expect(figure.once).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(enemy.flash).toHaveBeenCalledOnce();
    expect(figure.once).toHaveBeenCalledWith("Melee_Block_Hit");
  });

  test("waits for a swing that started after the enemy's", () => {
    const handle = connect();
    handle([blockedSwing]);
    vi.advanceTimersByTime(300);
    handle([playerSwing]);
    figure.once.mockClear();
    vi.advanceTimersByTime(150);
    expect(overhead.pop).toHaveBeenCalledWith("Blocked", "blocked");
    expect(figure.once).not.toHaveBeenCalled();
    vi.advanceTimersByTime(400);
    expect(figure.once).toHaveBeenCalledWith("Melee_Block_Hit");
  });

  test("plays at once when the swing connected before the enemy's did", () => {
    const handle = connect();
    handle([playerSwing]);
    vi.advanceTimersByTime(550);
    handle([blockedSwing]);
    figure.once.mockClear();
    vi.advanceTimersByTime(450);
    expect(figure.once).toHaveBeenCalledWith("Melee_Block_Hit");
  });

  test("a player who died while it waited stays down", () => {
    connect()([playerSwing, blockedSwing]);
    figure.once.mockClear();
    vi.advanceTimersByTime(500);
    Object.assign(figure, { downed: true });
    vi.advanceTimersByTime(50);
    Object.assign(figure, { downed: false });
    expect(figure.once).not.toHaveBeenCalled();
  });
});

describe("the mine event", () => {
  const send = (event: WorldEvent, miningXp = 0, sessionId = "a") => {
    const onMessage = vi.fn();
    showFights({
      onReconnect: vi.fn(),
      onMessage,
      sessionId,
      state: { players: new Map([["a", { miningXp, herblawXp: 0 }]]) },
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
    send({ type: "mine", player: "a", success: true, count: 1, finds: [] });
    expect(holdResult).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(0.4 * 2400 - 1);
    expect(revealResult).not.toHaveBeenCalled();
    expect(overhead.pop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revealResult).toHaveBeenCalledOnce();
    expect(overhead.pop).toHaveBeenCalledWith("Mined!", "pick");
  });

  test("a double says so at the same moment", () => {
    send({ type: "mine", player: "a", success: true, count: 2, finds: [] });
    expect(holdResult).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(0.4 * 2400);
    expect(revealResult).toHaveBeenCalledOnce();
    expect(overhead.pop).toHaveBeenCalledWith("Mined 2!", "pick");
  });

  test("a double with finds names them, as the spec's example reads", () => {
    send({
      type: "mine",
      player: "a",
      success: true,
      count: 2,
      finds: ["tin", "coal"],
    });
    vi.advanceTimersByTime(0.4 * 2400);
    expect(overhead.pop).toHaveBeenCalledWith(
      "Mined 2! Found tin and coal.",
      "pick",
    );
  });

  test("one find is named on its own, and none leaves the line as it was", () => {
    send({
      type: "mine",
      player: "a",
      success: true,
      count: 1,
      finds: ["ashstone"],
    });
    vi.advanceTimersByTime(0.4 * 2400);
    expect(overhead.pop).toHaveBeenCalledWith("Mined! Found ashstone.", "pick");
  });

  test("a failure holds nothing, and says so at the same moment", () => {
    send({ type: "mine", player: "a", success: false });
    expect(holdResult).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.4 * 2400);
    expect(overhead.pop).toHaveBeenCalledWith("No luck", "pick");
  });

  test("someone else's success doesn't hold our bar", () => {
    send(
      { type: "mine", player: "a", success: true, count: 1, finds: [] },
      0,
      "me",
    );
    expect(holdResult).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0.4 * 2400);
    expect(revealResult).not.toHaveBeenCalled();
    expect(overhead.pop).toHaveBeenCalledWith("Mined!", "pick");
  });
});
