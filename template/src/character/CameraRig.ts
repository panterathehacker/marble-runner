import * as THREE from "three";
import type { Physics } from "../core/Physics.ts";
import type { CameraConfig } from "../types.ts";

const DEFAULTS: Required<CameraConfig> = {
  distance:    1.5,
  height:      1.5,
  sensitivity: 0.002,
};

const MIN_PITCH    = -1.2;
const MAX_PITCH    =  0.9;
const LOOK_AT_OFFSET = 0.9;
const INITIAL_PITCH  = 0.05;

export class CameraRig {
  yaw      = 0;
  pitch    = INITIAL_PITCH;
  isLocked = false;

  private camera:  THREE.PerspectiveCamera;
  private physics: Physics;
  private cfg:     Required<CameraConfig>;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLElement, physics: Physics, config: CameraConfig = {}) {
    this.camera  = camera;
    this.physics = physics;
    this.cfg     = { ...DEFAULTS, ...config };

    canvas.addEventListener("click", () => { if (!this.isLocked) canvas.requestPointerLock(); });
    document.addEventListener("pointerlockchange", this._onLockChange);
    document.addEventListener("mousemove", this._onMouseMove);
  }

  private _onLockChange = () => {
    const locked = document.pointerLockElement !== null;
    if (locked && !this.isLocked) {
      this.pitch = INITIAL_PITCH;
      this.yaw   = 0;
    }
    this.isLocked = locked;
  };

  private _onMouseMove = (e: MouseEvent) => {
    if (!this.isLocked) return;
    this.yaw   -= e.movementX * this.cfg.sensitivity;
    this.pitch  = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch + e.movementY * this.cfg.sensitivity));
  };

  update(characterPosition: THREE.Vector3): void {
    const { distance: DIST, height: HEIGHT } = this.cfg;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);

    const lookAt = new THREE.Vector3(
      characterPosition.x,
      characterPosition.y + LOOK_AT_OFFSET,
      characterPosition.z,
    );

    const offsetX =  DIST * cosP * sinY;
    const offsetY =  DIST * sinP + (HEIGHT - LOOK_AT_OFFSET);
    const offsetZ =  DIST * cosP * cosY;
    const idealPos = lookAt.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

    const dir       = idealPos.clone().sub(lookAt).normalize();
    const dist      = idealPos.distanceTo(lookAt);
    const SKIP      = 1.0;
    const skipPt    = lookAt.clone().addScaledVector(dir, SKIP);
    const checkDist = dist - SKIP;
    const toi       = checkDist > 0 ? this.physics.castRay(skipPt, dir, checkDist) : null;
    const finalDist = toi !== null ? Math.max(0.5, SKIP + toi - 0.15) : dist;

    this.camera.position.copy(lookAt).addScaledVector(dir, finalDist);
    this.camera.lookAt(lookAt);
  }

  dispose(): void {
    document.removeEventListener("pointerlockchange", this._onLockChange);
    document.removeEventListener("mousemove", this._onMouseMove);
  }
}
