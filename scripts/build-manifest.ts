#!/usr/bin/env node
// Regenerates public/characters/manifest.json from the current public/characters/ folder.
// Called automatically by combine-mixamo. Can also be run manually.

import fs from "fs";
import path from "path";

const CHARS_DIR = "public/characters";

const slugs = fs.existsSync(CHARS_DIR)
  ? fs.readdirSync(CHARS_DIR).filter((d) => {
      if (!fs.statSync(path.join(CHARS_DIR, d)).isDirectory()) return false;
      return fs.existsSync(path.join(CHARS_DIR, d, "meta.json"));
    })
  : [];

const manifest = slugs;
fs.writeFileSync(path.join(CHARS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`✓ manifest.json updated: [${slugs.join(", ")}]`);
