import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@colyseus/sdk";
import { WORLD_ROOM } from "@runic/shared";
import { afterAll, beforeAll, expect, test } from "vitest";
import { startServer } from "./server.ts";
import { testToken } from "./testToken.ts";

const PORT = 35000 + (process.pid % 5000);
const ORIGIN = `http://localhost:${PORT}`;
const built = mkdtempSync(join(tmpdir(), "runic-built-"));
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  writeFileSync(join(built, "index.html"), "<title>built client</title>");
  writeFileSync(join(built, "version.txt"), "build-7");
  server = await startServer(PORT, built);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
  rmSync(built, { recursive: true, force: true });
});

test("the built client is served from the root", async () => {
  const page = await fetch(ORIGIN);
  expect(page.headers.get("content-type")).toContain("text/html");
  expect(await page.text()).toContain("built client");
  expect(await (await fetch(`${ORIGIN}/version.txt`)).text()).toBe("build-7");
});

test("/api and the websocket share that origin", async () => {
  const client = new Client(ORIGIN);
  client.auth.token = await testToken(PORT, "SameOrigin");
  const room = await client.join(WORLD_ROOM);
  expect(room.sessionId).toBeTruthy();
  await room.leave();
});

test("a path outside the build is a 404, not the Colyseus banner", async () => {
  expect((await fetch(`${ORIGIN}/nothing-here`)).status).toBe(404);
});
