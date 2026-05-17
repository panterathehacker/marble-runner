import type { WorldEntry } from "../types.ts";

/** Returns immediately if only one world. Shows a picker if more than one. */
export async function showWorldPicker(worlds: WorldEntry[]): Promise<string> {
  if (worlds.length <= 1) return worlds[0]?.slug ?? "_default";

  return new Promise<string>((resolve) => {
    const screen = document.createElement("div");
    Object.assign(screen.style, {
      position: "fixed", inset: "0", background: "#0a0a0f",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "28px",
      zIndex: "590", color: "white",
    });

    screen.innerHTML = `
      <div style="font:11px Georgia,serif;letter-spacing:0.24em;opacity:0.4;text-transform:uppercase">Choose a world</div>
      <div id="mr-world-list" style="display:flex;flex-direction:column;gap:12px;min-width:320px"></div>
    `;
    document.body.appendChild(screen);

    const list = document.getElementById("mr-world-list")!;
    for (const world of worlds) {
      const btn = document.createElement("button");
      Object.assign(btn.style, {
        padding: "14px 32px", border: "1px solid rgba(255,255,255,0.2)",
        background: "transparent", color: "rgba(255,255,255,0.8)",
        font: "14px Georgia,serif", letterSpacing: "0.1em",
        borderRadius: "2px", cursor: "pointer",
        transition: "border-color 0.2s, color 0.2s",
      });
      btn.textContent = world.name ?? world.slug;
      btn.addEventListener("mouseenter", () => {
        btn.style.borderColor = "rgba(255,255,255,0.5)";
        btn.style.color = "white";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.borderColor = "rgba(255,255,255,0.2)";
        btn.style.color = "rgba(255,255,255,0.8)";
      });
      btn.addEventListener("click", () => {
        screen.style.opacity = "0";
        screen.style.transition = "opacity 0.4s ease";
        setTimeout(() => { screen.remove(); resolve(world.slug); }, 420);
      });
      list.appendChild(btn);
    }
  });
}
