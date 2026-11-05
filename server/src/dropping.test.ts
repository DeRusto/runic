import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CloseCode, matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  COMBAT_LOCK_TICKS,
  SAVE_INTERVAL_TICKS,
  TAKEN_OVER_CLOSE_CODE,
  TICK_MS,
  WALK_INTENT,
  WORLD_ROOM,
} from "@runic/shared";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { readSave } from "./saves.ts";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";

const PORT = 40000 + (process.pid % 5000);
const folder = mkdtempSync(join(tmpdir(), "runic-dropping-"));
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  process.env.DATABASE_PATH = join(folder, "test.db");
  server = await startServer(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
  rmSync(folder, { recursive: true, force: true });
});

async function clientFor(name: string) {
  const client = new Client(`http://localhost:${PORT}`);
  client.auth.token = await testToken(PORT, name);
  return client;
}

async function joined(client: Client) {
  const room = await client.join(WORLD_ROOM);
  room.reconnection.minUptime = 0;
  await vi.waitFor(() => expect(playerIn(room)).toBeDefined());
  return room;
}

const playerIn = (room: Room) =>
  (room.state as any).players?.get(room.sessionId);
const worldOf = (room: Room) =>
  matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
const serverPlayer = (room: Room) =>
  worldOf(room).sim.state.players.get(room.sessionId)!;
const accountOf = (room: Room) =>
  worldOf(room).clients.getById(room.sessionId)!.auth.id as number;

/** As a real swing would, without waiting for a Spider to come along. */
const lock = (room: Room) => worldOf(room).sim.lock(room.sessionId);

/** Runs the clock up to about a tick before a lock set now ends. */
const nearLockEnd = (room: Room) => {
  worldOf(room).sim.state.tick += COMBAT_LOCK_TICKS - 2;
};

/** The connection dies with no close handshake, as when the network goes. */
function dropSocket(room: Room) {
  const world = worldOf(room);
  (world.clients.getById(room.sessionId)!.ref as any).terminate();
  return vi.waitFor(() =>
    expect(world.clients.getById(room.sessionId)).toBeUndefined(),
  );
}

const gone = (room: Room) =>
  vi.waitFor(() => expect(serverPlayerOrNone(room)).toBeUndefined());
const serverPlayerOrNone = (room: Room) =>
  worldOf(room).sim.state.players.get(room.sessionId);

const left = (room: Room) =>
  new Promise<number>((resolve) => room.onLeave((code) => resolve(code)));

const twoTicks = () =>
  new Promise((resolve) => setTimeout(resolve, TICK_MS * 2));

test("with no lock, a drop leaves at once and the first retry is refused", async () => {
  const room = await joined(await clientFor("NoLock"));
  const id = accountOf(room);
  const closed = left(room);
  const started = performance.now();

  await dropSocket(room);

  await gone(room);
  expect(readSave(id)).toBeDefined();
  expect(await closed).toBe(CloseCode.FAILED_TO_RECONNECT);
  expect(performance.now() - started).toBeLessThan(2000);
});

test("with a lock, the player stays, and reconnecting takes the character back", async () => {
  const room = await joined(await clientFor("Comes"));
  const { sessionId } = room;
  lock(room);
  const seen = playerIn(room);
  const back = new Promise<void>((resolve) =>
    room.onReconnect(() => resolve()),
  );

  await dropSocket(room);
  const player = serverPlayer(room);
  player.health = 3; // something happens while they're away

  await back;
  expect(room.sessionId).toBe(sessionId);
  // The state is reconciled in place, so whatever holds the schema object keeps working.
  await vi.waitFor(() => expect(playerIn(room).health).toBe(3));
  expect(playerIn(room)).toBe(seen);

  const to = { x: player.x + 1, y: player.y };
  room.send(WALK_INTENT, to);
  await vi.waitFor(() => expect(playerIn(room).x).toBe(to.x), {
    timeout: TICK_MS * 6,
  });
});

test("a dropped player leaves when the lock runs out, and is saved", async () => {
  const room = await joined(await clientFor("LockEnds"));
  room.reconnection.enabled = false;
  const id = accountOf(room);
  lock(room);
  await dropSocket(room);
  await twoTicks();
  serverPlayer(room).health = 4;
  expect(worldOf(room).sim.lockRunning(room.sessionId)).toBe(true);

  nearLockEnd(room);

  await gone(room);
  expect(readSave(id)?.health).toBe(4);
});

