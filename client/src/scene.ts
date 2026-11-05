import * as THREE from "three";

// A tile's diamond is sqrt(2/3) tall on screen down the (1,1,1) diagonal, so this frames 12 of them.
const VIEW_HEIGHT = 12 * Math.sqrt(2 / 3);
const CAMERA_OFFSET = new THREE.Vector3(20, 20, 20);
const SUN_OFFSET = new THREE.Vector3(-6, 12, 4);
// Wide enough to cover the view at the furthest zoom on a 16:9 screen.
const SHADOW_REACH = 24;

export const renderer = new THREE.WebGLRenderer({
  antialias: true,
  stencil: true, // addSeeThroughOutline tells a character's own pixels by it
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color("#1b2330");
scene.add(new THREE.HemisphereLight(0xdfefff, 0x3a4a2a, 1.6));

const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -SHADOW_REACH,
  right: SHADOW_REACH,
  top: SHADOW_REACH,
  bottom: -SHADOW_REACH,
  far: 60,
});
scene.add(sun, sun.target);

export const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

function fitToWindow() {
  const { innerWidth: width, innerHeight: height } = window;
  renderer.setSize(width, height);
  camera.top = VIEW_HEIGHT / 2;
  camera.bottom = -VIEW_HEIGHT / 2;
  camera.left = (-VIEW_HEIGHT / 2) * (width / height);
  camera.right = (VIEW_HEIGHT / 2) * (width / height);
  camera.updateProjectionMatrix();
}
addEventListener("resize", fitToWindow);
fitToWindow();

renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    camera.zoom = THREE.MathUtils.clamp(
      camera.zoom * (event.deltaY > 0 ? 0.9 : 1.1),
      0.6,
      2.5,
    );
    camera.updateProjectionMatrix();
  },
  { passive: false },
);

/** Centres the view and the sun's shadows on a world point. The camera only ever slides, never turns. */
export function focusOn(x: number, z: number) {
  const point = new THREE.Vector3(x, 0, z);
  camera.position.copy(point).add(CAMERA_OFFSET);
  camera.lookAt(point);
  sun.position.copy(point).add(SUN_OFFSET);
  sun.target.position.copy(point);
}

renderer.setAnimationLoop(() => renderer.render(scene, camera));
