import {
  OBSTACLES,
  obstacleLanding,
  type ObstacleKind,
  type Tile,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { propClicks } from "./propClicks.ts";
import { scene } from "./scene.ts";

const wood = new THREE.MeshStandardMaterial({ color: 0x865333 });
const rail = new THREE.MeshStandardMaterial({ color: 0xcc9d5a });
const stone = new THREE.MeshStandardMaterial({ color: 0x828b87 });
const startMat = new THREE.MeshStandardMaterial({ color: 0xe6c976 });
/** What a click on an obstacle finds: the obstacle, its placed start, and a shortcut's far end. */
type ObstacleTarget = { obstacle: ObstacleKind; start: Tile; far?: Tile };
const charred = new THREE.MeshStandardMaterial({ color: 0x2e2622 });
const rope = new THREE.MeshStandardMaterial({ color: 0xd8c08a });

/** Draws each obstacle along its crossing direction and makes the whole prop clickable. */
export function addObstacles(tiles: TileKind[][]) {
  const clicks = propClicks<ObstacleTarget>();

  tiles.forEach((row, y) =>
    row.forEach(({ obstacle }, x) => {
      if (!obstacle) return;
      const landing = obstacleLanding(obstacle, { x, y });
      const group = new THREE.Group();
      group.position.set(x, 0, y);
      group.rotation.y = Math.atan2(landing.x - x, landing.y - y);
      const length = Math.hypot(landing.x - x, landing.y - y);

      // A shortcut is crossed from either end, so a click marks the end nearer it.
      const target: ObstacleTarget = {
        obstacle,
        start: { x, y },
        far: OBSTACLES[obstacle].shortcut ? landing : undefined,
      };
      // Its own tiles: the start, the landing and every tile between, gaps included.
      const ownTiles = Array.from({ length: length + 1 }, (_, step) => ({
        x: x + ((landing.x - x) / length) * step,
        y: y + ((landing.y - y) / length) * step,
      }));
      clicks.add(target, ownTiles, group);

      const box = (
        width: number,
        height: number,
        depth: number,
        z: number,
        material: THREE.Material,
        atHeight = height / 2,
        side = 0,
      ) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(width, height, depth),
          material,
        );
        mesh.position.set(side, atHeight, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      };

      box(0.82, 0.04, 0.65, 0, startMat);
      // A shortcut is crossed from either end, so both ends are marked (Agility spec §3).
      if (OBSTACLES[obstacle].shortcut) box(0.82, 0.04, 0.65, length, startMat);
      /** Two posts at the ends and a line slung between them at `height`. */
      const line = (height: number, material: THREE.Material) => {
        for (const at of [0.35, length - 0.35])
          box(0.14, height + 0.1, 0.14, at, wood, (height + 0.1) / 2);
        box(0.05, 0.05, length - 0.7, length / 2, material, height);
      };
      switch (obstacle) {
        case "ridgeStile":
          for (const at of [0.45, length - 0.45])
            box(0.6, 0.3, 0.3, at, wood, 0.15);
          box(0.12, 0.12, length - 0.6, length / 2, rail, 0.75);
          for (const side of [-0.3, 0.3])
            box(0.1, 0.9, 0.1, length / 2, wood, 0.45, side);
          break;
        case "brambleSwing":
          line(1.6, rope);
          box(0.04, 1.1, 0.04, length / 2, rope, 1.05);
          break;
        case "charredFence":
          for (const height of [0.3, 0.6])
            box(0.99, 0.1, 0.08, length / 2, charred, height);
          for (const side of [-0.43, 0.43])
            box(0.12, 0.75, 0.14, length / 2, charred, 0.375, side);
          break;
        case "ruinLedge":
          for (let i = 1; i <= 3; i++)
            box(
              0.55,
              0.2 + 0.25 * (2 - Math.abs(2 - i)),
              0.4,
              (length * i) / 4,
              stone,
            );
          break;
        case "cragLine":
          line(1.2, rope);
          break;
        case "balanceBeam":
          box(0.32, 0.16, length - 0.4, length / 2, wood, 0.28);
          for (const at of [0.45, length - 0.45])
            box(0.58, 0.24, 0.2, at, wood);
          break;
        case "hurdle":
          box(0.99, 0.16, 0.12, length / 2, rail, 0.53);
          for (const side of [-0.43, 0.43])
            box(0.12, 0.63, 0.18, length / 2, wood, 0.315, side);
          break;
        case "steppingStones":
          for (let i = 1; i <= 3; i++)
            box(
              0.43,
              0.14,
              0.4,
              (length * i) / 4,
              stone,
              0.07,
              i % 2 ? 0.18 : -0.18,
            );
          break;
        case "crawlRail":
          for (const side of [-0.44, 0.44])
            for (const at of [0.48, length - 0.48])
              box(0.12, 0.65, 0.12, at, wood, 0.325, side);
          for (const at of [0.48, length - 0.48])
            box(1, 0.12, 0.12, at, rail, 0.62);
      }
      scene.add(group);
    }),
  );

  /** The obstacle under a click's ray, and the end of it nearer where the ray meets the ground. */
  return (raycaster: THREE.Raycaster) => {
    const found = clicks.under(raycaster);
    if (!found) return undefined;
    const { obstacle, start, far } = found.target;
    const { at } = found;
    const apart = ({ x, y }: Tile) => Math.hypot(at.x - x, at.z - y);
    const end = far && apart(far) < apart(start) ? far : start;
    return { obstacle, x: end.x, y: end.y };
  };
}
