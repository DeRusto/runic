import { matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT,
  FRIENDS_LIST,
  LIST_FRIENDS_INTENT,
  PRIVATE_LINE,
  WORLD_ROOM,
  type ChatLine,
  type Friend,
} from "@runic/shared";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";

const PORT = 50000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;

/** A logged-in player, every chat-box line they have received, and the last friends list sent to them. */
type Player = { room: Room; lines: string[]; friends?: Friend[] };
const tokens = new Map<string, string>();

async function joinAs(name: string): Promise<Player> {
  const client = new Client(`http://localhost:${PORT}`);
  if (!tokens.has(name)) tokens.set(name, await testToken(PORT, name));
  client.auth.token = tokens.get(name)!;
  const room = await client.join(WORLD_ROOM);
  const player: Player = { room, lines: [] };
  room.onMessage(CHAT, ({ username, text }: ChatLine) =>
    player.lines.push(`${username}: ${text}`),
  );
  room.onMessage(PRIVATE_LINE, (line: string) => player.lines.push(line));
  room.onMessage(
    FRIENDS_LIST,
    (friends: Friend[]) => (player.friends = friends),
  );
  room.send(LIST_FRIENDS_INTENT);
  return player;
}

async function logOut({ room }: Player) {
  const live = matchMaker.getLocalRoomById(room.roomId) as WorldRoom;
  await room.leave();
  await vi.waitFor(() =>
    expect(live.clients.getById(room.sessionId)).toBeUndefined(),
  );
}

let me: Player;
let pal: Player;
let bystander: Player;

beforeAll(async () => {
  server = await startServer(PORT);
  // An account that exists but is never online.
  await testToken(PORT, "FrAway");
  me = await joinAs("FrMe");
  pal = await joinAs("FrPal");
  bystander = await joinAs("FrBystander");
});
afterAll(() => server.gracefullyShutdown(false));
beforeEach(() => {
  for (const { lines } of [me, pal, bystander]) lines.length = 0;
});

/** Sends `line` as FrMe, then a public marker everyone hears, so each player's lines are complete once it arrives. */
async function say(line: string) {
  me.room.send(CHAT, line);
  me.room.send(CHAT, "marker");
  await vi.waitFor(() => {
    for (const { lines } of [me, pal, bystander])
      expect(lines.at(-1)).toBe("FrMe: marker");
  });
  for (const { lines } of [me, pal, bystander]) lines.pop();
}

test("a new player's friends list arrives empty", async () => {
  await vi.waitFor(() => expect(bystander.friends).toEqual([]));
});

test("/friend adds an offline account silently, and the list shows it offline", async () => {
  await say("/friend frAWAY");
  expect(me.lines).toEqual(["FrAway is now on your friends list."]);
  expect(me.friends).toEqual([{ username: "FrAway", online: false }]);
  expect([...pal.lines, ...bystander.lines]).toEqual([]);
  await say("/unfriend FrAway");
});

test("a friend's logout and login reach only the players who added them", async () => {
  await say("/friend FrPal");
  expect(me.friends).toEqual([{ username: "FrPal", online: true }]);
  expect(pal.lines).toEqual([]);

  me.lines.length = 0;
  await logOut(pal);
  await vi.waitFor(() => expect(me.lines).toEqual(["FrPal has logged out"]));
  expect(me.friends).toEqual([{ username: "FrPal", online: false }]);

  pal = await joinAs("FrPal");
  await vi.waitFor(() =>
    expect(me.lines).toEqual(["FrPal has logged out", "FrPal has logged in"]),
  );
  expect(me.friends).toEqual([{ username: "FrPal", online: true }]);
  expect(bystander.lines).toEqual([]);
  await say("/unfriend FrPal");
});

test("a friend logging in again from elsewhere tells you nothing", async () => {
  await say("/friend FrPal");
  me.lines.length = 0;
  pal = await joinAs("FrPal");
  await say("marker2");
  expect(me.lines).toEqual(["FrMe: marker2"]);
  expect(me.friends).toEqual([{ username: "FrPal", online: true }]);
  await say("/unfriend FrPal");
});

test("/unfriend removes them, and their logins stop reaching you", async () => {
  await say("/friend FrPal");
  await say("/unfriend frpal");
  expect(me.lines.at(-1)).toBe("FrPal is no longer on your friends list.");
  expect(me.friends).toEqual([]);
  me.lines.length = 0;
  await logOut(pal);
  pal = await joinAs("FrPal");
  await say("marker2");
  expect(me.lines).toEqual(["FrMe: marker2"]);
});

test("the list survives logging out and back in", async () => {
  await say("/friend FrAway");
  await logOut(me);
  me = await joinAs("FrMe");
  await vi.waitFor(() =>
    expect(me.friends).toEqual([{ username: "FrAway", online: false }]),
  );
  await say("/unfriend FrAway");
});

test.each([
  ["/friend Nobody", "There is no account named Nobody."],
  ["/unfriend Nobody", "There is no account named Nobody."],
  ["/friend FrMe", "You can't add yourself to your friends list."],
  ["/friend", "Usage: /friend <name>"],
  ["/unfriend", "Usage: /unfriend <name>"],
  ["/unfriend FrAway", "FrAway is not on your friends list."],
])("%j changes nothing and tells only the sender why", async (line, error) => {
  await say(line);
  expect(me.lines).toEqual([error]);
  expect([...pal.lines, ...bystander.lines]).toEqual([]);
});

test("adding someone already on the list says so", async () => {
  await say("/friend FrAway");
  await say("/friend FrAway");
  expect(me.lines.at(-1)).toBe("FrAway is already on your friends list.");
  await say("/unfriend FrAway");
});
