import GUI from "lil-gui";
import type { CharacterController } from "../character/CharacterController.ts";
import type { CharacterAnimation }  from "../character/CharacterAnimation.ts";

export function createDebugPanel(
  character: CharacterController,
  anim: CharacterAnimation | null,
  initialMeshScale: number,
): GUI {
  const gui = new GUI({ title: "Character" });
  gui.domElement.style.userSelect = "none";

  // Apply initial mesh scale from the loaded character
  character.params.meshScale = initialMeshScale;

  // ── Movement ────────────────────────────────────────────────────────────
  const mov = gui.addFolder("Movement");
  mov.add(character.params, "walkSpeed",  0.5, 12, 0.1).name("Walk speed");
  mov.add(character.params, "runSpeed",   1,   20, 0.1).name("Sprint speed");
  mov.add(character.params, "jumpSpeed",  1,   20, 0.5).name("Jump height");
  mov.add(character.params, "gravity",  -30,   0, 0.1).name("Gravity");
  mov.open();

  // ── Character ───────────────────────────────────────────────────────────
  const chr = gui.addFolder("Character");
  chr.add(character.params, "meshScale",     0.3, 2.0, 0.01).name("Scale");
  chr.add(character.params, "meshYawOffset", -180, 180, 1).name("Mesh yaw (°)");
  chr.add(character.params, "turnSpeed",     1,   30,  0.5).name("Turn speed");
  chr.open();

  // ── Animation ───────────────────────────────────────────────────────────
  if (anim) {
    const an = gui.addFolder("Animation");
    an.add(anim.params, "crossfadeDuration", 0, 1, 0.01).name("Crossfade (s)");
    an.add(anim.params, "walkAnimSpeed",     0.2, 3, 0.05).name("Walk anim speed");
    an.add(anim.params, "runAnimSpeed",      0.2, 3, 0.05).name("Run anim speed");
  }

  return gui;
}
