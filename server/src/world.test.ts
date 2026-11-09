import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@colyseus/sdk";
import { matchMaker } from "@colyseus/core";
import {
  DROP_INTENT,
  EVENTS,
  GROUND_ITEM_DESPAWN_TICKS,
  GROUND_ITEM_OWNER_TICKS,
  respawnTile,
  TAKE_INTENT,
  TARGET_INTENT,
  TICK_MS,
  WALK_INTENT,
  WORLD_ROOM,
  type WorldEvent,
} from "@runic/shared";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";
import { loadWorldRegion } from "./worldRegion.ts";

// per-process so parallel worktrees don't collide
const PORT = 25000 + (process.pid % 5000);
const client = new Client(`http://localhost:${PORT}`);
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  server = await startServer(PORT);
  client.auth.token = await testToken(PORT);
});
afterAll(() => server.gracefullyShutdown(false));

test("a joining client receives one patch per tick, every 300 ms", async () => {
  const room = await client.join(WORLD_ROOM);
  const ticks: number[] = [];
  const times: number[] = [];
  room.onStateChange((state: { tick: number }) => {
    ticks.push(state.tick);
    times.push(Date.now());
  });
  await sleep(TICK_MS * 12);
  await room.leave();

  // the first entry is the full state on join; after it, every tick is one patch
  const patches = ticks.slice(1);
  expect(patches.length).toBeGreaterThanOrEqual(9);
  patches.forEach((tick, i) => expect(tick).toBe(ticks[0]! + i + 1));
  const gaps = times.slice(2).map((t, i) => t - times[i + 1]!);
  gaps.forEach((gap) => expect(Math.abs(gap - TICK_MS)).toBeLessThan(100));
});

test("a walk intent moves the player on the server, and others see it", async () => {
  const walker = await client.join(WORLD_ROOM);
  const other = new Client(`http://localhost:${PORT}`);
  other.auth.token = await testToken(PORT, "Watcher");
  const watcher = await other.join(WORLD_ROOM);
  const { x, y } = respawnTile(loadWorldRegion());

  walker.send(WALK_INTENT, { x: x + 2, y });

  await vi.waitFor(
    () => {
      const seen = watcher.state.players.get(walker.sessionId);
      expect({ x: seen.x, y: seen.y }).toEqual({ x: x + 2, y });
    },
    { timeout: TICK_MS * 6, interval: 50 },
  );
  await walker.leave();
  await vi.waitFor(() =>
    expect(watcher.state.players.has(walker.sessionId)).toBe(false),
  );
  await watcher.leave();
});

test("a tick's events arrive once, right after its patch", async () => {
  const fighter = new Client(`http://localhost:${PORT}`);
  fighter.auth.token = await testToken(PORT, "Fighter");
  const room = await fighter.join(WORLD_ROOM);
  const [{ roomId }] = await matchMaker.query({ name: WORLD_ROOM });
  const { sim } = matchMaker.getLocalRoomById(roomId!) as WorldRoom;
  const spider = sim.state.enemies.get("0")!;
  // Standing on the Spider counts as next to it, and it's quickest for a real server.
  Object.assign(sim.state.players.get(room.sessionId)!, {
    x: spider.x,
    y: spider.y,
  });

  const received: { tick: number; events: WorldEvent[] }[] = [];
  let patchTick = 0;
  room.onStateChange((state: { tick: number }) => (patchTick = state.tick));
  room.onMessage(EVENTS, (events: WorldEvent[]) =>
    received.push({ tick: patchTick, events }),
  );
  room.send(TARGET_INTENT, "0");

  await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(2), {
    timeout: TICK_MS * 12,
    interval: 50,
  });
  await room.leave();

  const swings = received.filter(({ events }) =>
    events[0]?.type.includes("Swing"),
  );
  expect(swings[0]!.events[0]).toMatchObject({
    type: "playerSwing",
    player: room.sessionId,
    enemy: "0",
  });
  // A swing's tick is the one the patch before it brought, 4 ticks between the two swings.
  expect(swings[1]!.tick - swings[0]!.tick).toBe(4);
  expect(new Set(received.map(({ tick }) => tick)).size).toBe(received.length);
});

