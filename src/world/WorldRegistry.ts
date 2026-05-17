import type { MarbleConfig, WorldEntry, SpawnPoint } from "../types.ts";

const DEFAULT_SPAWN: SpawnPoint = { x: 0, y: 1.6, z: 0, yaw: Math.PI };

export const BUNDLED_DEFAULTS: WorldEntry[] = [
  { slug: "world1", name: "Temple",     local: true, spawn: DEFAULT_SPAWN },
  { slug: "world2", name: "Cathedral",  local: true, spawn: DEFAULT_SPAWN },
  { slug: "world3", name: "Market",     local: true, spawn: DEFAULT_SPAWN },
  { slug: "world4", name: "War Room",    local: true, noFlip: true, spawn: { x: -4.78, y: 0.36, z: 7.37, yaw: Math.PI } },
  { slug: "world5", name: "Throne Room", local: true, noFlip: true, spawn: { x: -4.02, y: 0.09, z: 6.75, yaw: Math.PI } },
];

export class WorldRegistry {
  private config: MarbleConfig;
  private worlds: Map<string, WorldEntry>;
  private _randomDefault: string;

  constructor(config: MarbleConfig) {
    this.config = config;
    this.worlds = new Map<string, WorldEntry>();

    // Register bundled defaults
    for (const w of BUNDLED_DEFAULTS) {
      this.worlds.set(w.slug, w);
    }

    // Register user-configured worlds (takes priority over bundled defaults if slugs collide)
    for (const w of config.worlds) {
      this.worlds.set(w.slug, w);
    }

    // Pick a random bundled default once at startup (used when no user worlds)
    this._randomDefault = BUNDLED_DEFAULTS[Math.floor(Math.random() * BUNDLED_DEFAULTS.length)].slug;
  }

  hasUserWorlds(): boolean {
    return this.config.worlds.length > 0;
  }

  getBundledDefaults(): WorldEntry[] {
    return BUNDLED_DEFAULTS;
  }

  getRandomDefault(): string {
    return this._randomDefault;
  }

  getUserSlugs(): string[] {
    return this.config.worlds.map((w) => w.slug);
  }

  getEntry(slug: string): WorldEntry | undefined {
    return this.worlds.get(slug);
  }

  getSpawn(slug: string): SpawnPoint {
    return this.worlds.get(slug)?.spawn ?? DEFAULT_SPAWN;
  }

  getStartupSlug(): string {
    if (this.hasUserWorlds()) return this.config.worlds[0].slug;
    return this._randomDefault;
  }
}
