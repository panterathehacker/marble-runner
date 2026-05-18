# Marble Runner

**Walk around any Gaussian splat world as yourself in third-person.**

Made for [World Labs Marble](https://marble.worldlabs.ai).

---

## Play now (no install)

Visit **[marble-runner.vercel.app](https://marble-runner.vercel.app)**

- Pick one of five default worlds.
- Choose a character or **make your own** (Avaturn avatar creator, takes ~60 seconds).
- Walk, run, jump with WASD · Shift · Space.

No sign-up. No API key. No install.

---

## Or, use your own Marble world

Open Claude Code and paste this one prompt — Claude handles the clone, install, dev server, and world setup automatically:

> "Clone https://github.com/panterathehacker/marble-runner, install dependencies, and start the dev server. Then add my world: my splat file is at `[/path/to/your-scene.spz]` and I want to call it `[World Name]`. Set up the world folder and generate a flat collider so I can walk around."

That's it. In about two minutes you'll be walking around your world.


### If you already cloned the repo

Have your `.spz` file ready and tell Claude:

> "Add my world to Marble Runner. My splat file is at `[/path/to/your-scene.spz]` and I want to call it `[World Name]`. Set up the world folder and generate a flat collider so I can walk around."

Claude will create `public/worlds/your-world/`, copy the splat, scaffold a physics collider, write `meta.json`, and restart the dev server.

Get a .spz world file by generating a world in Marble.

---

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| `Shift` | Run |
| `Space` | Jump |
| Mouse drag | Camera orbit |
| `Tab` | Toggle debug / character panel |

---

## Project structure

```
marble-runner/
├── marble.config.ts       ← the one file you edit
├── public/
│   ├── worlds/            ← one folder per world (splat.spz + collider.glb + meta.json)
│   └── characters/        ← a/ b/ c/ — GLB + animations + thumbnail
└── src/
    ├── core/              — Engine, Physics (Rapier), AssetLoader
    ├── character/         — CharacterController, CharacterAnimation, CameraRig
    ├── world/             — WorldLoader (Spark splat), WorldRegistry
    └── ui/                — CharacterPicker, AvatarCreator, HUD, DebugPanel
```

`marble.config.ts` is the only file you need to touch. Claude Code handles everything else.

---

## Tech stack

| | |
|---|---|
| Rendering | [Three.js](https://threejs.org) 0.183.2 + [Spark 2.0](https://github.com/sparkjsdev/spark) (World Labs) |
| Gaussian splat | `.spz` format, loaded via Spark's `SplatMesh` |
| Physics | [Rapier3D](https://rapier.rs) 0.19.3 — kinematic character controller |
| Characters | Mixamo GLBs — idle / walk / run / jump |
| Custom avatars | [Avaturn](https://avaturn.me) SDK — full 3D avatar creator in-browser |
| Build | Vite 8.x · TypeScript |

---

## Adding your own character

Marble Runner uses standard Mixamo GLBs. Any character exported from [Mixamo](https://mixamo.com) with idle, walk, run, and jump animations works out of the box.

See [`public/characters/README.md`](public/characters/README.md) for the spec and `meta.json` schema.

---

## npm scripts

```bash
npm run dev        # dev server at localhost:5173
npm run build      # production build → dist/
```

---

## Custom avatar (Avaturn)

The "Make Your Own" card uses Avaturn's public preview SDK and works with no setup. To use your own Avaturn project (custom avatar styles, branding):

1. Sign up at [avaturn.me](https://avaturn.me) → Create Project → copy your subdomain
2. In `src/ui/AvatarCreator.ts`, set `AVATURN_URL = "https://your-project.avaturn.dev"`

---

## License

MIT. Characters from [Mixamo](https://mixamo.com) (free for commercial use).

Marble worlds powered by [World Labs Marble](https://marble.worldlabs.ai).
