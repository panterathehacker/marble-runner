# Marble Runner — Claude Code Instructions

Walk around any Marble world in 60 seconds. Built for Claude Code.

## What this project is

Marble Runner is an open-source third-person exploration template for World Labs' Marble. It wires Three.js + Spark 2.0 + Rapier3D + Mixamo characters into a ready-to-use template. The user drops in a Marble world, picks a character, and runs through it.

Stack: Three.js 0.183.2 · Spark 2.0-preview · Rapier3D 0.19.3 · Vite 8.x · TypeScript

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server at localhost |
| `npm run build` | Production build → dist/ |
| `npm run world:add <url>` | Download a Marble world from URL or world_id |
| `npm run world:gen "<prompt>"` | Generate a new Marble world from text |
| `npm run world:list` | List all worlds in public/worlds/ |
| `npm run character:list` | List all characters in public/characters/ |

## Asset paths (deterministic — do not change)

- Worlds:     `public/worlds/<slug>/splat.spz`, `collider.glb`, `meta.json`
- Characters: `public/characters/<slug>/character.glb`, `meta.json`, `thumbnail.png`
- Config:     `marble.config.ts` (only file user is expected to edit by hand)
- Env:        `.env` (gitignored), `.env.example` (committed)

## Files an agent SHOULD edit

- `marble.config.ts` — add worlds, change default character, tune physics/camera
- `src/types.ts` — add new config fields
- `src/ui/CharacterPicker.ts` — character selection UI
- `src/ui/WorldPicker.ts` — world selection UI
- `src/ui/HUD.ts` — minimal HUD
- Any file in `scripts/` — CLI tools

## Files an agent should NOT edit

- `public/worlds/_default/splat.spz` — binary splat data
- `public/worlds/_default/collider.glb` — binary collider
- `node_modules/` — never
- `dist/` — build output

## Common operations (bash commands)

```bash
# Add a new world from a Marble URL:
npm run world:add https://marble.worldlabs.ai/world/abc123
# → then update marble.config.ts with the printed snippet

# Generate a world from a prompt:
npm run world:gen "A stone courtyard at twilight with a fountain"

# List everything:
npm run world:list
npm run character:list
```

## Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `WLT_API_KEY` | `world:add`, `world:gen` | Get at platform.worldlabs.ai/api-keys |

## Where to look for errors

- **Character not found** → `public/characters/<slug>/character.glb` is missing. Run `npm run character:list`.
- **World not loading** → Check browser console for SPZ load errors. Confirm `public/worlds/<slug>/splat.spz` exists.
- **Physics errors / character falls through** → Rapier WASM errors appear in browser console. The Y+Z flip in `src/core/Physics.ts` must match the `rotation.x = Math.PI` in `src/world/WorldLoader.ts`.
- **Character floaty** → Tune `physics.jumpSpeed` / `physics.gravity` in `marble.config.ts`.
- **Camera clips into geometry** → Tune `camera.distance` in `marble.config.ts`.

## Architecture overview

```
src/core/     Engine.ts (Three.js + Spark)
              Physics.ts (Rapier — Y+Z flip for Marble colliders)
              AssetLoader.ts (GLB/SPZ helpers)

src/character/ CharacterController.ts (KCC + WASD + jump)
               CharacterAnimation.ts (idle/walk/run/jump state machine)
               CharacterLoader.ts (loads slug → public/characters/<slug>/)
               CameraRig.ts (third-person follow + collision)

src/world/     WorldLoader.ts (SplatMesh + world switching)
               WorldRegistry.ts (reads marble.config.ts)

src/ui/        CharacterPicker.ts (thumbnail grid)
               WorldPicker.ts (shown if multiple worlds)
               HUD.ts (world name, loading, fade)

scripts/       world-add.ts, world-gen.ts, world-list.ts, character-list.ts

marble.config.ts   ← user's config (the one file they edit)
```

## Critical physics notes (do not change these patterns)

The Marble splat and collider require two coordinated transforms:

1. `splatMesh.rotation.x = Math.PI` — applied in WorldLoader.ts when creating SplatMesh
2. Y and Z vertex flip — applied in Physics.ts when loading the collider GLB:
   ```typescript
   vertices[i * 3 + 1] *= -1;  // flip Y
   vertices[i * 3 + 2] *= -1;  // flip Z
   ```

If you remove either of these, the character will walk on a phantom floor that doesn't match the visual world.

## Dependency versions (pinned — do not upgrade)

```json
"three":                   "0.183.2"
"@dimforge/rapier3d-compat": "0.19.3"
"@sparkjsdev/spark":       "github:sparkjsdev/spark#v2.0.0-preview"
"vite":                    "8.0.1"
```
