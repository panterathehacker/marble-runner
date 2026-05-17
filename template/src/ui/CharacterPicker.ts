import type { CharacterMeta, WorldEntry } from "../types.ts";
import { loadCustomChar, clearCustomChar } from "../character/CustomCharacterStore.ts";
import { openAvatarCreator } from "./AvatarCreator.ts";

const LS_KEY_CHAR  = "marble-runner:character";
const LS_KEY_WORLD = "marble-runner:world";
const CUSTOM_SLUG  = "_custom";

interface PickerEntry {
  slug:       string;
  name:       string;
  thumbnailUrl: string;
  /** True when no custom char is stored — shows "+" and opens the creator. */
  isCreateCard?: boolean;
}

export interface PickerResult {
  character: string;
  world: string;
}

// ── Character discovery ───────────────────────────────────────────────────────

async function discoverCharacters(): Promise<PickerEntry[]> {
  const manifestRes = await fetch("./characters/manifest.json").catch(() => null);
  let entries: PickerEntry[] = [];

  if (manifestRes?.ok) {
    const slugs: string[] = await manifestRes.json();
    entries = await Promise.all(slugs.map(async (slug) => {
      const meta: CharacterMeta = await fetch(`./characters/${slug}/meta.json`)
        .then((r) => r.json())
        .catch(() => ({ name: slug, slug, scale: 1, animations: {} as any }));
      return { slug, name: meta.name, thumbnailUrl: `./characters/${slug}/thumbnail.png` };
    }));
  } else {
    const KNOWN = ["runner", "traveler", "explorer", "monk", "astronaut", "a", "b", "c"];
    for (const slug of KNOWN) {
      const res = await fetch(`./characters/${slug}/meta.json`).catch(() => null);
      if (res?.ok) {
        const meta: CharacterMeta = await res.json();
        entries.push({ slug, name: meta.name, thumbnailUrl: `./characters/${slug}/thumbnail.png` });
      }
    }
  }

  // Check IndexedDB for a stored custom character
  const stored = await loadCustomChar().catch(() => null);
  if (stored) {
    entries.push({
      slug: CUSTOM_SLUG,
      name: stored.name,
      thumbnailUrl: stored.thumbnailDataUrl ?? "",
      isCreateCard: false,
    });
  } else {
    entries.push({ slug: CUSTOM_SLUG, name: "Make Your Own", thumbnailUrl: "", isCreateCard: true });
  }

  return entries;
}

// ── Picker ────────────────────────────────────────────────────────────────────

