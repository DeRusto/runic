import { matchMaker } from "@colyseus/core";
import { Client, type Room } from "@colyseus/sdk";
import {
  CHAT,
  MAX_CHAT_LENGTH,
  WORLD_ROOM,
  type ChatLine,
} from "@runic/shared";
import { afterAll, beforeAll, expect, onTestFinished, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";
import type { WorldRoom } from "./WorldRoom.ts";

const PORT = 35000 + (process.pid % 5000);
let server: Awaited<ReturnType<typeof startServer>>;
let speaker: Room;
let listener: Room;
const heard: ChatLine[] = [];

async function joinAs(name: string) {
  const client = new Client(`http://localhost:${PORT}`);
  client.auth.token = await testToken(PORT, name);
  return client.join(WORLD_ROOM);
}

beforeAll(async () => {
  server = await startServer(PORT);
  speaker = await joinAs("Speaker");
  listener = await joinAs("Listener");
  listener.onMessage(CHAT, (line: ChatLine) => heard.push(line));
});
afterAll(() => server.gracefullyShutdown(false));

/** A marker follows `payload`, so whatever the server let through has arrived once it has. */
async function heardFrom(payload: unknown) {
  heard.length = 0;
  speaker.send(CHAT, payload);
  speaker.send(CHAT, "marker");
  await vi.waitFor(() => expect(heard.at(-1)?.text).toBe("marker"));
  return heard.slice(0, -1).map((line) => line.text);
}

test("a chat line reaches other players trimmed, with who said it", async () => {
  heard.length = 0;
  speaker.send(CHAT, "  hello there \n");
  await vi.waitFor(() => expect(heard).toHaveLength(1));
  expect(heard[0]).toEqual({
    id: speaker.sessionId,
    username: "Speaker",
    text: "hello there",
    emote: false,
  });
});

test("the speaker hears their own line", async () => {
  const own: string[] = [];
  const unbind = speaker.onMessage(CHAT, (line: ChatLine) =>
    own.push(line.text),
  );
  speaker.send(CHAT, "echo");
  await vi.waitFor(() => expect(own).toEqual(["echo"]));
  unbind();
});

test("a chat line needs no tick to arrive", async () => {
  const { sim } = matchMaker.getLocalRoomById(listener.roomId) as WorldRoom;
  const held = vi.spyOn(sim, "tick").mockImplementation(() => {});
  onTestFinished(() => held.mockRestore());
  expect(await heardFrom("quick")).toEqual(["quick"]);
});

test("the limit counts the trimmed length", async () => {
  const longest = "x".repeat(MAX_CHAT_LENGTH);
  expect(await heardFrom(`  ${longest}  `)).toEqual([longest]);
});

test("a line over the limit is dropped, not cut", async () => {
  expect(await heardFrom("x".repeat(MAX_CHAT_LENGTH + 1))).toEqual([]);
});

test.each([[""], ["   "], [null], [42], [{ text: "hi" }], [["hi"]]])(
  "garbage is dropped: %j",
  async (payload) => {
    expect(await heardFrom(payload)).toEqual([]);
  },
);

test("everyone sees a player's username and what the bottom bar reads", async () => {
  await vi.waitFor(() => {
    const seen = (listener.state as any).players.get(speaker.sessionId);
    expect(seen.username).toBe("Speaker");
    expect(seen.hitpointsXp).toBe(4050);
    expect(seen.health).toBe(1000);
    expect(seen.maxHealth).toBe(1000);
    expect(seen.inventory).toHaveLength(30);
  });
});
