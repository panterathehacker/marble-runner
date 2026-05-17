#!/usr/bin/env node
// create-marble-app — scaffolds a new Marble Runner project.
// Usage:
//   npx create-marble-app my-world
//   npx create-marble-app my-world --no-install
//   npx create-marble-app              (prompts for folder name)

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createInterface } from "readline";

const TEMPLATE_DIR = path.join(import.meta.dirname, "template");

// ── Args ──────────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const noInstall = args.includes("--no-install");
let   targetDir = args.find((a) => !a.startsWith("--"));

// ── Prompt if no name given ───────────────────────────────────────────────────

if (!targetDir) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  targetDir = await new Promise((resolve) => {
    rl.question("Project name: ", (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

if (!targetDir) {
  console.error("✗ No project name provided. Usage: npx create-marble-app my-world");
  process.exit(1);
}

const dest = path.resolve(process.cwd(), targetDir);

if (fs.existsSync(dest)) {
  console.error(`✗ Directory already exists: ${dest}`);
  process.exit(1);
}

if (!fs.existsSync(TEMPLATE_DIR)) {
  console.error(`✗ Template not found at ${TEMPLATE_DIR}`);
  console.error("  This usually means create-marble-app was not installed correctly.");
  process.exit(1);
}

// ── Copy template ─────────────────────────────────────────────────────────────

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyDir(TEMPLATE_DIR, dest);

// Rename _gitignore → .gitignore (npm strips .gitignore from published packages)
const gitignoreSrc = path.join(dest, "_gitignore");
if (fs.existsSync(gitignoreSrc)) {
  fs.renameSync(gitignoreSrc, path.join(dest, ".gitignore"));
}

// Write package.json with the user's project name
const pkgPath = path.join(dest, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.name = targetDir.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

console.log(`\n✓ Created ${targetDir}/\n`);

// ── npm install ───────────────────────────────────────────────────────────────

if (!noInstall) {
  console.log("Installing dependencies...\n");
  try {
    execSync("npm install", { cwd: dest, stdio: "inherit" });
    console.log("");
  } catch {
    console.warn("  npm install failed — run it manually inside the project folder.");
  }
}

// ── Next steps ────────────────────────────────────────────────────────────────

console.log(`Next steps:\n`);
console.log(`  cd ${targetDir}`);
if (noInstall) console.log("  npm install");
console.log("  npm run dev\n");
console.log("Or to add your own Marble world:");
console.log("  npm run world:add <your-marble-url>\n");
console.log("Documentation: https://github.com/panterathehacker/marble-runner");
