import { createServer } from "node:net";
import { Server } from "@colyseus/core";
import { GameDatabase } from "@colyseus/database";
import { afterEach, expect, test, vi } from "vitest";
import { startServer } from "./server.ts";
import { freePort } from "./testToken.ts";
import { WorldRoom } from "./WorldRoom.ts";

// Its own file: cleaning up a half-started server shuts the process-wide matchmaker down.

afterEach(() => vi.restoreAllMocks());

/** Whether something can bind the port now, so nothing is still listening on it. */
async function portIsFree(port: number) {
  const probe = createServer();
  return new Promise<boolean>((resolve) => {
    probe.once("error", () => resolve(false));
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

test("a failed listen closes the database it opened", async () => {
  const error = Object.assign(new Error("listen failed"), {
    code: "EADDRINUSE",
  });
  vi.spyOn(Server.prototype, "listen").mockRejectedValueOnce(error);
  const shutdown = vi.spyOn(GameDatabase.prototype, "shutdown");
  await expect(startServer(await freePort())).rejects.toBe(error);
  expect(shutdown).toHaveBeenCalledOnce();
});

test("a world room that fails to open closes the listener and the database", async () => {
  const port = await freePort();
  const error = new Error("world room failed");
  vi.spyOn(WorldRoom.prototype, "onCreate").mockImplementationOnce(() => {
    throw error;
  });
  const shutdown = vi.spyOn(GameDatabase.prototype, "shutdown");
  await expect(startServer(port)).rejects.toThrow("world room failed");
  expect(shutdown).toHaveBeenCalledOnce();
  expect(await portIsFree(port)).toBe(true);
});
