# public/characters/

Each subdirectory is a playable character. The folder name is its **slug**.

```
public/characters/
├── runner/
│   ├── character.glb      ← rigged GLB with all animations baked in
│   ├── meta.json          ← name, scale, animation clip names
│   └── thumbnail.png      ← 256×256 preview for the picker UI
└── ...
```

## meta.json schema

```json
{
  "name": "Runner",
  "slug": "runner",
  "scale": 1.0,
  "animations": {
    "idle": "Idle",
    "walk": "Walk",
    "run":  "Run",
    "jump": "Jump"
  }
}
```

The `animations` values must exactly match clip names inside `character.glb`.

## Adding a character (Phase 2)

```bash
npm run character:add ./my-character.glb --slug my-char --name "My Character"
```

## Required GLB spec

- Single skinned mesh or Object3D root with skinned mesh children
- T-pose at frame 0, facing -Z (standard Mixamo export)
- Four animation clips: `idle`, `walk`, `run`, `jump`
- Scale ~1.0 (character ~1.7m tall)
- File size under 20MB recommended
- glTF 2.0 binary (`.glb`)

## Mixamo quick path

1. Go to mixamo.com (free Adobe account)
2. Pick a character
3. Download "Idle" animation as FBX with skin, "In Place" checked
4. Repeat for Walk, Run, Jump with the same character
5. Combine into GLB using Blender or an online FBX→GLB converter
6. Run `npm run character:add` to install
