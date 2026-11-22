import {
  obstacleLanding,
  type ObstacleKind,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { scene } from "./scene.ts";

const wood = new THREE.MeshStandardMaterial({ color: 0x865333 });
const rail = new THREE.MeshStandardMaterial({ color: 0xcc9d5a });
const stone = new THREE.MeshStandardMaterial({ color: 0x828b87 });
const startMat = new THREE.MeshStandardMaterial({ color: 0xe6c976 });

/** Draws each obstacle along its crossing direction and makes the whole prop clickable. */
export function addObstacles(tiles: TileKind[][]) {
  const targets = new Map<
    THREE.Object3D,
    { obstacle: ObstacleKind; x: number; y: number }
  >();

  tiles.forEach((row, y) =>
    row.forEach(({ obstacle }, x) => {
      if (!obstacle) return;
      const landing = obstacleLanding(obstacle, { x, y });
      const group = new THREE.Group();
      group.position.set(x, 0, y);
      group.rotation.y = Math.atan2(landing.x - x, landing.y - y);
      const length = Math.hypot(landing.x - x, landing.y - y);

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
        targets.set(mesh, { obstacle, x, y });
      };

      box(0.82, 0.04, 0.65, 0, startMat);
      switch (obstacle) {
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

  return (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...targets.keys()])[0];
    return hit && targets.get(hit.object);
  };
}
