import * as THREE from "three";
import { SplatMesh } from "@sparkjsdev/spark";
import type { WorldMeta } from "../types.ts";

export interface LoadedWorld {
  splatMesh: SplatMesh;
  meta:      WorldMeta;
  slug:      string;
}

export class WorldLoader {
  private scene:  THREE.Scene;
  private cache   = new Map<string, LoadedWorld>();
  currentSlug:    string | null = null;
  private current: LoadedWorld | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  async preload(slug: string, onProgress?: (p: number) => void, noFlip = false): Promise<LoadedWorld> {
    if (this.cache.has(slug)) return this.cache.get(slug)!;

    // VITE_WORLDS_BASE_URL lets a hosted deployment (e.g. Vercel) serve large
    // splat files from an external CDN while local dev uses relative paths.
    const cdnBase = (import.meta as any).env?.VITE_WORLDS_BASE_URL?.replace(/\/$/, "");
    const base = cdnBase ? `${cdnBase}/${slug}` : `./worlds/${slug}`;

    const metaRes = await fetch(`${base}/meta.json`).catch(() => null);
    const meta: WorldMeta = metaRes?.ok
      ? await metaRes.json()
      : { name: slug, slug };

    const splatMesh = new (SplatMesh as any)({
      url: `${base}/splat.spz`,
      lod: true,
      onProgress: (p: number) => {
        onProgress?.(p);
        console.log(`[WorldLoader] ${slug}: ${(p * 100).toFixed(0)}%`);
      },
      onLoad: () => console.log(`[WorldLoader] ${slug} splat loaded`),
    });

    // Most Marble splats use Y-down convention; noFlip skips the correction for Y-up exports
    if (!noFlip) (splatMesh as any).rotation.x = Math.PI;

    const entry: LoadedWorld = { splatMesh, meta, slug };
    this.cache.set(slug, entry);
    await (splatMesh as any).initialized;
    return entry;
  }

  async switchTo(slug: string, onProgress?: (p: number) => void, noFlip = false): Promise<LoadedWorld> {
    if (this.current) {
      this.scene.remove(this.current.splatMesh as unknown as THREE.Object3D);
    }
    const world = await this.preload(slug, onProgress, noFlip);
    this.scene.add(world.splatMesh as unknown as THREE.Object3D);
    this.current  = world;
    this.currentSlug = slug;
    return world;
  }

  dispose(): void {
    this.cache.clear();
    this.current = null;
    this.currentSlug = null;
  }
}
