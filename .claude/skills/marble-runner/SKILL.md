# Marble Runner Skill

Deep reference for Claude Code agents working in this project.

## Adding a world (3 methods)

### Method A: From a Marble URL or world_id
```bash
npm run world:add https://marble.worldlabs.ai/world/abc123
# or:
npm run world:add abc123
```
Requires `WLT_API_KEY` in `.env`. Script downloads splat + collider and prints a config snippet.
After running, paste the printed snippet into `marble.config.ts` → `worlds: [...]`.

### Method B: Pre-downloaded files
1. Place `splat.spz` and `collider.glb` in `public/worlds/<slug>/`
2. Create `public/worlds/<slug>/meta.json` with at least `{ "name": "...", "slug": "..." }`
3. Add to `marble.config.ts`:
   ```typescript
   { slug: "my-world", name: "My World", local: true, spawn: { x: 0, y: 1.6, z: 0, yaw: 0 } }
   ```

### Method C: Generate from a prompt
```bash
npm run world:gen "A misty Japanese temple at dawn" --name "Temple" --slug temple
```
Requires `WLT_API_KEY`. Takes 3–10 minutes for marble-1.1-plus. Use `--model marble-1.0-draft` for fast cheap iteration.

**When to use which:**
- A: User has an existing Marble world they want to walk through
- B: User already has files downloaded outside the project
- C: User wants to create a new world from a prompt

## Adding a character

Requires a `.glb` file with all 4 animation clips baked in.

### Rig requirements
- Single skinned mesh (or Object3D root with skinned children)
- T-pose at frame 0, facing -Z
- Four clips named exactly as in `meta.json`: `idle`, `walk`, `run`, `jump`
- Scale ~1.0 (character ~1.7m tall)
- Under 20MB

### Installation steps
1. Place `character.glb` in `public/characters/<slug>/`
2. Create `public/characters/<slug>/meta.json`:
   ```json
   {
     "name": "Runner",
     "slug": "runner",
     "scale": 1.0,
     "animations": { "idle": "Idle", "walk": "Walk", "run": "Run", "jump": "Jump" }
   }
   ```
3. Add `thumbnail.png` (256×256) if you have one
4. Update `marble.config.ts` → `defaultCharacter: "runner"`

### Mixamo quick path (manual steps)
1. Go to mixamo.com (free Adobe account)
2. Pick a character (e.g. "Xbot", "Ybot", or search by style)
3. Download each animation as FBX with skin, "In Place" ON:
   - Idle (any idle animation)
   - Walk (Walking)
   - Run (Running)
   - Jump (Jump or Falling Idle)
4. Combine FBX files into a single GLB using Blender:
   - Import each FBX into the same Blender scene
   - NLA editor → bake each animation as an NLA strip
   - Export as GLB with "Include > Custom Properties" ON and "Include > Animations" ON
5. Check clip names in the exported GLB (`gltf-transform inspect character.glb | grep Clip`)
6. Update `meta.json` animations to match exact clip names

## Debugging common issues

### Character falls through the floor
The Y+Z flip in `src/core/Physics.ts` and the `rotation.x = Math.PI` in `src/world/WorldLoader.ts` must both be present. If one is missing, the physics and visual worlds are in different coordinate spaces.

```typescript
// Physics.ts — must have both flips:
vertices[i * 3 + 1] *= -1;  // flip Y
vertices[i * 3 + 2] *= -1;  // flip Z
```

```typescript
// WorldLoader.ts — must have this:
(splatMesh as any).rotation.x = Math.PI;
```

### World won't load / blank screen
1. Open browser console (F12) for errors
2. Check `public/worlds/<slug>/splat.spz` exists and is > 1MB
3. Check `WLT_API_KEY` is set if using world:add or world:gen
4. Check vite.config.ts has `assetsInclude: ["**/*.spz", "**/*.glb"]`

### Physics feels floaty
Tune in `marble.config.ts`:
```typescript
physics: {
  gravity: -9.81,     // more negative = falls faster
  jumpSpeed: 5,       // lower = shorter jump
  walkSpeed: 3,
  runSpeed: 5,
}
```

### Character runs in the wrong direction relative to camera
The camera yaw is passed from `CameraRig.yaw` to `CharacterController.update(dt, camera.yaw)`. Make sure `main.ts` is calling both in the correct order.

### Camera clips through walls
Reduce `camera.distance` in `marble.config.ts`, or the camera collision ray in `CameraRig.ts` is not hitting the collider. Check that the collider loaded successfully (look for `[Physics] Loaded N collider mesh(es)` in the console).

## Architecture deep-dive

### The physics contract (per-frame)
```
1. Read WASD input → compute worldX, worldZ from camera yaw
2. Compute desired = { x: worldX * speed * dt, y: verticalVel * dt, z: worldZ * speed * dt }
3. kcc.computeColliderMovement(capsule, desired)
4. corrected = kcc.computedMovement()
5. grounded  = kcc.computedGrounded()
6. body.setNextKinematicTranslation(current + corrected)
7. if grounded: verticalVel = 0  (or jumpSpeed if jump pressed)
8. else: verticalVel += gravity * dt
```

### Splat loading (async)
SplatMesh is async. `await (splatMesh as any).initialized` before adding to scene. Cold loads of full-res SPZ take 5–30s depending on file size.

### World switching
When switching worlds: remove old SplatMesh from scene → call `physics.setColliderMesh(newColliderUrl)` (which clears old collider handles) → add new SplatMesh → teleport character to new spawn point.

## Reference

- Lightkeeper PRD (source codebase): `../JAM/LIGHTKEEPER_PRD (2).md`
- Marble Runner PRD: `../JAM/MARBLE_RUNNER_PRD.md`
- World Labs API: https://docs.worldlabs.ai/api
- Spark 2.0: https://sparkjs.dev/2.0.0-preview
- Rapier3D: https://rapier.rs/
