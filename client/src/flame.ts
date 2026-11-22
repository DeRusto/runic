import * as THREE from "three";

// Shared by every flame, so one burning out frees nothing on the GPU and leaks nothing.
const FLAME = new THREE.ConeGeometry(0.16, 0.5, 8);
const FLAME_COLOUR = new THREE.MeshBasicMaterial({ color: 0xff9a30 });
const HEART = new THREE.ConeGeometry(0.09, 0.3, 8);
const HEART_COLOUR = new THREE.MeshBasicMaterial({ color: 0xffd866 });

/** A flame and its warm glow, flickering a little differently for every `seedX` and `seedY` (#224). */
export function flameLook(seedX: number, seedY: number) {
  const group = new THREE.Group();
  const flame = new THREE.Mesh(FLAME, FLAME_COLOUR);
  flame.position.y = 0.36;
  const heart = new THREE.Mesh(HEART, HEART_COLOUR);
  heart.position.y = 0.27;
  const glow = new THREE.PointLight(0xff8a30, 5, 5);
  glow.position.y = 0.5;
  flame.onBeforeRender = () => {
    const now = performance.now();
    flame.scale.set(
      1 + 0.1 * Math.sin(now / 90 + seedX * 7),
      1 + 0.18 * Math.sin(now / 70 + seedY * 13),
      1,
    );
    glow.intensity = 5 + 0.8 * Math.sin(now / 110 + seedX * 3 + seedY);
  };
  group.add(flame, heart, glow);
  return group;
}