test("a dropped player is saved every 100 ticks", async () => {
  const room = await joined(await clientFor("DropSaved"));
  room.reconnection.enabled = false;
  const id = accountOf(room);
  const { sim } = worldOf(room);
  sim.state.tick = SAVE_INTERVAL_TICKS * 1000 - 5;
  lock(room);
  await dropSocket(room);
  serverPlayer(room).health = 2;

  await vi.waitFor(() => expect(readSave(id)?.health).toBe(2), {
    timeout: TICK_MS * 8,
  });
  expect(serverPlayerOrNone(room)).toBeDefined();
});

test("a second login waits out the lock, then saves and kicks the old connection", async () => {
  const client = await clientFor("Duplicate");
  const old = await joined(client);
  lock(old);
  const kicked = left(old);
  serverPlayer(old).health = 7;

  let fresh: Room | undefined;
  const joining = client.join(WORLD_ROOM).then((room) => (fresh = room));
  await twoTicks();
  expect(fresh).toBeUndefined();
  expect(serverPlayerOrNone(old)).toBeDefined();

  nearLockEnd(old);

  expect(await kicked).toBe(TAKEN_OVER_CLOSE_CODE);
  await joining;
  await vi.waitFor(() => expect(playerIn(fresh!)?.health).toBe(7));
  expect((fresh!.state as any).players.has(old.sessionId)).toBe(false);
});

test("a login while dropped and locked waits too, then takes over from the save", async () => {
  const client = await clientFor("DropDup");
  const old = await joined(client);
  old.reconnection.enabled = false;
  lock(old);
  await dropSocket(old);
  serverPlayer(old).health = 6;

  let fresh: Room | undefined;
  const joining = client.join(WORLD_ROOM).then((room) => (fresh = room));
  await twoTicks();
  expect(fresh).toBeUndefined();

  nearLockEnd(old);

  await joining;
  await vi.waitFor(() => expect(playerIn(fresh!)?.health).toBe(6));
  expect(serverPlayerOrNone(old)).toBeUndefined();
});

test("a login given up on during the wait leaves the old connection alone", async () => {
  const client = await clientFor("GivesUp");
  const old = await joined(client);
  const world = worldOf(old);
  const account = accountOf(old);
  lock(old);
  let kicked = false;
  old.onLeave(() => (kicked = true));

  const waiting = client.join(WORLD_ROOM).catch(() => undefined);
  await twoTicks();
  const waiter = world.clients.find(
    (c) => c.sessionId !== old.sessionId && c.auth?.id === account,
  )!;
  (waiter.ref as any).terminate();
  await waiting;
  nearLockEnd(old);
  await twoTicks();
  await twoTicks();

  expect(kicked).toBe(false);
  expect(serverPlayerOrNone(old)).toBeDefined();
  expect(world.sim.state.players.has(waiter.sessionId)).toBe(false);
});

test("two logins waiting on one lock end with one character", async () => {
  const client = await clientFor("Thrice");
  const old = await joined(client);
  const world = worldOf(old);
  const before = world.sim.state.players.size;
  lock(old);

  const first = client.join(WORLD_ROOM).catch((error) => error.code);
  await twoTicks();
  const second = client.join(WORLD_ROOM);
  await twoTicks();
  nearLockEnd(old);

  expect(await first).toBe(TAKEN_OVER_CLOSE_CODE);
  const room = await second;
  await vi.waitFor(() => expect(playerIn(room)).toBeDefined());
  expect(world.sim.state.players.size).toBe(before);
});

// Last: it restarts the server under the other tests.
test("a clean shutdown saves locked and dropped players alike, and they rejoin", async () => {
  const lockedClient = await clientFor("ShutLock");
  const locked = await joined(lockedClient);
  const droppedClient = await clientFor("ShutDrop");
  const dropped = await joined(droppedClient);
  dropped.reconnection.enabled = false;
  lock(locked);
  lock(dropped);
  await dropSocket(dropped);
  serverPlayer(locked).health = 8;
  serverPlayer(dropped).health = 5;
  const closed = left(locked);

  await server.gracefullyShutdown(false);
  expect(await closed).toBe(CloseCode.SERVER_SHUTDOWN);
  server = await startServer(PORT);

  expect(playerIn(await joined(lockedClient)).health).toBe(8);
  expect(playerIn(await joined(droppedClient)).health).toBe(5);
});
