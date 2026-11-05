import { fileURLToPath } from "node:url";
import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WORLD_ROOM } from "@runic/shared";
import express from "express";
import { accountRoutes } from "./accounts.ts";
import { openDatabase } from "./db.ts";
import { WorldRoom } from "./WorldRoom.ts";

const BUILT_CLIENT = fileURLToPath(
  new URL("../../client/dist", import.meta.url),
);

export async function startServer(port: number, builtClient = BUILT_CLIENT) {
  for (const name of ["JWT_SECRET", "INVITE_CODE"]) {
    if (!process.env[name]) throw new Error(`${name} must be set`);
  }
  const database = await openDatabase();
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
    // Router endpoints are tried first, so this only sees what /api and /matchmake don't take.
    express: (app) => void app.use(express.static(builtClient)),
  });
  server.router = accountRoutes;
  server.onShutdown(() => database.shutdown());
  server.define(WORLD_ROOM, WorldRoom);
  await server.listen(port);
  await matchMaker.createRoom(WORLD_ROOM, {});
  return server;
}
