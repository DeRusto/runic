import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CloseCode, matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  LOGOUT_INTENT,
  parseRegion,
  REGION_GRID,
  respawnTile,
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

const PORT = 30000 + (process.pid % 5000);
const respawn = respawnTile(parseRegion(REGION_GRID));
const folder = mkdtempSync(join(tmpdir(), "runic-saving-"));
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
  await vi.waitFor(() => expect(tileOf(room)).toBeDefined());
  return room;
}

function tileOf(room: Room) {
  const player = (room.state as any).players?.get(room.sessionId);
  return player && { x: player.x, y: player.y };
}

/** Walks one tile east of the respawn tile and waits for the server to say so. */
async function stepEast(room: Room) {
  const to = { x: respawn.x + 1, y: respawn.y };
  room.send(WALK_INTENT, to);
  await vi.waitFor(() => expect(tileOf(room)).toEqual(to), {
    timeout: TICK_MS * 6,
    interval: 20,
  });
  return to;
}

test("logging out leaves the game, and logging back in returns to the saved tile", async () => {
  const client = await clientFor("LogsOut");
  const room = await joined(client);
  const to = await stepEast(room);

  const closed = new Promise((resolve) => room.onLeave(resolve));
  room.send(LOGOUT_INTENT);
  expect(await closed).toBe(CloseCode.CONSENTED);

  expect(tileOf(await joined(client))).toEqual(to);
});

test("a second login saves and kicks the old connection, and takes over", async () => {
  const client = await clientFor("Twice");
  const old = await joined(client);
  const to = await stepEast(old);

  const kicked = new Promise((resolve) => old.onLeave(resolve));
  const fresh = await joined(client);
  expect(await kicked).toBe(TAKEN_OVER_CLOSE_CODE);

  expect(tileOf(fresh)).toEqual(to);
  await vi.waitFor(() =>
    expect((fresh.state as any).players.has(old.sessionId)).toBe(false),
  );
});

test("everyone online is saved every 100 ticks", async () => {
  const room = await joined(await clientFor("Saved"));
  const to = await stepEast(room);
  const world = matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
  const { id } = world.clients.getById(room.sessionId)!.auth;
  expect(readSave(id)).toBeUndefined();

  world.sim.state.tick = SAVE_INTERVAL_TICKS - 1;
  await vi.waitFor(() => expect(readSave(id)).toMatchObject(to), {
    timeout: TICK_MS * 3,
    interval: 20,
  });
});

test("a clean shutdown saves everyone, and a restart brings them back", async () => {
  const client = await clientFor("Restart");
  const to = await stepEast(await joined(client));

  await server.gracefullyShutdown(false);
  server = await startServer(PORT);

  expect(tileOf(await joined(client))).toEqual(to);
});
