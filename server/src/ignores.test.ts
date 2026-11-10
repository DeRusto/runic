import { matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT,
  FRIENDS,
  IGNORES,
  PRIVATE_LINE,
  WORLD_ROOM,
  type ChatLine,
  type Friend,
} from "@runic/shared";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";

const PORT = 55000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;

/** A logged-in player, every chat-box line they have received, and the last lists sent to them. */
type Player = {
  room: Room;
  lines: string[];
  friends?: Friend[];
  ignores?: string[];
};
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
  room.onMessage(FRIENDS, (friends: Friend[]) => (player.friends = friends));
  room.onMessage(IGNORES, (ignores: string[]) => (player.ignores = ignores));
  room.send(FRIENDS);
  room.send(IGNORES);
  return player;
}

let me: Player;
let pest: Player;
let bystander: Player;

beforeAll(async () => {
  server = await startServer(PORT);
  // An account that exists but is never online.
  await testToken(PORT, "IgAway");
  me = await joinAs("IgMe");
  pest = await joinAs("IgPest");
  bystander = await joinAs("IgBystander");
});
afterAll(() => server.gracefullyShutdown(false));
beforeEach(() => {
  for (const { lines } of [me, pest, bystander]) lines.length = 0;
});

/** Sends `line` as `from`, then a public marker from the bystander, so everyone's lines are complete once it arrives. */
async function send(from: Player, line: string) {
  from.room.send(CHAT, line);
  bystander.room.send(CHAT, "marker");
  await vi.waitFor(() => {
    for (const { lines } of [me, pest, bystander])
      expect(lines.at(-1)).toBe("IgBystander: marker");
  });
  for (const { lines } of [me, pest, bystander]) lines.pop();
}
const say = (line: string) => send(me, line);

test("a new player's ignore list arrives empty", async () => {
  await vi.waitFor(() => expect(bystander.ignores).toEqual([]));
});

test("an ignored player's public chat and PMs never reach you, and they are not told", async () => {
  await say("/ignore igPEST");
  expect(me.lines).toEqual(["IgPest is now on your ignore list."]);
  expect(me.ignores).toEqual(["IgPest"]);
  expect(pest.lines).toEqual([]);

  await send(pest, "hello all");
  await send(pest, "/pm IgMe psst");
  expect(me.lines).toEqual(["IgPest is now on your ignore list."]);
  expect(pest.lines).toEqual(["IgPest: hello all", "To IgMe: psst"]);
  expect(bystander.lines).toEqual(["IgPest: hello all"]);

  await say("/unignore IgPest");
  expect(me.ignores).toEqual([]);
  me.lines.length = 0;
  await send(pest, "back again");
  await send(pest, "/pm IgMe hi");
  expect(me.lines).toEqual(["IgPest: back again", "From IgPest: hi"]);
});

test("ignoring is one-sided: you still reach the player you ignore", async () => {
  await say("/ignore IgPest");
  await say("hello");
  await say("/pm IgPest hi");
  expect(pest.lines).toEqual(["IgMe: hello", "From IgMe: hi"]);
  await say("/unignore IgPest");
});

test("ignoring a friend takes them off the friends list, and unignoring leaves them off", async () => {
  await say("/friend IgAway");
  await say("/ignore IgAway");
  expect(me.friends).toEqual([]);
  expect(me.ignores).toEqual(["IgAway"]);
  await say("/unignore IgAway");
  expect(me.friends).toEqual([]);
});

test("the list survives logging out and back in", async () => {
  await say("/ignore IgAway");
  const live = matchMaker.getLocalRoomById(me.room.roomId) as WorldRoom;
  await me.room.leave();
  await vi.waitFor(() =>
    expect(live.clients.getById(me.room.sessionId)).toBeUndefined(),
  );
  me = await joinAs("IgMe");
  await vi.waitFor(() => expect(me.ignores).toEqual(["IgAway"]));
  await say("/unignore IgAway");
});

test.each([
  ["/ignore Nobody", "There is no account named Nobody."],
  ["/unignore Nobody", "There is no account named Nobody."],
  ["/ignore IgMe", "You can't add yourself to your ignore list."],
  ["/ignore", "Usage: /ignore <name>"],
  ["/unignore", "Usage: /unignore <name>"],
  ["/unignore IgAway", "IgAway is not on your ignore list."],
])("%j changes nothing and tells only the sender why", async (line, error) => {
  await say(line);
  expect(me.lines).toEqual([error]);
  expect([...pest.lines, ...bystander.lines]).toEqual([]);
});

test("ignoring someone already on the list says so", async () => {
  await say("/ignore IgAway");
  await say("/ignore IgAway");
  expect(me.lines.at(-1)).toBe("IgAway is already on your ignore list.");
  await say("/unignore IgAway");
});
