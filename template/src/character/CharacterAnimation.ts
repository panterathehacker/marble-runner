import * as THREE from "three";
import type { CharacterMeta } from "../types.ts";

export type AnimState = "idle" | "walk" | "run" | "jump";

const STATES: AnimState[] = ["idle", "walk", "run", "jump"];

export class CharacterAnimation {
  /** Live-tweakable params — mutate directly or bind to a GUI. */
  params = {
    crossfadeDuration: 0.2,
    walkAnimSpeed:     1.0,
    runAnimSpeed:      1.0,
  };

  // One mixer per skeleton root; each resolves its own bone tree independently.
  private mixers:  THREE.AnimationMixer[];
  // actions[i] = state → action map for mixers[i]
  private perMixerActions: Partial<Record<AnimState, THREE.AnimationAction>>[];
  private _state: AnimState = "idle";

  /**
   * roots: all skeleton roots to animate in sync.
   * Single-skeleton characters pass [mesh]. Avaturn passes [Arm0, Arm1, …, Arm4].
   */
  constructor(roots: THREE.Object3D[], clips: THREE.AnimationClip[], meta: CharacterMeta) {
    this.mixers           = roots.map((r) => new THREE.AnimationMixer(r));
    this.perMixerActions  = this.mixers.map(() => ({}));

    const named = new Map(clips.map((c) => [c.name, c]));

    const bindAll = (state: AnimState) => {
      const clipName = meta.animations[state];
      const clip = named.get(clipName) ?? clips.find((c) => c.name.toLowerCase().includes(state));
      if (!clip) {
        console.warn(`[CharacterAnimation] No clip for "${state}" (meta key: "${clipName}")`);
        return;
      }
      this.mixers.forEach((mixer, i) => {
        const action = mixer.clipAction(clip);
        if (state === "jump") { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
        else { action.setLoop(THREE.LoopRepeat, Infinity); }
        this.perMixerActions[i][state] = action;
      });
    };

    for (const s of STATES) bindAll(s);

    // Start idle on all mixers
    this.mixers.forEach((_, i) => { this.perMixerActions[i].idle?.play(); });
  }

  get state(): AnimState { return this._state; }

  transition(next: AnimState, fadeDuration?: number): void {
    if (next === this._state) return;
    const fade = fadeDuration ?? this.params.crossfadeDuration;
    const prev = this._state;

    const speedFor = (s: AnimState) =>
      s === "run" ? this.params.runAnimSpeed : s === "walk" ? this.params.walkAnimSpeed : 1.0;

    this.mixers.forEach((_, i) => {
      const prevAction = this.perMixerActions[i][prev];
      const nextAction = this.perMixerActions[i][next];
      if (!nextAction) return;
      prevAction?.fadeOut(fade);
      nextAction.reset().setEffectiveTimeScale(speedFor(next)).setEffectiveWeight(1).fadeIn(fade).play();
    });

    this._state = next;
  }

  isJumpDone(): boolean {
    const a = this.perMixerActions[0]?.jump;
    return a ? !a.isRunning() : true;
  }

  update(dt: number): void {
    for (const m of this.mixers) m.update(dt);
  }
}
