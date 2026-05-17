# Marble Runner — Claude Code Instructions

Walk around any Marble world in 60 seconds.

## What this project is

A third-person exploration template for World Labs' Marble.
Stack: Three.js 0.183.2 · Spark 2.0-preview · Rapier3D 0.19.3 · Vite 8.x · TypeScript

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at localhost |
| `npm run build` | Production build → dist/ |
| `npm run world:add <url>` | Download a Marble world from URL or world_id |
| `npm run world:gen "<prompt>"` | Generate a Marble world from a text prompt |
| `npm run world:list` | List worlds in public/worlds/ |
| `npm run character:list` | List characters in public/characters/ |
| `npm run character:combine -- <folder> --slug <slug>` | Convert Mixamo FBX files → GLB |

## Only file to edit by hand

`marble.config.ts` — worlds list, default character, physics/camera tuning.

## Asset paths (deterministic)

- Worlds:     `public/worlds/<slug>/splat.spz`, `collider.glb`, `meta.json`
- Characters: `public/characters/<slug>/character.glb`, `meta.json`, `thumbnail.png`
- Env:        `.env` (gitignored), `.env.example`

## Critical physics notes — do not change

```typescript
// WorldLoader.ts: Marble splats use Y-down convention
splatMesh.rotation.x = Math.PI;

// Physics.ts: collider must match the splat rotation
vertices[i * 3 + 1] *= -1;  // flip Y
vertices[i * 3 + 2] *= -1;  // flip Z
```

## Debugging

- Character falls through floor → Y+Z flip missing in Physics.ts
- World blank → check browser console, confirm splat.spz exists
- Physics floaty → tune `physics.jumpSpeed` / `physics.gravity` in marble.config.ts
- Camera clips → reduce `camera.distance` in marble.config.ts

## Dependency versions (pinned)

```
three                    0.183.2
@dimforge/rapier3d-compat 0.19.3
@sparkjsdev/spark        v2.0.0-preview
vite                     8.0.1
```
