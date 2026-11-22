import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MODELS_DIR = "client/public/models";

type Gltf = {
  materials?: {
    pbrMetallicRoughness?: { baseColorTexture?: { texCoord?: number } };
  }[];
  meshes?: {
    name?: string;
    primitives: { attributes: Record<string, number>; material?: number }[];
  }[];
};

/** A model's glTF JSON: the whole file for .gltf, or a GLB's JSON chunk. */
function gltfOf(file: string): Gltf {
  const bytes = readFileSync(`${MODELS_DIR}/${file}`);
  if (file.endsWith(".gltf")) return JSON.parse(bytes.toString()) as Gltf;
  return JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  ) as Gltf;
}

const files = readdirSync(MODELS_DIR).filter((file) =>
  /\.(glb|gltf)$/.test(file),
);

describe("every model", () => {
  // A converted model can lose its UVs (Meshy's animated fisherman did) and then draws black.
  it.each(files)(
    "%s has the texture coordinates each textured mesh draws with",
    (file) => {
      const { materials = [], meshes = [] } = gltfOf(file);
      const missing = meshes.flatMap(({ name, primitives }) =>
        primitives.flatMap(({ attributes, material }) => {
          const texture =
            material === undefined
              ? undefined
              : materials[material]?.pbrMetallicRoughness?.baseColorTexture;
          const uv = `TEXCOORD_${texture?.texCoord ?? 0}`;
          return texture && !(uv in attributes) ? [`${name}: ${uv}`] : [];
        }),
      );
      expect(missing).toEqual([]);
    },
  );
});
