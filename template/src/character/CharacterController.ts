import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { CharacterAnimation } from "./CharacterAnimation.ts";
import type { Physics } from "../core/Physics.ts";
import type { PhysicsConfig } from "../types.ts";

const DEFAULTS: Required<PhysicsConfig> = {
  gravity:   -9.81,
  jumpSpeed: 5,
  walkSpeed: 3,
  runSpeed:  5,
};

export class CharacterController {
  position = new THREE.Vector3();

  /** Live-tweakable params — mutate directly or bind to a GUI. */
  params = {
    walkSpeed:     DEFAULTS.walkSpeed,
    runSpeed:      DEFAULTS.runSpeed,
    jumpSpeed:     DEFAULTS.jumpSpeed,
    gravity:       DEFAULTS.gravity,
    turnSpeed:     10,
    meshScale:     1.0,
    meshYawOffset: 0,   // degrees added to facing direction
  };

  private scene:   THREE.Scene;
  private physics: Physics;

  private mesh:    THREE.Object3D | null = null;
  private anim:    CharacterAnimation | null = null;

  private body:     RAPIER.RigidBody | null = null;
  private collider: RAPIER.Collider  | null = null;
  private kcc:      RAPIER.KinematicCharacterController | null = null;

  private verticalVelocity = 0;
  private grounded         = false;
  private meshYaw          = Math.PI;
  private jumpPending      = false;
  private jumpTimer        = 0;
  private keys: Record<string, boolean> = {};

  constructor(scene: THREE.Scene, physics: Physics, config: PhysicsConfig = {}) {
    this.scene   = scene;
    this.physics = physics;
    const cfg    = { ...DEFAULTS, ...config };
    this.params.walkSpeed  = cfg.walkSpeed;
    this.params.runSpeed   = cfg.runSpeed;
    this.params.jumpSpeed  = cfg.jumpSpeed;
    this.params.gravity    = cfg.gravity;

    document.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "Space" && !e.repeat) this.jumpPending = true;
    });
    document.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
  }

  setMesh(mesh: THREE.Object3D, anim: CharacterAnimation): void {
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = mesh;
    this.anim = anim;
    this.scene.add(mesh);
  }

  spawn(spawnPoint: { x: number; y: number; z: number; yaw?: number }): void {
    this._buildBody(spawnPoint);
    this.verticalVelocity = 0;
    this.grounded = false;
    this._syncMesh(spawnPoint.yaw ?? Math.PI);
  }

  private _buildBody(spawn: { x: number; y: number; z: number }): void {
    const w = this.physics.world;
    if (this.kcc)  { w.removeCharacterController(this.kcc);  this.kcc  = null; }
    if (this.body) { w.removeRigidBody(this.body);            this.body = null; }

    this.kcc = w.createCharacterController(0.01);
    this.kcc.setMaxSlopeClimbAngle(45 * Math.PI / 180);
    this.kcc.setMinSlopeSlideAngle(60 * Math.PI / 180);
    this.kcc.enableAutostep(0.5, 0.3, true);
    this.kcc.enableSnapToGround(0.5);
    this.kcc.setApplyImpulsesToDynamicBodies(true);

    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(spawn.x, spawn.y + 0.8, spawn.z);
    this.body = w.createRigidBody(bodyDesc);

    const collDesc = RAPIER.ColliderDesc.capsule(0.5, 0.3).setFriction(0.0);
    this.collider = w.createCollider(collDesc, this.body);
  }

  update(dt: number, cameraYaw: number): void {
    if (!this.body || !this.kcc || !this.collider) return;

    let mx = 0, mz = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"])    mz -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"])  mz += 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"])  mx -= 1;

    const p = this.params;
    const sprinting = this.keys["ShiftLeft"] || this.keys["ShiftRight"];
    const speed     = sprinting ? p.runSpeed : p.walkSpeed;
    const hasInput  = mx !== 0 || mz !== 0;

    const cosY = Math.cos(cameraYaw), sinY = Math.sin(cameraYaw);
    const worldX = mx * cosY + mz * sinY;
    const worldZ = -mx * sinY + mz * cosY;

    let jumpFired = false;
    if (this.grounded) {
      this.verticalVelocity = 0;
      if (this.jumpPending) { this.verticalVelocity = p.jumpSpeed; jumpFired = true; }
    } else {
      this.verticalVelocity += p.gravity * dt;
    }
    this.jumpPending = false;

    const desired = { x: worldX * speed * dt, y: this.verticalVelocity * dt, z: worldZ * speed * dt };
    this.kcc.computeColliderMovement(this.collider, desired);
    const corrected = this.kcc.computedMovement();
    this.grounded   = this.kcc.computedGrounded();

    const cur = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: cur.x + corrected.x,
      y: cur.y + corrected.y,
      z: cur.z + corrected.z,
    });

    const pos = this.body.translation();
    this.position.set(pos.x, pos.y - 0.8, pos.z);

    if (this.mesh) {
      if (p.meshScale !== this.mesh.scale.x) this.mesh.scale.setScalar(p.meshScale);
      if (hasInput) {
        const targetYaw = Math.atan2(worldX, worldZ) + p.meshYawOffset * (Math.PI / 180);
        let diff = targetYaw - this.meshYaw;
        while (diff >  Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        this.meshYaw += diff * Math.min(1, p.turnSpeed * dt);
        this.mesh.rotation.y = this.meshYaw;
      }
      this.mesh.position.copy(this.position);
    }

    if (this.anim) {
      this.anim.update(dt);

      if (jumpFired) {
        this.jumpTimer = 0;
        this.anim.transition("jump", 0.1);
      } else if (this.anim.state === "jump") {
        this.jumpTimer += dt;
        const landed  = this.grounded && this.jumpTimer > 0.3;
        const clipDone = this.anim.isJumpDone();
        if (landed || clipDone) {
          const next = !hasInput ? "idle" : sprinting ? "run" : "walk";
          this.anim.transition(next, 0.15);
        }
      } else {
        const next = !hasInput ? "idle" : sprinting ? "run" : "walk";
        this.anim.transition(next);
      }
    }
  }

  private _syncMesh(yaw: number): void {
    if (!this.mesh || !this.body) return;
    const p = this.body.translation();
    this.position.set(p.x, p.y - 0.8, p.z);
    this.mesh.position.copy(this.position);
    this.meshYaw = yaw;
    this.mesh.rotation.y = yaw;
  }

  dispose(): void {
    const w = this.physics.world;
    if (this.kcc)  w.removeCharacterController(this.kcc);
    if (this.body) w.removeRigidBody(this.body);
    if (this.mesh) this.scene.remove(this.mesh);
  }
}
