import { Callbacks } from "@colyseus/sdk";
import { type EnemyKind, type EnemyState } from "@runic/shared";
import * as THREE from "three";
import { eliteNameOf, ENEMY_LOOKS, type Figure } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

export const enemyFigures = new Map<string, Figure>();
export const enemyOverheads = new Map<string, Overhead>();

const thornShape = new THREE.ConeGeometry(0.055, 0.38, 4);
const thornColor = new THREE.MeshBasicMaterial({ color: 0xc0a34f });
const thornAxis = new THREE.Vector3(0, 1, 0);
const THORN_FLIGHT_MS = 300;

/** Draws a Thornling shot after its windup. The server has already resolved the hit. */
export function showThorn(
  enemy: THREE.Object3D,
  target: THREE.Object3D,
  contactMs: number,
) {
  const from = enemy.position.clone().add(new THREE.Vector3(0, 0.36, 0));
  const to = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const thorn = new THREE.Mesh(thornShape, thornColor);
  const impactAt = performance.now() + contactMs;

  function fly(now: number) {
    const progress = 1 - (impactAt - now) / THORN_FLIGHT_MS;
    if (progress >= 1 || !enemy.parent || !target.parent) {
      thorn.removeFromParent();
      return;
    }
    if (progress >= 0) {
      if (!thorn.parent) scene.add(thorn);
      to.copy(target.position);
      to.y += 0.65;
      thorn.position.lerpVectors(from, to, progress);
      thorn.quaternion.setFromUnitVectors(
        thornAxis,
        direction.subVectors(to, from).normalize(),
      );
    }
    requestAnimationFrame(fly);
  }

  requestAnimationFrame(fly);
}

// Enemy Expansion spec §7. Keep the atlas detail visible under the tint.
const ELITE_SIZE_MULTIPLIER = 1.2;
const ELITE_TINT = new THREE.Color(0xa272ff);
const ELITE_TINT_STRENGTH = 0.55;

/** Enemy figures own their materials, so a tint affects only the figure that returned. */
function watchEliteAppearance(figure: Figure) {
  const colors = new Map<THREE.Color, THREE.Color>();
  figure.model.traverse((object) => {
    if (
      object instanceof THREE.Mesh &&
      object.material instanceof THREE.MeshStandardMaterial
    ) {
      const { color } = object.material;
      colors.set(color, color.clone());
    }
  });
  let wasElite = false;
  return (elite: boolean) => {
    if (elite === wasElite) return;
    wasElite = elite;
    figure.setSizeMultiplier(elite ? ELITE_SIZE_MULTIPLIER : 1);
    for (const [color, base] of colors) {
      color.copy(base);
      if (elite) color.lerp(ELITE_TINT, ELITE_TINT_STRENGTH);
    }
  };
}

/** Draws every enemy, and returns what finds the live enemy under a click's ray. */
export function showEnemies(
  room: WorldConnection,
  newFigure: Record<EnemyKind, (tile: { x: number; y: number }) => Figure>,
) {
  const figures: {
    id: string;
    figure: Figure;
    hitBox: THREE.Mesh;
    showEliteAppearance: ReturnType<typeof watchEliteAppearance>;
  }[] = [];
  const hitBoxes = new Map<
    THREE.Object3D,
    {
      id: string;
      tile: {
        x: number;
        y: number;
        state: EnemyState;
        kind: EnemyKind;
        elite: boolean;
      };
    }
  >();

  Callbacks.get(room).onAdd("enemies", (enemy, id) => {
    const figure = newFigure[enemy.kind](enemy);
    scene.add(figure.model);
    // A plain box, not the skinned mesh, so a click between the legs still counts.
    const hitBox = newHitBox();
    const showEliteAppearance = watchEliteAppearance(figure);
    showEliteAppearance(enemy.elite);
    figures.push({ id, figure, hitBox, showEliteAppearance });
    hitBoxes.set(hitBox, {
      id,
      tile: enemy,
    });
    if (enemy.state === "dead")
      figure.alreadyGone(ENEMY_LOOKS[enemy.kind].death);
    enemyFigures.set(id, figure);
    enemyOverheads.set(id, new Overhead(""));
  });

  const frame = (now: number) => {
    for (const { id, figure, hitBox, showEliteAppearance } of figures) {
      const enemy = room.state.enemies.get(id)!;
      const size = enemy.elite ? ELITE_SIZE_MULTIPLIER : 1;
      showEliteAppearance(enemy.elite);
      figure.fightTile = room.state.players.get(enemy.target);
      figure.update(now);
      hitBox.scale.y = size;
      hitBox.position
        .copy(figure.model.position)
        .setY((HIT_BOX_HEIGHT * size) / 2);
      const overhead = enemyOverheads.get(id)!;
      overhead.showHealth(enemy.health, enemy.maxHealth);
      overhead.place(figure.model.position, size);
    }
    nextFrame = requestAnimationFrame(frame);
  };
  let nextFrame = requestAnimationFrame(frame);

  room.onLeave(() => {
    cancelAnimationFrame(nextFrame);
    for (const { figure, hitBox } of figures)
      scene.remove(figure.model, hitBox);
    for (const overhead of enemyOverheads.values()) overhead.remove();
    enemyFigures.clear();
    enemyOverheads.clear();
  });

  return (
    raycaster: THREE.Raycaster,
  ):
    | {
        id: string;
        tile: { x: number; y: number; state: EnemyState };
        name?: string;
      }
    | undefined => {
    const live = [...hitBoxes.keys()].filter(
      (box) => hitBoxes.get(box)!.tile.state !== "dead",
    );
    const hit = raycaster.intersectObjects(live)[0];
    const enemy = hit && hitBoxes.get(hit.object);
    if (!enemy) return undefined;
    const { id, tile } = enemy;
    const name = tile.elite
      ? eliteNameOf(tile.kind)
      : ENEMY_LOOKS[tile.kind].name;
    return { id, tile, name };
  };
}
