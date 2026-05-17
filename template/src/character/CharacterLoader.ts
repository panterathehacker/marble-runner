import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { loadGLTF } from "../core/AssetLoader.ts";
import { CharacterAnimation } from "./CharacterAnimation.ts";
import { loadCustomChar, saveCustomChar } from "./CustomCharacterStore.ts";
import { retargetClipsForAvatar } from "./AnimationRetargeter.ts";
import type { CharacterMeta } from "../types.ts";

export interface LoadedCharacter {
  mesh: THREE.Object3D;
  anim: CharacterAnimation;
  meta: CharacterMeta;
}

function parseGLTFBuffer(buffer: ArrayBuffer): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buffer, "", resolve, reject);
  });
}

async function generateAvatarThumbnail(glbBuffer: ArrayBuffer): Promise<string> {
  // Delegate to the same render path used during avatar creation.
  // Importing inline to avoid a circular module dep.
  const { renderAvatarHeadshot } = await import("../ui/AvatarCreator.ts");
  return renderAvatarHeadshot(glbBuffer);
}

async function loadCustomCharacter(): Promise<LoadedCharacter> {
  const stored = await loadCustomChar();
  if (!stored) {
    throw new Error(
      "No custom character found.\nOpen the character picker and create one with \"Make Your Own\"."
    );
  }

  const gltf = await parseGLTFBuffer(stored.glbBuffer);
  const mesh = gltf.scene;

  // Avaturn avatars are ~1.87 m tall; default to 0.75 scale (~1.40 m) to match bundled characters
  mesh.scale.setScalar(0.75);

  mesh.traverse((child: any) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;
    const mats: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      if (mat.opacity === 0 && mat.transparent) {
        // Fully invisible material — common on some Avaturn exports; restore opacity
        mat.opacity     = 1.0;
        mat.alphaTest   = 0.5;
        mat.transparent = false;
        mat.depthWrite  = true;
        mat.side        = THREE.DoubleSide;
        mat.needsUpdate = true;
      } else if (mat.transparent && mat.map) {
        // Blended transparency with a texture (hair, eyelashes) — switch to alpha-cutout
        // to avoid depth-sorting artifacts when strands overlap each other
        mat.alphaTest   = 0.4;
        mat.transparent = false;
        mat.depthWrite  = true;
        mat.side        = THREE.DoubleSide;
        mat.needsUpdate = true;
      }
    }
  });

  // Load character "a" animations via a fresh fetch (no GLTFLoader singleton cache).
  const animBuf  = await fetch("./characters/a/character.glb").then((r) => r.arrayBuffer());
  const animGltf = await parseGLTFBuffer(animBuf);

  // Strip "mixamorig" prefix from track names so they match Avaturn's bare bone names.
  // Character "a" exports as "mixamorigHips" (no colon); Avaturn uses "Hips".
  for (const clip of animGltf.animations) {
    for (const track of clip.tracks) {
      if (track.name.startsWith("mixamorig")) {
        track.name = track.name.slice("mixamorig".length);
      }
    }
  }
  const retargetedClips = animGltf.animations;

  // Avaturn exports one independent armature per mesh part (body, hair, clothing…).
  // We create a SEPARATE AnimationMixer per armature so each resolves its own bones
  // independently — no shared-root ambiguity, no AnimationObjectGroup complexity.
  // Strategy: find all "Hips" bones; if multiple, each armature root (Hips.parent) gets
  // its own mixer. Fall back to [mesh] for single-skeleton or non-standard layouts.
  // Build one AnimationMixer per unique armature root.
  // Avaturn: single "Armature" → one Hips → animRoots = [mesh].
  const hipsNodes: THREE.Object3D[] = [];
  mesh.traverse((obj: THREE.Object3D) => { if (obj.name === "Hips") hipsNodes.push(obj); });

  let animRoots: THREE.Object3D[];
  if (hipsNodes.length > 1) {
    const seen = new Set<THREE.Object3D>();
    animRoots = [];
    for (const h of hipsNodes) {
      const root = h.parent ?? mesh;
      if (!seen.has(root)) { seen.add(root); animRoots.push(root); }
    }
  } else {
    if (hipsNodes.length === 0) {
      console.warn("[CustomChar] No 'Hips' bone found — animation may not play.");
    }
    animRoots = [mesh];
  }

  const meta: CharacterMeta = {
    name: stored.name,
    slug: "_custom",
    scale: 0.75,
    animations: { idle: "idle", walk: "walk", run: "run", jump: "jump" },
  };

  const anim = new CharacterAnimation(animRoots, retargetedClips, meta);

  // Generate a headshot thumbnail on first load (skip if we already have one)
  if (!stored.thumbnailDataUrl) {
    generateAvatarThumbnail(stored.glbBuffer).then((dataUrl) => {
      if (dataUrl) saveCustomChar({ ...stored, thumbnailDataUrl: dataUrl });
    });
  }

  return { mesh, anim, meta };
}

