import * as THREE from "three";
import config from "../marble.config.ts";
import { Engine } from "./core/Engine.ts";
import { Physics } from "./core/Physics.ts";
import { CharacterController } from "./character/CharacterController.ts";
import { CameraRig } from "./character/CameraRig.ts";
import { loadCharacter } from "./character/CharacterLoader.ts";
import { WorldLoader } from "./world/WorldLoader.ts";
import { WorldRegistry } from "./world/WorldRegistry.ts";
import { HUD } from "./ui/HUD.ts";
import { showCharacterPicker } from "./ui/CharacterPicker.ts";
import { showWorldPicker } from "./ui/WorldPicker.ts";
import { createDebugPanel } from "./ui/DebugPanel.ts";

async function main() {
  const engine   = new Engine(config.rendering);
  const physics  = new Physics();
  await physics.init();

  const registry  = new WorldRegistry(config);
  const loader    = new WorldLoader(engine.scene);
  const hud       = new HUD();
  const character = new CharacterController(engine.scene, physics, config.physics);
  const camera    = new CameraRig(engine.camera, engine.renderer.domElement, physics, config.camera);

  // ── Pickers ──────────────────────────────────────────────────────────
  const { character: characterSlug, world: pickedWorld } = await showCharacterPicker(
    config.defaultCharacter ?? "runner",
    registry.hasUserWorlds() ? undefined : {
      defaults: registry.getBundledDefaults(),
      initialSlug: registry.getRandomDefault(),
    },
  );

  const worldSlug = registry.hasUserWorlds()
    ? (registry.getUserSlugs().length > 1 ? await showWorldPicker(config.worlds) : registry.getStartupSlug())
    : pickedWorld;

  // ── Load character ───────────────────────────────────────────────────
  hud.showLoading("Loading character…");
  const { mesh, anim, meta: charMeta } = await loadCharacter(characterSlug).catch((err: Error) => {
    // Friendly error when character files are missing
    document.body.innerHTML = `
      <div style="color:white;padding:40px;font:15px Georgia,serif;background:#0a0a0f;min-height:100vh;white-space:pre-wrap">
        <h2 style="letter-spacing:0.1em">Character not found</h2>${err.message}
      </div>`;
    throw err;
  });
  character.setMesh(mesh, anim);

  // ── Load world ───────────────────────────────────────────────────────
  const noFlip = !!registry.getEntry(worldSlug)?.noFlip;
  hud.showLoading(`Entering your world, as ${charMeta.name}`);
  await loader.switchTo(worldSlug, (p) => hud.setLoadingProgress(p), noFlip);
  const cdnBase = (import.meta as any).env?.VITE_WORLDS_BASE_URL?.replace(/\/$/, "");
  const colliderUrl = cdnBase
    ? `${cdnBase}/${worldSlug}/collider.glb`
    : `./worlds/${worldSlug}/collider.glb`;
  await physics.setColliderMesh(colliderUrl, noFlip);

  const spawn = registry.getSpawn(worldSlug);
  character.spawn(spawn);
  hud.setWorldName(loader.currentSlug ? (await fetch(`./worlds/${loader.currentSlug}/meta.json`).then(r => r.ok ? r.json() : null).catch(() => null))?.name ?? worldSlug : worldSlug);
  hud.hideLoading();

  // ── Debug GUI (Tab to toggle) ─────────────────────────────────────────
  const debugGui = createDebugPanel(character, anim, charMeta.scale ?? 1);

  const tabHint = document.createElement("div");
  Object.assign(tabHint.style, {
    position: "fixed", bottom: "18px", right: "20px",
    color: "rgba(255,255,255,0.22)", font: "11px Georgia,serif",
    letterSpacing: "0.1em", pointerEvents: "none", zIndex: "500",
  });
  tabHint.textContent = "Tab — close panel";
  document.body.appendChild(tabHint);

  let debugVisible = true;
  document.addEventListener("keydown", (e) => {
    if (e.code === "Tab") {
      e.preventDefault();
      debugVisible = !debugVisible;
      debugGui.show(debugVisible);
      tabHint.textContent = debugVisible ? "Tab — close panel" : "Tab — customize character";
    }
  });

  // ── Debug: G = collider wireframe ────────────────────────────────────
  let wireframeGroup: THREE.Group | null = null;

  document.addEventListener("keydown", (e) => {
    if (e.code === "KeyG") {
      if (!wireframeGroup) {
        wireframeGroup = new THREE.Group();
        for (const { vertices, indices } of physics.debugMeshData) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
          geo.setIndex(new THREE.BufferAttribute(indices, 1));
          wireframeGroup.add(new THREE.LineSegments(
            new THREE.WireframeGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x00ff88, opacity: 0.55, transparent: true }),
          ));
        }
        engine.scene.add(wireframeGroup);
      } else {
        wireframeGroup.visible = !wireframeGroup.visible;
      }
    }
  });

  // ── Game loop ────────────────────────────────────────────────────────
  let last = 0;
  function animate(time: number) {
    requestAnimationFrame(animate);
    const dt = Math.min((time - last) / 1000, 0.05);
    last = time;

    character.update(dt, camera.yaw);
    camera.update(character.position);
    physics.step(dt);
    engine.render();
  }

  animate(0);
  console.log("[MarbleRunner] Ready");
}

main().catch((err: Error) => {
  console.error("[MarbleRunner] Fatal:", err);
  if (!document.body.children.length || document.body.children[0].tagName === "CANVAS") {
    document.body.innerHTML = `
      <div style="color:white;padding:40px;font:15px monospace;background:#0a0a0f;min-height:100vh">
        <h2>Marble Runner — Fatal Error</h2><pre>${err.stack ?? err.message}</pre>
      </div>`;
  }
});