export async function showCharacterPicker(
  defaultCharSlug = "runner",
  worldOptions?: { defaults: WorldEntry[]; initialSlug: string },
): Promise<PickerResult> {
  const rememberedChar  = localStorage.getItem(LS_KEY_CHAR);
  const rememberedWorld = localStorage.getItem(LS_KEY_WORLD);
  const entries = await discoverCharacters();
  const realEntries = entries.filter((e) => !e.isCreateCard);

  // Auto-skip when only one selectable character and no world choice to make
  if (realEntries.length === 1 && !worldOptions) {
    localStorage.setItem(LS_KEY_CHAR, realEntries[0].slug);
    return { character: realEntries[0].slug, world: "" };
  }

  return new Promise<PickerResult>((resolve) => {
    const screen = document.createElement("div");
    Object.assign(screen.style, {
      position: "fixed", inset: "0", background: "#0a0a0f",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "28px",
      zIndex: "600", color: "white",
    });

    screen.innerHTML = `
      <div style="font:13px Georgia,serif;letter-spacing:0.28em;opacity:0.4;text-transform:uppercase">Choose your character</div>
      <div id="mr-picker-grid" style="display:flex;gap:28px;flex-wrap:wrap;justify-content:center;max-width:1200px;padding:0 32px"></div>
      ${worldOptions ? `<div id="mr-world-row" style="display:flex;flex-direction:column;align-items:center;gap:10px"></div>` : ""}
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <button id="mr-picker-start" style="
          padding:15px 60px;border:1px solid rgba(255,255,255,0.25);background:transparent;
          color:rgba(255,255,255,0.85);font:15px Georgia,serif;letter-spacing:0.18em;
          border-radius:2px;cursor:pointer;transition:border-color 0.2s,color 0.2s;
        ">Start</button>
        ${worldOptions ? `<button id="mr-use-own-world" style="
          background:none;border:none;color:rgba(255,255,255,0.3);font:12px Georgia,serif;
          letter-spacing:0.12em;cursor:pointer;text-decoration:underline;
          text-underline-offset:3px;padding:4px 8px;
        ">Use my own world</button>` : ""}
      </div>
    `;
    document.body.appendChild(screen);

    // ── "Use my own world" instructions overlay ───────────────────────────────
    const instructionsPanel = document.createElement("div");
    Object.assign(instructionsPanel.style, {
      position: "absolute", inset: "0", background: "#0a0a0f",
      display: "none", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "32px", padding: "48px", color: "white", zIndex: "1",
    });
    instructionsPanel.innerHTML = `
      <div style="font:13px Georgia,serif;letter-spacing:0.28em;opacity:0.4;text-transform:uppercase">Use your own world</div>
      <div style="font:16px Georgia,serif;opacity:0.55;line-height:1.8;text-align:center;max-width:520px">
        Have your <code style="background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:2px;font-size:14px">.spz</code> splat file ready, then just tell Claude:
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:28px 36px;max-width:620px;width:100%;position:relative">
        <div style="font:11px Georgia,serif;letter-spacing:0.18em;opacity:0.3;text-transform:uppercase;margin-bottom:16px">Prompt to copy</div>
        <div style="font:15px Georgia,serif;line-height:1.9;color:rgba(255,255,255,0.8)">
          "Add my world to Marble Runner. My splat file is at
          <span style="color:rgba(160,220,255,0.85)">[path/to/file.spz]</span>
          and I want to call it
          <span style="color:rgba(160,220,255,0.85)">[My World Name]</span>.
          Set up the world folder and generate a flat collider so I can walk around."
        </div>
      </div>
      <div style="font:13px Georgia,serif;opacity:0.35;line-height:2;text-align:center;max-width:500px">
        Claude will create the <code style="font-size:12px">public/worlds/</code> folder, move your file,<br>
        write <code style="font-size:12px">meta.json</code>, and scaffold a collider — then restart the server.
      </div>
      <button id="mr-back-btn" style="
        padding:12px 48px;border:1px solid rgba(255,255,255,0.2);background:transparent;
        color:rgba(255,255,255,0.6);font:13px Georgia,serif;letter-spacing:0.16em;
        border-radius:2px;cursor:pointer;
      ">← Back</button>
    `;
    screen.appendChild(instructionsPanel);

    const grid     = document.getElementById("mr-picker-grid")!;
    const startBtn = document.getElementById("mr-picker-start")! as HTMLButtonElement;

    const ownWorldBtn = document.getElementById("mr-use-own-world") as HTMLButtonElement | null;
    const backBtn     = instructionsPanel.querySelector("#mr-back-btn") as HTMLButtonElement;

    ownWorldBtn?.addEventListener("click", () => {
      instructionsPanel.style.display = "flex";
    });
    backBtn.addEventListener("click", () => {
      instructionsPanel.style.display = "none";
    });

    let selectedChar = (rememberedChar && realEntries.some((e) => e.slug === rememberedChar))
      ? rememberedChar
      : realEntries.find((e) => e.slug === defaultCharSlug)?.slug ?? realEntries[0]?.slug ?? "";

    // ── World carousel ────────────────────────────────────────────────────────
    let selectedWorld = worldOptions?.initialSlug ?? "";
    if (worldOptions) {
      const worlds = worldOptions.defaults;
      let worldIdx = worlds.findIndex((w) => w.slug === (rememberedWorld ?? worldOptions.initialSlug));
      if (worldIdx < 0) worldIdx = worlds.findIndex((w) => w.slug === worldOptions.initialSlug);
      if (worldIdx < 0) worldIdx = 0;
      selectedWorld = worlds[worldIdx]?.slug ?? worlds[0].slug;

      const worldRow = document.getElementById("mr-world-row")!;

      function renderWorldRow() {
        selectedWorld = worlds[worldIdx].slug;
        worldRow.innerHTML = `
          <div style="font:10px Georgia,serif;letter-spacing:0.22em;opacity:0.35;text-transform:uppercase">Your world this round</div>
          <div style="display:flex;align-items:center;gap:18px">
            <button id="mr-world-prev" style="
              background:none;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);
              font:18px Georgia,serif;width:36px;height:36px;border-radius:2px;cursor:pointer;
              display:flex;align-items:center;justify-content:center;
            ">‹</button>
            <div style="font:16px Georgia,serif;letter-spacing:0.06em;min-width:240px;text-align:center;color:rgba(255,255,255,0.85)">
              ${worlds[worldIdx].name}
            </div>
            <button id="mr-world-next" style="
              background:none;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);
              font:18px Georgia,serif;width:36px;height:36px;border-radius:2px;cursor:pointer;
              display:flex;align-items:center;justify-content:center;
            ">›</button>
          </div>
          <div style="font:10px Georgia,serif;letter-spacing:0.06em;opacity:0.25">${worldIdx + 1} of ${worlds.length}</div>
        `;
        document.getElementById("mr-world-prev")!.addEventListener("click", () => {
          worldIdx = (worldIdx - 1 + worlds.length) % worlds.length;
          renderWorldRow();
        });
        document.getElementById("mr-world-next")!.addEventListener("click", () => {
          worldIdx = (worldIdx + 1) % worlds.length;
          renderWorldRow();
        });
      }
      renderWorldRow();
    }

    // ── Placeholder image fallback ────────────────────────────────────────────
    function makePlaceholder(initial: string): HTMLDivElement {
      const div = document.createElement("div");
      Object.assign(div.style, {
        width: "220px", height: "280px",
        background: "rgba(255,255,255,0.05)", borderRadius: "3px",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: "56px Georgia,serif", color: "rgba(255,255,255,0.2)",
      });
      div.textContent = initial;
      return div;
    }

    // ── Character grid ────────────────────────────────────────────────────────
    function renderGrid() {
      grid.innerHTML = "";

      for (let i = 0; i < entries.length; i++) {
        const entry      = entries[i];
        const isSelected  = entry.slug === selectedChar;
        const isCreate    = !!entry.isCreateCard;

        const card = document.createElement("div");
        Object.assign(card.style, {
          display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
          cursor: "pointer", padding: "16px", position: "relative",
          border: isSelected ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "6px",
          background: isSelected ? "rgba(255,255,255,0.05)" : "transparent",
          opacity: "1",
          transition: "border-color 0.2s, background 0.2s",
        });

        // ── Thumbnail area ──────────────────────────────────────────────────
        if (isCreate) {
          // "+" create card
          const ph = document.createElement("div");
          Object.assign(ph.style, {
            width: "220px", height: "280px",
            background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: "3px", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "12px",
          });
          const plusIcon = document.createElement("div");
          Object.assign(plusIcon.style, { font: "40px Georgia,serif", color: "rgba(255,255,255,0.2)" });
          plusIcon.textContent = "+";
          const hint = document.createElement("div");
          Object.assign(hint.style, {
            font: "10px Georgia,serif", letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.2)", textTransform: "uppercase", textAlign: "center",
            padding: "0 16px",
          });
          hint.textContent = "Make your own";
          ph.appendChild(plusIcon);
          ph.appendChild(hint);
          card.appendChild(ph);
        } else {
          // Regular character or stored custom
          const img = document.createElement("img");
          img.src    = entry.thumbnailUrl;
          img.width  = 220; img.height = 280;
          Object.assign(img.style, {
            objectFit: "cover", objectPosition: "top", borderRadius: "3px", display: "block",
          });
          img.onerror = () => { img.replaceWith(makePlaceholder(entry.name[0])); };
          card.appendChild(img);

          // Redo badge for stored custom character
          if (entry.slug === CUSTOM_SLUG) {
            const redo = document.createElement("button");
            Object.assign(redo.style, {
              position: "absolute", bottom: "56px", left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.45)",
              color: "rgba(255,255,255,0.9)", font: "12px Georgia,serif",
              padding: "7px 20px", borderRadius: "3px", cursor: "pointer",
              letterSpacing: "0.12em", whiteSpace: "nowrap",
            });
            redo.textContent = "↺  Redo";
            redo.title = "Create a new character";
            redo.addEventListener("click", async (e) => {
              e.stopPropagation();
              await launchCreator(i);
            });
            card.appendChild(redo);
          }
        }

        // ── Label ───────────────────────────────────────────────────────────
        const label = document.createElement("div");
        label.textContent = entry.name;
        Object.assign(label.style, {
          font: "14px Georgia,serif", letterSpacing: "0.1em",
          color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
          textAlign: "center",
        });
        card.appendChild(label);

        // ── Click handler ───────────────────────────────────────────────────
        if (isCreate) {
          card.addEventListener("click", () => launchCreator(i));
        } else {
          card.addEventListener("click", () => { selectedChar = entry.slug; renderGrid(); });
        }

        grid.appendChild(card);
      }
    }

    // ── Launch RPM creator flow ───────────────────────────────────────────────
    async function launchCreator(entryIndex: number) {
      const result = await openAvatarCreator();
      if (!result) return; // user cancelled

      // Replace the entry at the given index with the new stored character
      entries[entryIndex] = {
        slug: CUSTOM_SLUG,
        name: result.name,
        thumbnailUrl: result.thumbnailDataUrl ?? "",
        isCreateCard: false,
      };
      selectedChar = CUSTOM_SLUG;
      renderGrid();
    }

    // ── Delete custom char ────────────────────────────────────────────────────
    // (exposed via the ⟳ Redo button which replaces rather than just deletes)

    renderGrid();

    startBtn.addEventListener("click", () => {
      localStorage.setItem(LS_KEY_CHAR, selectedChar);
      if (worldOptions) localStorage.setItem(LS_KEY_WORLD, selectedWorld);
      screen.style.opacity = "0";
      screen.style.transition = "opacity 0.4s ease";
      setTimeout(() => { screen.remove(); resolve({ character: selectedChar, world: selectedWorld }); }, 420);
    });

    document.addEventListener("keydown", function onKey(e) {
      if (e.code === "Enter") { document.removeEventListener("keydown", onKey); startBtn.click(); }
    });
  });
}
