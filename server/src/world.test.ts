import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "@colyseus/sdk";
import { matchMaker } from "@colyseus/core";
import {
  parseRegion,
  REGION_GRID,
  respawnTile,
  TICK_MS,
  WALK_INTENT,
  WORLD_ROOM,
} from "@runic/shared";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";

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
  const { x, y } = respawnTile(parseRegion(REGION_GRID));

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