test("a ground item reaches only its owner until its owner minute ends", async () => {
  const owner = new Client(`http://localhost:${PORT}`);
  owner.auth.token = await testToken(PORT, "Dropper");
  const dropper = await owner.join(WORLD_ROOM);
  const other = new Client(`http://localhost:${PORT}`);
  other.auth.token = await testToken(PORT, "Passerby");
  const passerby = await other.join(WORLD_ROOM);
  const { sim } = matchMaker.getLocalRoomById(dropper.roomId) as WorldRoom;
  await vi.waitFor(() =>
    expect(sim.state.players.has(dropper.sessionId)).toBe(true),
  );
  const held = sim.state.players.get(dropper.sessionId)!;
  held.inventory[0] = "berry";
  held.inventoryCounts[0] = 3;

  dropper.send(DROP_INTENT, 0);
  await vi.waitFor(() => expect(dropper.state.groundItems.size).toBe(1), {
    timeout: TICK_MS * 6,
    interval: 50,
  });
  const [dropped] = dropper.state.groundItems.values();
  expect({ item: dropped.item, count: dropped.count }).toEqual({
    item: "berry",
    count: 3,
  });
  await sleep(TICK_MS * 3);
  // A view-tagged map reaches a client only once something in it does.
  expect(passerby.state.groundItems?.size ?? 0).toBe(0);

  sim.state.tick += GROUND_ITEM_OWNER_TICKS;
  await vi.waitFor(() => expect(passerby.state.groundItems?.size).toBe(1), {
    timeout: TICK_MS * 6,
    interval: 50,
  });
  await dropper.leave();
  await passerby.leave();
});

test("a take intent moves a ground item back into the inventory", async () => {
  const owner = new Client(`http://localhost:${PORT}`);
  owner.auth.token = await testToken(PORT, "Taker");
  const taker = await owner.join(WORLD_ROOM);
  const { sim } = matchMaker.getLocalRoomById(taker.roomId) as WorldRoom;
  await vi.waitFor(() =>
    expect(sim.state.players.has(taker.sessionId)).toBe(true),
  );
  const held = sim.state.players.get(taker.sessionId)!;
  held.inventory[0] = "berry";
  held.inventoryCounts[0] = 3;
  const waitFor = { timeout: TICK_MS * 6, interval: 50 };

  // The room outlives each test, so an earlier test's ground items may be here too.
  const mine = () =>
    [...(taker.state.groundItems?.entries() ?? [])].find(
      ([, { owner }]) => owner,
    )?.[0];
  taker.send(DROP_INTENT, 0);
  await vi.waitFor(() => expect(mine()).toBeDefined(), waitFor);
  taker.send(TAKE_INTENT, mine());
  await vi.waitFor(() => expect(mine()).toBeUndefined(), waitFor);
  const me = taker.state.players.get(taker.sessionId)!;
  expect([me.inventory[0], me.inventoryCounts[0]]).toEqual(["berry", 3]);
  await taker.leave();
});

test("a public ground item leaves another viewer's state when taken and when it despawns", async () => {
  const owner = new Client(`http://localhost:${PORT}`);
  owner.auth.token = await testToken(PORT, "Giver");
  const giver = await owner.join(WORLD_ROOM);
  const other = new Client(`http://localhost:${PORT}`);
  other.auth.token = await testToken(PORT, "Onlooker");
  const onlooker = await other.join(WORLD_ROOM);
  const { sim } = matchMaker.getLocalRoomById(giver.roomId) as WorldRoom;
  await vi.waitFor(() =>
    expect(sim.state.players.has(giver.sessionId)).toBe(true),
  );
  const held = sim.state.players.get(giver.sessionId)!;
  const waitFor = { timeout: TICK_MS * 6, interval: 50 };

  /** Drops three berries, makes every ground item public, and waits for the onlooker to see this one. */
  const dropPublic = async () => {
    held.inventory[0] = "berry";
    held.inventoryCounts[0] = 3;
    giver.send(DROP_INTENT, 0);
    let id: string | undefined;
    await vi.waitFor(() => {
      id = [...sim.state.groundItems.entries()].find(
        ([, { owner }]) => owner === "Giver",
      )?.[0];
      expect(id).toBeDefined();
    }, waitFor);
    sim.state.tick += GROUND_ITEM_OWNER_TICKS;
    await vi.waitFor(
      () => expect(onlooker.state.groundItems?.has(id!)).toBe(true),
      waitFor,
    );
    return id!;
  };

  const taken = await dropPublic();
  giver.send(TAKE_INTENT, taken);
  await vi.waitFor(
    () => expect(onlooker.state.groundItems.has(taken)).toBe(false),
    waitFor,
  );

  const despawned = await dropPublic();
  sim.state.tick += GROUND_ITEM_DESPAWN_TICKS;
  await vi.waitFor(
    () => expect(onlooker.state.groundItems.has(despawned)).toBe(false),
    waitFor,
  );
  await giver.leave();
  await onlooker.leave();
});

test("the world room exists at start and survives everyone leaving", async () => {
  const before = await matchMaker.query({ name: WORLD_ROOM });
  expect(before).toHaveLength(1);

  const first = await client.join(WORLD_ROOM);
  await first.leave();
  await sleep(TICK_MS * 2);

  const after = await matchMaker.query({ name: WORLD_ROOM });
  expect(after).toHaveLength(1);
  expect(after[0]!.roomId).toBe(before[0]!.roomId);

  const second = await client.join(WORLD_ROOM);
  expect(second.roomId).toBe(first.roomId);
  await second.leave();
});
