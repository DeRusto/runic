import * as THREE from "three";

const drawnAs = new THREE.Mesh();
const instanceMatrix = new THREE.Matrix4();

/**
 * A model for clicks to find made of instances drawn in shared InstancedMeshes, as a gathering
 * site's parts are: a ray meets it where it meets one of those instances as drawn now. It is never
 * drawn itself. An instance scaled to nothing, a site gone from its spot, can't be met.
 */
export function instancesModel(
  parts: { mesh: THREE.InstancedMesh; slot: number }[],
) {
  const model = new THREE.Object3D();
  model.raycast = (raycaster, intersects) => {
    for (const { mesh, slot } of parts) {
      mesh.getMatrixAt(slot, instanceMatrix);
      if (instanceMatrix.determinant() === 0) continue;
      drawnAs.geometry = mesh.geometry;
      drawnAs.material = mesh.material;
      drawnAs.matrixWorld.multiplyMatrices(mesh.matrixWorld, instanceMatrix);
      const hits: THREE.Intersection[] = [];
      drawnAs.raycast(raycaster, hits);
      for (const hit of hits) intersects.push({ ...hit, object: model });
    }
  };
  return model;
}
