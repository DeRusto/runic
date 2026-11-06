import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CloseCode, matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  EVENTS,
  LOGOUT_INTENT,
  parseRegion,
  PIN_INTENT,
  REGION_GRID,
  respawnTile,
  SAVE_INTERVAL_TICKS,
  TAKEN_OVER_CLOSE_CODE,
  TICK_MS,
  VISIT_INTENT,
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
  const room = await joined(client);
  const to = await stepEast(room);
  const world = matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
  const player = world.sim.state.players.get(room.sessionId)!;
  player.foragingXp = 300;
  player.inventory[0] = "berry";
  player.inventoryCounts[0] = 13;

  await server.gracefullyShutdown(false);
  server = await startServer(PORT);

  const back = await joined(client);
  expect(tileOf(back)).toEqual(to);
  const saved = (back.state as any).players.get(back.sessionId);
  expect(saved.foragingXp).toBe(300);
  expect(saved.inventory[0]).toBe("berry");
  expect(saved.inventoryCounts[0]).toBe(13);
  expect(saved.inventoryCounts[1]).toBe(0);
});

test("pins survive logging out, follow the player to another device, and new skills sync", async () => {
  const client = await clientFor("Pinner");
  const room = await joined(client);
  const synced = (r: Room) => (r.state as any).players.get(r.sessionId);
  expect(synced(room).miningXp).toBe(0);
  expect(synced(room).smithingXp).toBe(0);
  expect(synced(room).blockingXp).toBe(0);
  room.send(PIN_INTENT, { skill: "Combat", pinned: false });
  room.send(PIN_INTENT, { skill: "Blocking", pinned: true });
  const pinned = ["Defense", "Foraging", "Hitpoints", "Mining", "Smithing"];
  await vi.waitFor(
    () =>
      expect([...synced(room).pinnedSkills]).toEqual([...pinned, "Blocking"]),
    { timeout: TICK_MS * 3, interval: 20 },
  );

  const closed = new Promise((resolve) => room.onLeave(resolve));
  room.send(LOGOUT_INTENT);
  await closed;

  // A fresh client, as another device would be, with only the account in common.
  const device = new Client(`http://localhost:${PORT}`);
  device.auth.token = client.auth.token!;
  const back = await joined(device);
  expect([...synced(back).pinnedSkills]).toEqual([...pinned, "Blocking"]);
});

test("the Blacksmith's tools reach the client with a told line, and survive logging out", async () => {
  const tiles = parseRegion(REGION_GRID);
  const y = tiles.findIndex((row) => row.some((tile) => tile.blacksmith));
  const x = tiles[y]!.findIndex((tile) => tile.blacksmith);
  const client = await clientFor("Toolman");
  const room = await joined(client);
  const world = matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
  // Already beside the Blacksmith, so the test doesn't wait out the walk.
  Object.assign(world.sim.state.players.get(room.sessionId)!, { x: x - 1, y });
  const lines: unknown[] = [];
  room.onMessage(EVENTS, (events: { type: string }[]) =>
    lines.push(...events.filter(({ type }) => type === "told")),
  );
  const synced = (r: Room) => (r.state as any).players.get(r.sessionId);
  const BOTH = ["pickaxe", "hammer"];

  room.send(VISIT_INTENT);
  await vi.waitFor(() => expect([...synced(room).tools]).toEqual(BOTH), {
    timeout: TICK_MS * 4,
    interval: 20,
  });
  await vi.waitFor(() =>
    expect(lines).toEqual([
      {
        type: "told",
        player: room.sessionId,
        line: "The Blacksmith gives you a pickaxe and a hammer.",
      },
    ]),
  );

  const closed = new Promise((resolve) => room.onLeave(resolve));
  room.send(LOGOUT_INTENT);
  await closed;

  const back = await joined(client);
  expect([...synced(back).tools]).toEqual(BOTH);
});

test("stack counts survive logging out, and clients see them change", async () => {
  const client = await clientFor("Stacker");
  const room = await joined(client);
  const world = matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
  const player = world.sim.state.players.get(room.sessionId)!;
  player.inventory[2] = "herb";
  player.inventoryCounts[2] = 5;
  const synced = (r: Room) => (r.state as any).players.get(r.sessionId);
  await vi.waitFor(() => expect(synced(room).inventoryCounts[2]).toBe(5), {
    timeout: TICK_MS * 3,
    interval: 20,
  });

  const closed = new Promise((resolve) => room.onLeave(resolve));
  room.send(LOGOUT_INTENT);
  await closed;

  const back = await joined(client);
  expect(synced(back).inventory[2]).toBe("herb");
  expect(synced(back).inventoryCounts[2]).toBe(5);
});
