# Marble Runner

**Walk around any Gaussian splat world as a third-person character. Made for [World Labs Marble](https://marble.worldlabs.ai).**

Three ways to use it:

| | |
|---|---|
| 🌍 **[Play now →](https://marble-runner.vercel.app)** | Explore five worlds right in your browser. No install. |
| 🛠️ **[Use your own world](#github--claude-code)** | Clone + Claude Code. Tell Claude which world file to use. Takes ~2 min. |
| 📦 **[Scaffold a new project](#npx-create-marble-app)** | `npx create-marble-app my-world` |

---

## Play now

Visit **[marble-runner.vercel.app](https://marble-runner.vercel.app)**

- Pick one of five Marble worlds — Temple, Cathedral, Market, War Room, Throne Room
- Choose a character or **make your own** (powered by Avaturn — takes about 60 seconds)
- Walk, run, and jump with WASD · Shift · Space

No sign-up, no install, no API key required.

---

## GitHub + Claude Code

Use this if you want to walk around **your own Marble world**.

### 1. Clone and open

```bash
git clone https://github.com/panterathehacker/marble-runner
cd marble-runner
npm install
```

Open the folder in [Claude Code](https://claude.ai/code):

```bash
claude .
```

### 2. Tell Claude to add your world

Have your `.spz` splat file ready. Then just say:

> "Add my world to Marble Runner. My splat file is at `/path/to/my-scene.spz` and I want to call it My World. Set up the world folder and generate a flat collider."

Claude will:
- Create `public/worlds/my-world/`
- Copy your splat file as `splat.spz`
- Scaffold a `collider.glb` for physics
- Write `meta.json` and update `marble.config.ts`
- Restart the dev server

### 3. Run

```bash
npm run dev
```

Your world appears in the picker. Select it and walk around.

> **Don't have a `.spz` file yet?** Export one from [Luma AI](https://lumalabs.ai) or [Polycam](https://poly.cam). Any Gaussian splat in `.spz` format works.

---

## npx create-marble-app

Scaffold a fresh project in one command:

```bash
npx create-marble-app my-world
cd my-world
claude .
```

Then tell Claude to add your world (same prompt as above).

---

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| `Shift` | Run |
| `Space` | Jump |
| Mouse | Look (click canvas to lock pointer) |
| `Tab` | Toggle character customization panel |

---

## Project structure

```
marble-runner/
├── marble.config.ts       ← the one file you edit
├── public/
│   ├── worlds/            ← one folder per world (splat.spz + collider.glb + meta.json)
│   │   └── _default/      ← bundled demo world
│   └── characters/        ← a/ b/ c/ — GLB + animations + thumbnail
└── src/
    ├── core/              — Engine, Physics (Rapier), AssetLoader
    ├── character/         — CharacterController, CharacterAnimation, CameraRig
    ├── world/             — WorldLoader (Spark splat), WorldRegistry
    └── ui/                — CharacterPicker, WorldPicker, AvatarCreator, HUD, DebugPanel
```

`marble.config.ts` is the only file a typical user needs to touch. Claude Code handles everything else.

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

Marble Runner uses standard Mixamo GLBs. Any character exported from [Mixamo](https://mixamo.com) with idle, walk, run, and jump animations will work.

See [`public/characters/README.md`](public/characters/README.md) for the full spec and `meta.json` schema.

---

## npm scripts

```bash
npm run dev                          # dev server at localhost:5173
npm run build                        # production build → dist/
npm run world:list                   # list all worlds in public/worlds/
npm run character:list               # list all characters
```

---

## Custom avatar (Avaturn)

The "Make Your Own" card in the character picker uses the Avaturn SDK. The default URL (`https://demo.avaturn.dev`) is Avaturn's public preview and works out of the box.

To use your own Avaturn project (lets you customize avatar styles and branding):

1. Sign up free at [avaturn.me](https://avaturn.me) → Create Project → copy your subdomain
2. In `src/ui/AvatarCreator.ts`, set `AVATURN_URL = "https://your-project.avaturn.dev"`

---

## License

MIT. Characters from [Mixamo](https://mixamo.com) (free for commercial use).

Marble worlds powered by [World Labs Marble](https://marble.worldlabs.ai).
