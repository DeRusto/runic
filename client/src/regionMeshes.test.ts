import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { ORE_SCALE, oreParts } from "./regionMeshes.ts";

describe("ore.glb", () => {
  const load = async () => {
    const { buffer } = readFileSync("client/public/models/ore.glb");
    const { scene } = await new GLTFLoader().parseAsync(
      buffer as ArrayBuffer,
      "",
    );
    return oreParts(scene);
  };

  it("has a near-white vein for a tint to multiply, apart from its rock", async () => {
    const { rock, vein } = await load();
    expect(rock).toBeInstanceOf(THREE.Mesh);
    const { r, g, b } = (vein.material as THREE.MeshStandardMaterial).color;
    expect(Math.min(r, g, b)).toBeGreaterThan(0.8);
  });

  it("stands on the ground and fits within a tile", async () => {
    const { rock, vein } = await load();
    const box = new THREE.Box3().setFromObject(rock).expandByObject(vein);
    expect(box.min.y).toBeCloseTo(0, 1);
    const size = box.getSize(new THREE.Vector3()).multiplyScalar(ORE_SCALE);
    expect(Math.max(size.x, size.z)).toBeLessThan(1);
  });
});