export async function loadCharacter(slug: string): Promise<LoadedCharacter> {
  if (slug === "_custom") return loadCustomCharacter();

  const base = `./characters/${slug}`;

  const metaRes = await fetch(`${base}/meta.json`);
  if (!metaRes.ok) {
    throw new Error(
      `Character "${slug}" not found.\n` +
      `Expected file: public/characters/${slug}/meta.json\n` +
      `Run \`npm run character:list\` to see available characters.`
    );
  }
  const meta: CharacterMeta = await metaRes.json();

  const gltf = await loadGLTF(`${base}/character.glb`).catch(() => {
    throw new Error(
      `Character GLB missing for "${slug}".\n` +
      `Expected: public/characters/${slug}/character.glb`
    );
  });

  const mesh = gltf.scene;
  mesh.scale.setScalar(meta.scale ?? 1);

  const alphaKeywords = (meta.alphaFixNames ?? []).map(s => s.toLowerCase());

  mesh.traverse((child: any) => {
    if (!child.isMesh) return;
    child.frustumCulled = false;

    const mats: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
    const nodeName = child.name.toLowerCase();

    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      const matName = mat.name.toLowerCase();

      // fbx2gltf sometimes sets baseColorFactor.alpha=0 (fully invisible) for hair/glass.
      // Detect and correct: if opacity is 0 on a non-opaque material, reset it to 1.
      if (mat.opacity === 0 && mat.transparent) {
        mat.opacity     = 1.0;
        mat.alphaTest   = 0.5;
        mat.transparent = false;
        mat.depthWrite  = true;
        mat.side        = THREE.DoubleSide;
        mat.needsUpdate = true;
      }

      // Alpha cutout fix: fbx2gltf sometimes loses alphaMode:MASK for hair/foliage cards.
      // alphaFixAll covers the case where mesh names are generic (mesh_0 etc.) and name matching fails.
      const needsAlphaFix = meta.alphaFixAll
        ? !!mat.map
        : alphaKeywords.length > 0 && alphaKeywords.some(k => nodeName.includes(k) || matName.includes(k));
      if (needsAlphaFix) {
        mat.alphaTest   = 0.5;
        mat.transparent = false;
        mat.depthWrite  = true;
        mat.side        = THREE.DoubleSide;
        mat.needsUpdate = true;
      }

      // Emissive boost: lift dark materials without washing out bright ones
      const boost = meta.materialBoost ?? 0;
      if (boost > 0) {
        const lum = 0.299 * mat.color.r + 0.587 * mat.color.g + 0.114 * mat.color.b;
        if (lum < boost) {
          const lift = (boost - lum) * 0.85;
          mat.emissive.setRGB(
            Math.max(mat.color.r, lift),
            Math.max(mat.color.g, lift),
            Math.max(mat.color.b, lift),
          );
          mat.emissiveIntensity = 1.0;
          mat.needsUpdate = true;
        }
      }
    }
  });

  const anim = new CharacterAnimation([mesh], gltf.animations, meta);

  return { mesh, anim, meta };
}
