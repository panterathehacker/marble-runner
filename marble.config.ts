import type { MarbleConfig } from "./src/types.ts";

export default {
  worlds: [
    // The _default world is bundled. Add your own worlds here.
    // {
    //   slug: "my-castle",
    //   name: "My Castle",
    //   source: "https://marble.worldlabs.ai/world/abc123",
    //   spawn: { x: 0, y: 1.6, z: 0, yaw: 0 },
    // },
    //
    // Or generate from a prompt (requires WLT_API_KEY in .env):
    // {
    //   slug: "my-forest",
    //   name: "Misty Forest",
    //   generated: { prompt: "A misty ancient forest at dawn with gnarled trees and a stream." },
    //   spawn: { x: 0, y: 1.6, z: 0, yaw: 0 },
    // },
    //
    // Or use pre-downloaded files in public/worlds/<slug>/:
    // {
    //   slug: "my-world",
    //   name: "My World",
    //   local: true,
    //   spawn: { x: 0, y: 1.6, z: 0, yaw: 0 },
    // },
  ],

  // Slug of the default character. Must match a folder in public/characters/.
  defaultCharacter: "a",

  // Slug of the default world. Falls back to '_default' if not set.
  defaultWorld: "_default",

  rendering: {
    lodSplatCount: 2500000,
    bloom: true,
    toneMapping: "aces",
    exposure: 1.2,
  },

  physics: {
    gravity: -9.81,
    jumpSpeed: 5,
    walkSpeed: 3,
    runSpeed: 5,
  },

  camera: {
    distance: 1.5,
    height: 1.5,
    sensitivity: 0.002,
  },
} satisfies MarbleConfig;
