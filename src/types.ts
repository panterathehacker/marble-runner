// Public TypeScript types for Marble Runner.
// Import in marble.config.ts: import type { MarbleConfig } from 'marble-runner';

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw?: number;
}

export interface WorldEntry {
  slug: string;
  name: string;
  /** URL to a Marble world page, OR a world_id string. Requires WLT_API_KEY. */
  source?: string;
  /** Use pre-downloaded files from public/worlds/<slug>/. */
  local?: boolean;
  /** Generate via the Marble API on first run. Requires WLT_API_KEY. */
  generated?: {
    prompt: string;
    model?: "marble-1.1-plus" | "marble-1.0-draft";
  };
  spawn?: SpawnPoint;
  /** Set true for splats already in Y-up orientation (skips the default rotation.x = Math.PI flip). */
  noFlip?: boolean;
}

export interface CharacterEntry {
  slug: string;
  name: string;
  /** Scale multiplier. Defaults to 1. */
  scale?: number;
  /** Camera distance override for this character. */
  cameraDistance?: number;
}

export interface RenderingConfig {
  /** Target Gaussian splat count for LOD. Default: 2500000. */
  lodSplatCount?: number;
  bloom?: boolean;
  toneMapping?: "aces" | "linear" | "reinhard";
  /** Renderer tone mapping exposure. Default: 1.0. */
  exposure?: number;
}

export interface PhysicsConfig {
  gravity?: number;
  jumpSpeed?: number;
  walkSpeed?: number;
  runSpeed?: number;
}

export interface CameraConfig {
  distance?: number;
  height?: number;
  sensitivity?: number;
}

export interface MarbleConfig {
  worlds: WorldEntry[];
  /** Slug of the default character. Must match a folder in public/characters/. */
  defaultCharacter?: string;
  /** Slug of the default world. Must match a folder in public/worlds/. Defaults to '_default'. */
  defaultWorld?: string;
  rendering?: RenderingConfig;
  physics?: PhysicsConfig;
  camera?: CameraConfig;
}

// Character meta.json schema (one per public/characters/<slug>/meta.json)
export interface CharacterMeta {
  name: string;
  slug: string;
  scale: number;
  animations: {
    idle: string;
    walk: string;
    run: string;
    jump: string;
  };
  cameraDistance?: number;
  /** 0–1. Adds emissive glow to all materials so dark characters remain visible. */
  materialBoost?: number;
  /** Mesh/material name substrings that need alphaTest+DoubleSide (hair, eyelash, etc). */
  alphaFixNames?: string[];
  /** Apply alphaTest+DoubleSide to every textured material (use when fbx2gltf loses all alpha info). */
  alphaFixAll?: boolean;
}

// World meta.json schema (one per public/worlds/<slug>/meta.json)
export interface WorldMeta {
  name: string;
  slug: string;
  source?: string;
  worldId?: string;
  caption?: string;
  groundPlaneOffset?: number;
  metricScaleFactor?: number;
  generatedAt?: string;
}
