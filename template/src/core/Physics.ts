import RAPIER from "@dimforge/rapier3d-compat";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class Physics {
  world!: RAPIER.World;
  colliderHandles: RAPIER.Collider[] = [];
  debugMeshData: { vertices: Float32Array; indices: Uint32Array }[] = [];

  private gltfLoader = new GLTFLoader();

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    console.log("[Physics] Rapier initialized");
  }

  async setColliderMesh(colliderUrl: string, noFlip = false): Promise<void> {
    for (const handle of this.colliderHandles) {
      this.world.removeCollider(handle, true);
    }
    this.colliderHandles = [];
    this.debugMeshData = [];

    let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
    try {
      gltf = await this.gltfLoader.loadAsync(colliderUrl);
    } catch {
      console.warn(`[Physics] Collider not found at ${colliderUrl}, using fallback ground`);
      this._addFallbackGround();
      return;
    }

    gltf.scene.traverse((child: any) => {
      if (!child.isMesh) return;
      const geo = child.geometry;
      if (!geo.index) {
        console.warn("[Physics] Skipping mesh with no index buffer:", child.name);
        return;
      }

      child.updateWorldMatrix(true, false);
      const posAttr = geo.attributes.position;
      const vertices = new Float32Array(posAttr.array.length);

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const wm = child.matrixWorld;
        vertices[i * 3 + 0] = wm.elements[0] * x + wm.elements[4] * y + wm.elements[8]  * z + wm.elements[12];
        vertices[i * 3 + 1] = wm.elements[1] * x + wm.elements[5] * y + wm.elements[9]  * z + wm.elements[13];
        vertices[i * 3 + 2] = wm.elements[2] * x + wm.elements[6] * y + wm.elements[10] * z + wm.elements[14];
      }

      // Match the SplatMesh rotation.x = Math.PI applied in WorldLoader (skipped for noFlip worlds)
      if (!noFlip) {
        for (let i = 0; i < posAttr.count; i++) {
          vertices[i * 3 + 1] *= -1;
          vertices[i * 3 + 2] *= -1;
        }
      }

      const indices = new Uint32Array(geo.index.array);
      this.debugMeshData.push({ vertices: vertices.slice(), indices: new Uint32Array(indices) });

      const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices)
        .setRestitution(0.15)
        .setFriction(0.8);
      const handle = this.world.createCollider(colliderDesc);
      this.colliderHandles.push(handle);
    });

    console.log(`[Physics] Loaded ${this.colliderHandles.length} collider mesh(es) from ${colliderUrl}`);
    this._addFallbackGround();
  }

  private _addFallbackGround(): void {
    const desc = RAPIER.ColliderDesc.cuboid(200, 0.1, 200)
      .setTranslation(0, -20, 0)
      .setRestitution(0.1)
      .setFriction(0.9);
    this.colliderHandles.push(this.world.createCollider(desc));
  }

  castRay(
    origin: { x: number; y: number; z: number },
    direction: { x: number; y: number; z: number },
    maxDistance: number,
  ): number | null {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(ray, maxDistance, false);
    return hit ? hit.timeOfImpact : null;
  }

  step(dt: number): void {
    this.world.timestep = Math.min(dt, 1 / 30);
    this.world.step();
  }
}
