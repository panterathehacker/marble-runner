#!/usr/bin/env node
// npm run world:list — lists all worlds in public/worlds/

import fs from "fs";
import path from "path";

const WORLDS_DIR = "public/worlds";

if (!fs.existsSync(WORLDS_DIR)) {
  console.log("No worlds directory found. Run npm run world:add <url> to add your first world.");
  process.exit(0);
}

const slugs = fs.readdirSync(WORLDS_DIR).filter((d) =>
  fs.statSync(path.join(WORLDS_DIR, d)).isDirectory()
);

if (slugs.length === 0) {
  console.log("No worlds found in public/worlds/. Run npm run world:add <url>.");
  process.exit(0);
}

console.log(`\nWorlds in public/worlds/ (${slugs.length}):\n`);
for (const slug of slugs) {
  const dir      = path.join(WORLDS_DIR, slug);
  const metaPath = path.join(dir, "meta.json");
  const hasSplat   = fs.existsSync(path.join(dir, "splat.spz"));
  const hasCollider = fs.existsSync(path.join(dir, "collider.glb"));

  let name = slug;
  if (fs.existsSync(metaPath)) {
    try { name = JSON.parse(fs.readFileSync(metaPath, "utf-8")).name ?? slug; } catch {}
  }

  const splatMb = hasSplat ? (fs.statSync(path.join(dir, "splat.spz")).size / 1024 / 1024).toFixed(0) + " MB" : "missing";
  const collStr = hasCollider ? "✓" : "missing";

  console.log(`  ${slug.padEnd(20)} ${name.padEnd(30)} splat: ${splatMb.padEnd(8)} collider: ${collStr}`);
}
console.log();
