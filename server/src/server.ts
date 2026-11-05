import { matchMaker, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WORLD_ROOM } from "@runic/shared";
import { WorldRoom } from "./WorldRoom.ts";

export async function startServer(port: number) {
  const server = new Server({
    transport: new WebSocketTransport(),
    greet: false,
  });
  server.define(WORLD_ROOM, WorldRoom);
  await server.listen(port);
  await matchMaker.createRoom(WORLD_ROOM, {});
  return server;
}
