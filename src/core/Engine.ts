import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SparkRenderer } from "@sparkjsdev/spark";
import type { RenderingConfig } from "../types.ts";

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  aces:     THREE.ACESFilmicToneMapping,
  linear:   THREE.LinearToneMapping,
  reinhard: THREE.ReinhardToneMapping,
};

export class Engine {
  scene:    THREE.Scene;
  camera:   THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  spark:    SparkRenderer;

  constructor(config: RenderingConfig = {}) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = TONE_MAP[config.toneMapping ?? "aces"] ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.exposure ?? 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    this.spark = new (SparkRenderer as any)({
      renderer: this.renderer,
      enableLod: true,
      lodSplatCount: config.lodSplatCount ?? 2_500_000,
      outsideFoveate: 0.0,
      behindFoveate: 0.1,
      autoUpdate: true,
    });
    this.scene.add(this.spark);

    // Neutral room envmap — gives metallic/PBR materials something to reflect
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
    (this.scene as any).environmentIntensity = 0.4;
    pmrem.dispose();

    // Lights affect character + dynamic objects only; splat bakes its own lighting
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0x87CEEB, 0x362d1b, 0.4));

    window.addEventListener("resize", this._onResize);
  }

  private _onResize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener("resize", this._onResize);
    this.renderer.dispose();
  }
}
