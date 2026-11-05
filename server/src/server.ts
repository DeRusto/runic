import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WORLD_ROOM } from "@runic/shared";
import { accountRoutes } from "./accounts.ts";
import { openDatabase } from "./db.ts";
import { WorldRoom } from "./WorldRoom.ts";

export async function startServer(port: number) {
  for (const name of ["JWT_SECRET", "INVITE_CODE"]) {
    if (!process.env[name]) throw new Error(`${name} must be set`);
  }
  const database = await openDatabase();
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
  });
  server.router = accountRoutes;
  server.onShutdown(() => database.shutdown());
  server.define(WORLD_ROOM, WorldRoom);
  await server.listen(port);
  await matchMaker.createRoom(WORLD_ROOM, {});
  return server;
}
