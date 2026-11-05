import * as THREE from "three";
import { scene } from "./scene.ts";

export const HIT_BOX_HEIGHT = 0.9;

const shape = new THREE.BoxGeometry(1, HIT_BOX_HEIGHT, 1);
const unseen = new THREE.MeshBasicMaterial({ visible: false });

/** An invisible tile-sized box in the scene, for a click's ray to find. */
export function newHitBox() {
  const hitBox = new THREE.Mesh(shape, unseen);
  scene.add(hitBox);
  return hitBox;
}
