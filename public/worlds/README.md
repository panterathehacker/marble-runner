# public/worlds/

Each subdirectory is a Marble world. The folder name is its **slug**.

```
public/worlds/
├── _default/          ← bundled demo world (zero-config)
│   ├── splat.spz
│   ├── collider.glb
│   └── meta.json
└── my-castle/         ← your world (added via npm run world:add)
    ├── splat.spz
    ├── collider.glb
    └── meta.json
```

## Adding a world

```bash
# From a Marble URL:
npm run world:add https://marble.worldlabs.ai/world/abc123

# From a world_id:
npm run world:add abc123

# Generate from a prompt (requires WLT_API_KEY):
npm run world:gen "A misty Japanese temple at dawn"
```

Both commands print the config snippet to add to `marble.config.ts`.

## meta.json schema

```json
{
  "name": "My World",
  "slug": "my-world",
  "worldId": "abc123",
  "caption": "Generated caption from Marble",
  "groundPlaneOffset": 0,
  "metricScaleFactor": 1,
  "generatedAt": "2026-05-16T00:00:00.000Z"
}
```

`groundPlaneOffset` is used as the default spawn Y offset.
