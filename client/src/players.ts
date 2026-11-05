import { Callbacks, type Room } from "@colyseus/sdk";
import { TICK_MS, WALK_TICKS_PER_TILE, type Tile } from "@runic/shared";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import * as THREE from "three";
import { focusOn, scene } from "./scene.ts";

const SLIDE_MS = WALK_TICKS_PER_TILE * TICK_MS;
const HEIGHT = 1.15;
const RADIUS = 0.25;

const geometry = new THREE.CapsuleGeometry(RADIUS, HEIGHT - 2 * RADIUS);
const ownMaterial = new THREE.MeshLambertMaterial({ color: 0x3a7bd5 });
const otherMaterial = new THREE.MeshLambertMaterial({ color: 0xd5763a });

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

type Figure = {
  player: Tile;
  mesh: THREE.Mesh;
  from: THREE.Vector3;
  to: THREE.Vector3;
  slideStart: number;
};

/** Draws everyone at the tiles the server says, sliding between them. The camera follows our own. */
export function showPlayers(room: WorldConnection) {
  const figures = new Map<string, Figure>();
  const callbacks = Callbacks.get(room);

  // shortcut: a capsule stands in for the player model, until the characters ticket brings KayKit.
  callbacks.onAdd("players", (player, id) => {
    const mesh = new THREE.Mesh(
      geometry,
      id === room.sessionId ? ownMaterial : otherMaterial,
    );
    mesh.castShadow = true;
    mesh.position.set(player.x, HEIGHT / 2, player.y);
    scene.add(mesh);
    figures.set(id, {
      player,
      mesh,
      from: mesh.position.clone(),
      to: mesh.position.clone(),
      slideStart: 0,
    });
  });
  callbacks.onRemove("players", (_, id) => {
    scene.remove(figures.get(id)!.mesh);
    figures.delete(id);
  });

  const frame = (now: number) => {
    for (const figure of figures.values()) {
      const { player, mesh, from, to } = figure;
      if (player.x !== to.x || player.y !== to.z) {
        from.copy(mesh.position);
        to.set(player.x, to.y, player.y);
        figure.slideStart = now;
      }
      mesh.position.lerpVectors(
        from,
        to,
        Math.min((now - figure.slideStart) / SLIDE_MS, 1),
      );
    }
    const own = figures.get(room.sessionId)?.mesh.position;
    if (own) focusOn(own.x, own.z);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
