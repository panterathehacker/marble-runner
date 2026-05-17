import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

const gltfLoader = new GLTFLoader();

export async function loadGLTF(url: string): Promise<GLTF> {
  return gltfLoader.loadAsync(url);
}

export async function downloadBinary(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.arrayBuffer();
}
