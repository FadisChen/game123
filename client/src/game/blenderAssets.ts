import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const assets = new Map<string, Promise<THREE.Group>>();

function loadAsset(name: string): Promise<THREE.Group> {
  let asset = assets.get(name);
  if (!asset) {
    asset = loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`).then((gltf) => gltf.scene);
    assets.set(name, asset);
  }
  return asset;
}

/** The Blender exporter bakes the player's palette into one COLOR_0 mesh. */
export async function loadBlenderPlayerGeometry(): Promise<THREE.BufferGeometry> {
  const model = await loadAsset("player");
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
  if (meshes.length !== 1 || !meshes[0].geometry.hasAttribute("color")) {
    throw new Error("player.glb must contain one mesh with vertex colors");
  }
  return meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
}

/** Keep the procedural model visible until its Blender replacement is ready. */
export async function replaceWithBlenderAsset(
  parent: THREE.Group,
  name: "doll" | "tree" | "house" | "guard",
  onLoaded?: () => void,
): Promise<void> {
  try {
    const model = (await loadAsset(name)).clone(true);
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = name === "house" || name === "tree";
      // Each doll owns its emissive state, including when scenes coexist.
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => material.clone())
        : object.material.clone();
    });
    parent.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
    parent.clear();
    parent.add(model);
    parent.userData.blenderAsset = name;
    onLoaded?.();
  } catch (error) {
    assets.delete(name);
    console.warn(`Could not load Blender asset: ${name}; keeping procedural model.`, error);
  }
}
