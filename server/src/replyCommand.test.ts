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

const PORT = 35000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;

/** A logged-in player and every chat-box line they have received. */
type Player = { name: string; room: Room; lines: string[] };

/** Registering twice fails, so a player who logs back in reuses their token. */
const tokens = new Map<string, string>();

async function joinAs(name: string): Promise<Player> {
  const client = new Client(`http://localhost:${PORT}`);
  if (!tokens.has(name)) tokens.set(name, await testToken(PORT, name));
  client.auth.token = tokens.get(name)!;
  const room = await client.join(WORLD_ROOM);
  const player: Player = { name, room, lines: [] };
  room.onMessage(CHAT, ({ username, text }: ChatLine) =>
    player.lines.push(`${username}: ${text}`),
  );
  room.onMessage(PRIVATE_LINE, (line: string) => player.lines.push(line));
  return player;
}

let me: Player;
let first: Player;
let second: Player;

beforeAll(async () => {
  server = await startServer(PORT);
  me = await joinAs("ReMe");
  first = await joinAs("ReFirst");
  second = await joinAs("ReSecond");
});
afterAll(() => server.gracefullyShutdown(false));
beforeEach(() => {
  for (const { lines } of [me, first, second]) lines.length = 0;
});

/** Sends `line` from `from`, then a public marker, so every listener's lines are complete once it arrives. */
async function say(
  from: Player,
  line: string,
  listeners = [me, first, second],
) {
  from.room.send(CHAT, line);
  from.room.send(CHAT, "marker");
  const marker = `${from.name}: marker`;
  await vi.waitFor(() => {
    for (const { lines } of listeners) expect(lines.at(-1)).toBe(marker);
  });
  for (const { lines } of listeners) lines.pop();
}

/** Logs the player out for good: a consented leave holds no lock. */
const leave = (player: Player) => player.room.leave(true);

test("/r replies to the last player whose private message reached me", async () => {
  await say(first, "/pm ReMe hello");
  await say(me, "/r  hi back ");
  expect(first.lines).toEqual(["To ReMe: hello", "From ReMe: hi back"]);
  expect(me.lines).toEqual(["From ReFirst: hello", "To ReFirst: hi back"]);
  expect(second.lines).toEqual([]);
});

test("a later private message changes who /r replies to", async () => {
  await say(first, "/pm ReMe one");
  await say(second, "/pm ReMe two");
  await say(me, "/R reply");
  expect(second.lines.at(-1)).toBe("From ReMe: reply");
  expect(first.lines).toEqual(["To ReMe: one"]);
});

test("my own private message leaves the reply target alone", async () => {
  await say(first, "/pm ReMe one");
  await say(me, "/pm ReSecond aside");
  await say(me, "/r reply");
  expect(first.lines.at(-1)).toBe("From ReMe: reply");
  expect(second.lines).toEqual(["From ReMe: aside"]);
});

test("a private message dropped because I ignore its sender doesn't set the reply target", async () => {
  await say(first, "/pm ReMe one");
  await say(me, "/ignore ReSecond");
  onTestFinished(() => say(me, "/unignore ReSecond"));
  // Ignoring hides their public marker from me too.
  await say(second, "/pm ReMe hidden", [first, second]);
  await say(me, "/r reply");
  expect(first.lines.at(-1)).toBe("From ReMe: reply");
  expect(second.lines).toEqual(["To ReMe: hidden"]);
});

test("/r with no message gives its usage", async () => {
  await say(first, "/pm ReMe one");
  await say(me, "/r");
  await say(me, "/r    ");
  expect(me.lines.slice(1)).toEqual([
    "Usage: /r <message>",
    "Usage: /r <message>",
  ]);
  expect(first.lines).toEqual(["To ReMe: one"]);
});

test("/r to a player who has logged out says they are not online", async () => {
  const gone = await joinAs("ReGone");
  await say(gone, "/pm ReMe bye", [me, gone]);
  await leave(gone);
  await say(me, "/r wait");
  expect(me.lines).toEqual(["From ReGone: bye", "ReGone is not online."]);
});

test("a fresh login has nobody to reply to", async () => {
  let fresh = await joinAs("ReFresh");
  await say(fresh, "/r hi", [fresh]);
  expect(fresh.lines).toEqual(["You have nobody to reply to."]);

  await say(me, "/pm ReFresh hello", [me, fresh]);
  await leave(fresh);
  fresh = await joinAs("ReFresh");
  await say(fresh, "/r hi", [fresh]);
  expect(fresh.lines).toEqual(["You have nobody to reply to."]);
  await leave(fresh);
});
