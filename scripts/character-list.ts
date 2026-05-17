#!/usr/bin/env node
// npm run character:list — lists all characters in public/characters/

import fs from "fs";
import path from "path";

const CHARS_DIR = "public/characters";

if (!fs.existsSync(CHARS_DIR)) {
  console.log("No characters directory found.");
  process.exit(0);
}

const slugs = fs.readdirSync(CHARS_DIR).filter((d) =>
  fs.statSync(path.join(CHARS_DIR, d)).isDirectory()
);

if (slugs.length === 0) {
  console.log("No characters found in public/characters/.");
  process.exit(0);
}

console.log(`\nCharacters in public/characters/ (${slugs.length}):\n`);
for (const slug of slugs) {
  const dir       = path.join(CHARS_DIR, slug);
  const metaPath  = path.join(dir, "meta.json");
  const hasGlb    = fs.existsSync(path.join(dir, "character.glb"));
  const hasThumb  = fs.existsSync(path.join(dir, "thumbnail.png"));

  let name = slug;
  let anims = "";
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      name  = meta.name ?? slug;
      anims = Object.keys(meta.animations ?? {}).join(", ");
    } catch {}
  }

  const glbStr   = hasGlb   ? "✓" : "missing";
  const thumbStr = hasThumb ? "✓" : "missing";

  console.log(`  ${slug.padEnd(16)} ${name.padEnd(20)} glb: ${glbStr.padEnd(8)} thumb: ${thumbStr.padEnd(8)} anims: ${anims}`);
}
console.log();
