import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { saveCustomChar } from "../character/CustomCharacterStore.ts";

// Set this to your Avaturn project URL.
// Get one free at https://avaturn.me → Developers → Create Project → copy subdomain.
// Format: "https://YOUR-PROJECT.avaturn.dev"
// The default below is Avaturn's public preview — replace with your own project subdomain.
export const AVATURN_URL = "https://demo.avaturn.dev";

export interface AvatarCreatorResult {
  glbBuffer:        ArrayBuffer;
  avatarId:         string;
  name:             string;
  thumbnailDataUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, styles: Partial<CSSStyleDeclaration> = {}, html = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  if (html) node.innerHTML = html;
  return node;
}

// ── Overlay shell ─────────────────────────────────────────────────────────────

function buildOverlay(): { overlay: HTMLDivElement; body: HTMLDivElement; close: HTMLButtonElement } {
  const overlay = el("div", {
    position: "fixed", inset: "0", background: "#0a0a0f",
    zIndex: "700", display: "flex", flexDirection: "column",
  });

  const header = el("div", {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 28px", borderBottom: "1px solid rgba(255,255,255,0.07)",
    flexShrink: "0",
  }, `<span style="font:13px Georgia,serif;letter-spacing:0.28em;opacity:0.45;text-transform:uppercase">Make your character</span>`);

  const close = el("button", {
    background: "none", border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.5)", font: "16px Georgia,serif",
    width: "34px", height: "34px", borderRadius: "2px", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  close.textContent = "✕";
  header.appendChild(close);

  const body = el("div", { flex: "1", position: "relative", overflow: "hidden" });

  overlay.appendChild(header);
  overlay.appendChild(body);
  document.body.appendChild(overlay);
  return { overlay, body, close };
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function showSpinner(body: HTMLDivElement, message: string): void {
  if (!document.getElementById("mr-spin-style")) {
    const style = document.createElement("style");
    style.id = "mr-spin-style";
    style.textContent = "@keyframes mr-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }
  body.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;color:rgba(255,255,255,0.5);font:17px Georgia,serif;letter-spacing:0.1em">
      <div style="width:44px;height:44px;border:2px solid rgba(255,255,255,0.1);border-top-color:rgba(255,255,255,0.6);border-radius:50%;animation:mr-spin 0.9s linear infinite"></div>
      <div>${message}</div>
    </div>
  `;
}

// ── Stage 1: Avaturn SDK creator ──────────────────────────────────────────────

async function showAvaturnCreator(body: HTMLDivElement, avaturnUrl: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    showSpinner(body, "Launching avatar creator…");

    try {
      // @ts-ignore — CDN import; no type declaration needed
      const { AvaturnSDK } = await import("https://cdn.jsdelivr.net/npm/@avaturn/sdk/dist/index.js");

      const container = el("div", { position: "absolute", inset: "0" });
      body.innerHTML = "";
      body.appendChild(container);

      const sdk = new AvaturnSDK();
      await sdk.init(container, { url: avaturnUrl });

      sdk.on("export", (data: { url?: string }) => {
        resolve(data.url ?? "");
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── Stage 2: download GLB ─────────────────────────────────────────────────────

async function downloadGLB(glbUrl: string): Promise<{ buffer: ArrayBuffer; avatarId: string }> {
  // Extract a stable ID from the URL path (longest non-extension segment)
  const segments  = glbUrl.split("/").filter(Boolean);
  const avatarId  = segments.find(s => s.length > 20 && !s.includes("."))
    ?? segments.pop()?.replace(".glb", "")
    ?? "avatar";

  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`Failed to download avatar GLB (HTTP ${res.status})`);
  return { buffer: await res.arrayBuffer(), avatarId };
}

// ── Offscreen headshot ────────────────────────────────────────────────────────

export async function renderAvatarHeadshot(glbBuffer: ArrayBuffer): Promise<string> {
  try {
    const W = 256, H = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x888888, 1);

    const scene  = new THREE.Scene();
    scene.background = new THREE.Color(0x888888);
    const camera = new THREE.PerspectiveCamera(28, W / H, 0.01, 10);

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(0.6, 1.8, 2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(-1.5, 0.5, 1);
    scene.add(fill);

    const gltf = await new Promise<any>((resolve, reject) => {
      new GLTFLoader().parse(glbBuffer, "", resolve, reject);
    });
    const mesh = gltf.scene;
    mesh.scale.setScalar(0.75);
    scene.add(mesh);

    // Apply idle animation so avatar isn't in T-pose
    try {
      const animBuf  = await fetch("./characters/a/character.glb").then((r) => r.arrayBuffer());
      const animGltf = await new Promise<any>((res, rej) => new GLTFLoader().parse(animBuf, "", res, rej));
      for (const clip of animGltf.animations) {
        for (const track of clip.tracks) {
          if (track.name.startsWith("mixamorig")) track.name = track.name.slice(9);
        }
      }
      const idleClip = animGltf.animations.find((c: any) => c.name.toLowerCase().includes("idle"))
        ?? animGltf.animations[0];
      if (idleClip) {
        const mixer = new THREE.AnimationMixer(mesh);
        mixer.clipAction(idleClip).play();
        mixer.update(0.001); // frame 1 = neutral stand, no forward lean
      }
    } catch { /* T-pose fallback if anim load fails */ }

    // Find head bone world Y; default for 1.87 m avatar at 0.75 scale
    let headY = 1.60 * 0.75;
    mesh.traverse((obj: any) => {
      if (obj.name === "Head") {
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        if (wp.y > 0.3) headY = wp.y;
      }
    });

    // Camera below head bone, angled up to meet the avatar's natural chin-down pose.
    // Narrow FOV (28°) gives a telephoto portrait crop — face + upper chest only.
    camera.position.set(0, headY - 0.18, 0.58);
    camera.lookAt(0, headY + 0.10, 0);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.90);
    renderer.dispose();
    return dataUrl;
  } catch {
    return "";
  }
}

// ── Stage 3: name input ───────────────────────────────────────────────────────

function showNameInput(body: HTMLDivElement, thumbnailDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    body.innerHTML = "";

    const wrap = el("div", {
      position: "absolute", inset: "0",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: "28px",
    });

    const label = el("div", {
      font: "11px Georgia,serif", letterSpacing: "0.22em",
      opacity: "0.4", textTransform: "uppercase", color: "white",
    });
    label.textContent = "What's your character's name?";

    const input = el("input", {
      background: "transparent",
      border: "none", borderBottom: "1px solid rgba(255,255,255,0.3)",
      color: "white", font: "22px Georgia,serif", letterSpacing: "0.06em",
      textAlign: "center", outline: "none", padding: "4px 0",
      width: "280px",
    }) as HTMLInputElement;
    input.placeholder = "My Character";
    input.maxLength   = 28;

    const confirm = el("button", {
      padding: "14px 56px",
      border: "1px solid rgba(255,255,255,0.25)", background: "transparent",
      color: "rgba(255,255,255,0.85)", font: "14px Georgia,serif",
      letterSpacing: "0.18em", borderRadius: "2px", cursor: "pointer",
    });
    confirm.textContent = "Let's go";

    // Headshot preview (data URL from offscreen render, or blank if not ready)
    if (thumbnailDataUrl) {
      const img = el("img", {
        width: "160px", height: "200px",
        objectFit: "cover", objectPosition: "top center",
        borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)",
        display: "block",
      }) as HTMLImageElement;
      img.src = thumbnailDataUrl;
      img.onerror = () => { img.style.display = "none"; };
      wrap.appendChild(img);
    }

    const go = () => resolve(input.value.trim() || input.placeholder);
    confirm.addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.code === "Enter") go(); });

    wrap.append(label, input, confirm);
    body.appendChild(wrap);

    setTimeout(() => input.focus(), 50);
  });
}

// ── Setup-required screen ─────────────────────────────────────────────────────

function showSetupRequired(body: HTMLDivElement): void {
  body.innerHTML = `
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:48px;color:white;text-align:center">
      <div style="font:38px Georgia,serif;letter-spacing:0.04em;opacity:0.9">Coming soon</div>
      <div style="font:20px Georgia,serif;opacity:0.55;line-height:1.7;max-width:520px">
        Custom character creation is still being set up.<br>
        Check back after the next update.
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:28px 36px;text-align:left;font:16px monospace;line-height:2.1;max-width:560px;width:100%">
        <div style="opacity:0.4;margin-bottom:10px;font:13px Georgia,serif;letter-spacing:0.15em;text-transform:uppercase">For developers</div>
        <div style="opacity:0.75">1. Sign up free at <a href="https://avaturn.me" target="_blank" style="color:rgba(160,200,255,0.9);text-decoration:none">avaturn.me</a> → Create Project</div>
        <div style="opacity:0.75">2. Copy your project subdomain (e.g. <em>my-game</em>)</div>
        <div style="opacity:0.75">3. In <code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:2px">src/ui/AvatarCreator.ts</code>, set:</div>
        <div style="opacity:0.55;padding-left:20px">export const AVATURN_URL =<br>&nbsp;&nbsp;<span style="color:rgba(160,255,160,0.8)">"https://my-game.avaturn.dev"</span>;</div>
      </div>
      <div style="font:15px Georgia,serif;opacity:0.3;letter-spacing:0.06em">Takes about 2 minutes · Free forever</div>
    </div>
  `;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function openAvatarCreator(avaturnUrl = AVATURN_URL): Promise<AvatarCreatorResult | null> {
  const { overlay, body, close } = buildOverlay();

  let cancelled = false;

  const cleanup = () => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.3s ease";
    setTimeout(() => overlay.remove(), 320);
  };

  return new Promise<AvatarCreatorResult | null>((resolve) => {
    close.addEventListener("click", () => {
      cancelled = true;
      cleanup();
      resolve(null);
    });

    (async () => {
      try {
        if (!avaturnUrl) {
          showSetupRequired(body);
          return;
        }

        // Stage 1 — Avaturn creator
        const glbUrl = await showAvaturnCreator(body, avaturnUrl);
        if (cancelled || !glbUrl) return;

        // Stage 2 — download GLB + generate thumbnail
        showSpinner(body, "Building your character…");
        const { buffer, avatarId } = await downloadGLB(glbUrl);
        if (cancelled) return;

        showSpinner(body, "Generating preview…");
        const thumbnailDataUrl = await renderAvatarHeadshot(buffer);
        if (cancelled) return;

        // Stage 3 — name input with portrait preview
        const name = await showNameInput(body, thumbnailDataUrl);
        if (cancelled) return;

        await saveCustomChar({ glbBuffer: buffer, avatarId, name, thumbnailDataUrl });

        cleanup();
        resolve({ glbBuffer: buffer, avatarId, name, thumbnailDataUrl });
      } catch (err) {
        console.error("[AvatarCreator]", err);
        cleanup();
        resolve(null);
      }
    })();
  });
}
