export class HUD {
  private worldName:   HTMLElement;
  private fadeOverlay: HTMLElement;
  private loadScreen:  HTMLElement;
  private controls:    HTMLElement;
  private homeBtn:     HTMLElement;
  private elements:    HTMLElement[] = [];
  private onHomeCb?:   () => void;

  constructor() {
    this.fadeOverlay = this._el({
      position: "fixed", inset: "0", background: "black",
      opacity: "0", pointerEvents: "none", zIndex: "200",
      transition: "opacity 0.4s ease",
    });

    this.worldName = this._el({
      position: "fixed", top: "20px", left: "20px",
      color: "rgba(255,255,255,0.55)", font: "14px Georgia, serif",
      letterSpacing: "0.08em", textShadow: "0 0 8px rgba(0,0,0,0.9)",
      pointerEvents: "none", zIndex: "100",
    });

    this.homeBtn = this._el({
      position: "fixed", top: "46px", left: "20px",
      color: "rgba(255,255,255,0.25)", font: "11px Georgia, serif",
      letterSpacing: "0.1em", textShadow: "0 0 8px rgba(0,0,0,0.9)",
      cursor: "pointer", zIndex: "100",
      transition: "color 0.2s",
    });
    this.homeBtn.textContent = "← Home";
    this.homeBtn.addEventListener("mouseenter", () => {
      (this.homeBtn.style as any).color = "rgba(255,255,255,0.6)";
    });
    this.homeBtn.addEventListener("mouseleave", () => {
      (this.homeBtn.style as any).color = "rgba(255,255,255,0.25)";
    });
    this.homeBtn.addEventListener("click", () => this.onHomeCb?.());

    this.loadScreen = this._el({
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.92)",
      display: "none", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      zIndex: "300", color: "white",
    });
    this.loadScreen.innerHTML = `
      <div id="mr-load-title" style="font:18px Georgia,serif;letter-spacing:0.12em;margin-bottom:16px;opacity:0.8">Loading…</div>
      <div style="width:200px;height:2px;background:rgba(255,255,255,0.15);border-radius:1px;overflow:hidden">
        <div id="mr-load-bar" style="height:100%;width:0%;background:rgba(200,200,255,0.7);transition:width 0.15s ease"></div>
      </div>
    `;

    this.controls = this._el({
      position: "fixed", bottom: "28px", left: "50%",
      transform: "translateX(-50%)",
      color: "rgba(255,255,255,0.3)", font: "12px Georgia, serif",
      letterSpacing: "0.06em", pointerEvents: "none",
      zIndex: "100", textAlign: "center",
    });
    this.controls.textContent = "WASD · Shift to run · Space to jump";
  }

  private _el(styles: Partial<CSSStyleDeclaration>): HTMLElement {
    const el = document.createElement("div");
    Object.assign(el.style, styles);
    document.body.appendChild(el);
    this.elements.push(el);
    return el;
  }

  onHome(cb: () => void): void { this.onHomeCb = cb; }

  dispose(): void {
    this.elements.forEach((el) => el.remove());
    this.elements = [];
  }

  setWorldName(name: string): void { this.worldName.textContent = name; }

  showLoading(text: string): void {
    const title = document.getElementById("mr-load-title");
    if (title) title.textContent = text;
    this.setLoadingProgress(0);
    this.loadScreen.style.display = "flex";
  }

  hideLoading(): void { this.loadScreen.style.display = "none"; }

  setLoadingProgress(p: number): void {
    const bar = document.getElementById("mr-load-bar");
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  }

  fadeOut(): Promise<void> {
    return new Promise((resolve) => {
      this.fadeOverlay.style.opacity = "1";
      setTimeout(resolve, 450);
    });
  }

  fadeIn(): Promise<void> {
    return new Promise((resolve) => {
      this.fadeOverlay.style.opacity = "0";
      setTimeout(resolve, 450);
    });
  }

  hideControls(): void { this.controls.style.display = "none"; }
}
