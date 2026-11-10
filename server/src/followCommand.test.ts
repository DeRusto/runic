import { matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import { CHAT, PRIVATE_LINE, WORLD_ROOM, type ChatLine } from "@runic/shared";
import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  onTestFinished,
  test,
  vi,
} from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";

const PORT = 60000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;

/** A logged-in player and every chat-box line they have received. */
type Player = { room: Room; lines: string[] };

async function joinAs(name: string): Promise<Player> {
  const client = new Client(`http://localhost:${PORT}`);
  client.auth.token = await testToken(PORT, name);
  const room = await client.join(WORLD_ROOM);
  const player: Player = { room, lines: [] };
  room.onMessage(CHAT, ({ username, text }: ChatLine) =>
    player.lines.push(`${username}: ${text}`),
  );
  room.onMessage(PRIVATE_LINE, (line: string) => player.lines.push(line));
  return player;
}

let me: Player;
let them: Player;
let world: WorldRoom;

beforeAll(async () => {
  server = await startServer(PORT);
  await testToken(PORT, "FoAway");
  me = await joinAs("FoMe");
  them = await joinAs("FoThem");
  world = matchMaker.getLocalRoomById(me.room.roomId) as WorldRoom;
});
afterAll(() => server.gracefullyShutdown(false));
beforeEach(() => {
  for (const { lines } of [me, them]) lines.length = 0;
});

/** Sends `line` as me, then a public marker from them, so both players' lines are complete once it arrives. */
async function say(line: string) {
  me.room.send(CHAT, line);
  them.room.send(CHAT, "marker");
  await vi.waitFor(() => {
    for (const { lines } of [me, them])
      expect(lines.at(-1)).toBe("FoThem: marker");
  });
  for (const { lines } of [me, them]) lines.pop();
}

const following = () => world.sim.following(me.room.sessionId);

test("/follow starts following an online player, silently, and /unfollow stops it", async () => {
  await say("/follow fothem");
  await vi.waitFor(() => expect(following()).toBe(them.room.sessionId));
  await say("/follow FoThem");
  await say("/unfollow");
  expect(following()).toBeUndefined();
  await say("/unfollow");
  expect(me.lines).toEqual([
    "You are already following FoThem.",
    "You are not following anyone.",
  ]);
  expect(them.lines).toEqual([]);
});

test("each refusal is a private line", async () => {
  await say("/follow");
  await say("/follow Nobody99");
  await say("/follow FoAway");
  await say("/follow FoMe");
  expect(me.lines).toEqual([
    "Usage: /follow <name>",
    "There is no account named Nobody99.",
    "FoAway is not online.",
    "You can't follow yourself.",
  ]);
  expect(them.lines).toEqual([]);
});

test("a target who ignores you can't be followed, and the refusal doesn't say why", async () => {
  them.room.send(CHAT, "/ignore FoMe");
  await vi.waitFor(() =>
    expect(them.lines).toContain("FoMe is now on your ignore list."),
  );
  them.lines.length = 0;
  await say("/follow FoThem");
  expect(me.lines).toEqual(["You can't follow FoThem."]);
  expect(following()).toBeUndefined();
  them.room.send(CHAT, "/unignore FoMe");
});

test("ignoring your follower ends their follow", async () => {
  await say("/follow FoThem");
  await vi.waitFor(() => expect(following()).toBe(them.room.sessionId));
  them.room.send(CHAT, "/ignore FoMe");
  await vi.waitFor(() =>
    expect(them.lines).toContain("FoMe is now on your ignore list."),
  );
  expect(following()).toBeUndefined();
  them.room.send(CHAT, "/unignore FoMe");
  await vi.waitFor(() =>
    expect(them.lines).toContain("FoMe is no longer on your ignore list."),
  );
});

test("a follow queued this tick already counts as following", async () => {
  // No tick, so the first follow stays queued.
  const tick = vi.spyOn(world.sim, "tick").mockImplementation(() => {});
  onTestFinished(() => tick.mockRestore());
  me.room.send(CHAT, "/follow FoThem");
  me.room.send(CHAT, "/follow FoThem");
  await vi.waitFor(() =>
    expect(me.lines).toEqual(["You are already following FoThem."]),
  );
  await say("/unfollow");
});

test("a dead target can't be followed, and the refusal doesn't say why", async () => {
  // No tick, or one would respawn a player killed this way at once.
  const tick = vi.spyOn(world.sim, "tick").mockImplementation(() => {});
  const target = world.sim.state.players.get(them.room.sessionId)!;
  target.dead = true;
  onTestFinished(() => {
    target.dead = false;
    tick.mockRestore();
  });
  await say("/follow FoThem");
  expect(me.lines).toEqual(["You can't follow FoThem."]);
  expect(following()).toBeUndefined();
});

test("a player whose connection dropped is still online to follow and message", async () => {
  const dropped = await joinAs("FoDropped");
  dropped.room.reconnection.enabled = false;
  const { sessionId } = dropped.room;
  // Joined in full first: a connection lost mid-join is a leave, never a drop.
  await vi.waitFor(() =>
    expect((dropped.room.state as any).players?.get(sessionId)).toBeDefined(),
  );
  world.sim.lock(sessionId);
  (world.clients.getById(sessionId)!.ref as any).terminate();
  await vi.waitFor(() =>
    expect(world.clients.getById(sessionId)).toBeUndefined(),
  );
  await say("/pm FoDropped hi");
  await say("/follow FoDropped");
  expect(me.lines).toEqual(["To FoDropped: hi"]);
  await vi.waitFor(() => expect(following()).toBe(sessionId));
  await say("/unfollow");
});
