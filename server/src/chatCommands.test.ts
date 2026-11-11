import { matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT,
  MAX_CHAT_LENGTH,
  PRIVATE_LINE,
  WORLD_ROOM,
  type ChatLine,
} from "@runic/shared";
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

const PORT = 45000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;

/** A logged-in player and every chat-box line they have received, public and private. */
type Player = { room: Room; lines: string[] };
let sender: Player;
let target: Player;
let bystander: Player;

async function joinAs(name: string): Promise<Player> {
  const client = new Client(`http://localhost:${PORT}`);
  client.auth.token = await testToken(PORT, name);
  const room = await client.join(WORLD_ROOM);
  const lines: string[] = [];
  room.onMessage(CHAT, ({ username, text }: ChatLine) =>
    lines.push(`${username}: ${text}`),
  );
  room.onMessage(PRIVATE_LINE, (line: string) => lines.push(line));
  return { room, lines };
}

beforeAll(async () => {
  server = await startServer(PORT);
  sender = await joinAs("PmSender");
  target = await joinAs("PmTarget");
  bystander = await joinAs("PmBystander");
});
afterAll(() => server.gracefullyShutdown(false));
beforeEach(() => {
  for (const { lines } of [sender, target, bystander]) lines.length = 0;
});

/** Sends `line` from the sender, then a public marker everyone hears, so each player's lines are complete once it arrives. */
async function say(line: unknown) {
  sender.room.send(CHAT, line);
  sender.room.send(CHAT, "marker");
  await vi.waitFor(() => {
    for (const { lines } of [sender, target, bystander])
      expect(lines.at(-1)).toBe("PmSender: marker");
  });
  for (const { lines } of [sender, target, bystander]) lines.pop();
}

test("a private message reaches only its target, and the sender sees their copy", async () => {
  await say("/pm PmTarget  meet at the furnace ");
  expect(target.lines).toEqual(["From PmSender: meet at the furnace"]);
  expect(sender.lines).toEqual(["To PmTarget: meet at the furnace"]);
  expect(bystander.lines).toEqual([]);
});

test("the target's name matches in any case, and the copy shows its real case", async () => {
  await say("/pm pmtarget hi");
  expect(target.lines).toEqual(["From PmSender: hi"]);
  expect(sender.lines).toEqual(["To PmTarget: hi"]);
});

test("the command name matches in any case", async () => {
  await say("/PM PmTarget hi");
  expect(target.lines).toEqual(["From PmSender: hi"]);
});

test.each([
  ["/dance", "Unknown command: /dance"],
  ["/", "Unknown command: /"],
  ["/pm", "Usage: /pm <name> <message>"],
  ["/pm PmTarget", "Usage: /pm <name> <message>"],
  ["/pm PmTarget    ", "Usage: /pm <name> <message>"],
  ["/pm Nobody hi", "Nobody is not online."],
  ["/pm PmSender hi", "You can't send a private message to yourself."],
])("%j sends nothing and tells only the sender why", async (line, error) => {
  await say(line);
  expect(sender.lines).toEqual([error]);
  expect(target.lines).toEqual([]);
  expect(bystander.lines).toEqual([]);
});

test("the limit counts a private message's text, not the command before it", async () => {
  const longest = "x".repeat(MAX_CHAT_LENGTH);
  await say(`/pm PmTarget ${longest}`);
  expect(target.lines).toEqual([`From PmSender: ${longest}`]);
});

test("a private message over the limit is dropped like public chat", async () => {
  await say(`/pm PmTarget ${"x".repeat(MAX_CHAT_LENGTH + 1)}`);
  expect([...sender.lines, ...target.lines]).toEqual([]);
});

test("a dead player can still send a private message", async () => {
  const { sim } = matchMaker.getLocalRoomById(sender.room.roomId) as WorldRoom;
  // No tick, or one would respawn a player killed this way at once.
  const tick = vi.spyOn(sim, "tick").mockImplementation(() => {});
  const me = sim.state.players.get(sender.room.sessionId)!;
  me.dead = true;
  onTestFinished(() => {
    me.dead = false;
    tick.mockRestore();
  });
  await say("/pm PmTarget boo");
  expect(target.lines).toEqual(["From PmSender: boo"]);
});

/** Spec §2's `/help` lines, in order. */
const HELP = [
  "/e <text>: Act something out, shown in bold to everyone as your name then the text.",
  "/follow <name>: Walk after an online player.",
  "/friend <name>: Add an account to your friends list.",
  "/help: List every chat command.",
  "/ignore <name>: Add an account to your ignore list.",
  "/pm <name> <message>: Send a private message to an online player.",
  "/r <message>: Reply to the last player who sent you a private message.",
  "/unfollow: Stop following.",
  "/unfriend <name>: Take an account off your friends list.",
  "/unignore <name>: Take an account off your ignore list.",
  "/who: List every online player.",
];
// `/e` and `/r` land in their own tickets; each line must appear once its command does.
const NOT_YET_BUILT = ["/e ", "/r "];

test("/help tells only the sender every command, in order, ignoring what follows", async () => {
  await say("/HELP me please");
  expect(sender.lines).toEqual(
    HELP.filter(
      (line) =>
        sender.lines.includes(line) ||
        !NOT_YET_BUILT.some((start) => line.startsWith(start)),
    ),
  );
  expect([...target.lines, ...bystander.lines]).toEqual([]);
});

test("/who tells only the sender everyone online by name ignoring case, a dropped player held by a combat lock included", async () => {
  const held = await joinAs("pmHeld");
  const world = matchMaker.getLocalRoomById(held.room.roomId) as WorldRoom;
  // Until the client has its player, a drop leaves at once instead of being held.
  await vi.waitFor(() =>
    expect(
      (held.room.state as any).players?.get(held.room.sessionId),
    ).toBeDefined(),
  );
  world.sim.lock(held.room.sessionId);
  // The connection dies with no close handshake, as when the network goes.
  (world.clients.getById(held.room.sessionId)!.ref as any).terminate();
  await vi.waitFor(() =>
    expect(world.clients.getById(held.room.sessionId)).toBeUndefined(),
  );
  await say("/WHO is here");
  expect(sender.lines).toEqual([
    "Online (4): PmBystander, pmHeld, PmSender, PmTarget",
  ]);
  expect([...target.lines, ...bystander.lines]).toEqual([]);
});

test("an ignored player still shows in /who", async () => {
  await say("/ignore PmTarget");
  onTestFinished(() => say("/unignore PmTarget"));
  sender.lines.length = 0;
  await say("/who");
  expect(sender.lines[0]).toContain("PmTarget");
});
