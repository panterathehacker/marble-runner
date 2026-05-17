#!/usr/bin/env node
// npm run character:combine -- <folder> --slug <slug> [--prefix a] [--name "Name"]
//
// Converts 4 Mixamo FBX files → a single GLB with all animations baked in.
// Detects which FBX is which by searching filenames for: idle, walk, run, jump.
//
// Examples:
//   # All 4 FBX files in their own folder:
//   npm run character:combine -- ./runner-fbxs --slug runner --name "Runner"
//
//   # Multiple characters in one folder, filtered by prefix:
//   npm run character:combine -- ../Character --prefix a --slug a --name "Character A"
//   npm run character:combine -- ../Character --prefix b --slug b --name "Character B"
//
// Output: public/characters/<slug>/character.glb + meta.json

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { NodeIO, Document, Node as GNode, Animation } from "@gltf-transform/core";

// ── CLI args ──────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const dir     = args.find((a) => !a.startsWith("--"));
const argGet  = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const slug    = argGet("--slug");
const name    = argGet("--name") ?? slug;
const prefix  = argGet("--prefix")?.toLowerCase() ?? null; // e.g. "a" filters "a_idle.fbx"

if (!dir || !slug) {
  console.error("Usage: npm run character:combine -- <folder> --slug <slug> [--prefix a] [--name \"Name\"]");
  console.error("\nExamples:");
  console.error("  # Dedicated folder per character:");
  console.error("  npm run character:combine -- ./runner-fbxs --slug runner");
  console.error("\n  # Shared folder, multiple characters:");
  console.error("  npm run character:combine -- ../Character --prefix a --slug a --name \"Character A\"");
  console.error("\nThe script detects idle/walk/run/jump by searching filenames for those keywords.");
  process.exit(1);
}

if (!fs.existsSync(dir)) {
  console.error(`✗ Folder not found: ${dir}`);
  process.exit(1);
}

// ── Locate FBX2glTF binary ────────────────────────────────────────────────────

const platform = process.platform === "win32" ? "Windows_NT" : process.platform === "darwin" ? "Darwin" : "Linux";
const binName  = process.platform === "win32" ? "FBX2glTF.exe" : "FBX2glTF";
const binPath  = path.resolve(`node_modules/fbx2gltf/bin/${platform}/${binName}`);

if (!fs.existsSync(binPath)) {
  console.error(`✗ fbx2gltf binary not found at ${binPath}`);
  console.error("  Run: npm install");
  process.exit(1);
}

// Ensure binary is executable (macOS quarantine sometimes resets this)
try {
  fs.chmodSync(binPath, 0o755);
  execFileSync("xattr", ["-cr", binPath], { stdio: "ignore" });
} catch { /* ignore xattr errors on Linux/Windows */ }

// ── Find FBX files ────────────────────────────────────────────────────────────

type AnimName = "idle" | "walk" | "run" | "jump";
const ANIM_KEYWORDS: Record<AnimName, string[]> = {
  idle: ["idle", "standing"],
  walk: ["walk", "walking"],
  run:  ["run", "running", "sprint"],
  jump: ["jump", "jumping", "fall"],
};

function detectAnim(filename: string): AnimName | null {
  const lower = filename.toLowerCase();
  for (const [anim, keywords] of Object.entries(ANIM_KEYWORDS) as [AnimName, string[]][]) {
    if (keywords.some((k) => lower.includes(k))) return anim;
  }
  return null;
}

const allFbx = fs.readdirSync(dir)
  .filter((f) => {
    if (!f.toLowerCase().endsWith(".fbx")) return false;
    // If --prefix is set, only include files whose names start with that prefix (case-insensitive)
    if (prefix) return f.toLowerCase().startsWith(prefix);
    return true;
  })
  .map((f) => ({ file: f, anim: detectAnim(f) }));

const detected: Partial<Record<AnimName, string>> = {};
for (const { file, anim } of allFbx) {
  if (anim && !detected[anim]) detected[anim] = path.join(dir, file);
}

const missing = (["idle", "walk", "run", "jump"] as AnimName[]).filter((a) => !detected[a]);
if (missing.length > 0) {
  const prefixNote = prefix ? ` (filtered by prefix "${prefix}")` : "";
  console.error(`✗ Could not detect animations: ${missing.join(", ")}${prefixNote}`);
  console.error(`  Files found: ${allFbx.map((f) => f.file).join(", ") || "(none)"}`);
  console.error(`  All FBX files in folder: ${fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".fbx")).join(", ")}`);
  console.error(`  Tip: include the animation name in the filename, e.g. "a_idle.fbx", "a_walk.fbx".`);
  process.exit(1);
}

console.log("\n[combine-mixamo] FBX files detected:");
for (const anim of ["idle", "walk", "run", "jump"] as AnimName[]) {
  console.log(`  ${anim.padEnd(6)} → ${path.basename(detected[anim]!)}`);
}

// ── Convert each FBX → GLB ───────────────────────────────────────────────────

const tmpDir = path.join(dir, ".tmp-glb");
fs.mkdirSync(tmpDir, { recursive: true });

function fbxToGlb(fbxPath: string, outBase: string): string {
  const outPath = path.join(tmpDir, outBase);
  console.log(`\n  Converting ${path.basename(fbxPath)} → ${outBase}.glb`);
  try {
    execFileSync(binPath, [
      fbxPath,
      "--output", outPath,
      "--binary",
      "--anim-framerate", "bake30",
    ], { stdio: "pipe" });
  } catch (e: any) {
    const msg = e.stderr?.toString() ?? e.message;
    throw new Error(`FBX conversion failed for ${path.basename(fbxPath)}:\n${msg}`);
  }
  const glbPath = `${outPath}.glb`;
  if (!fs.existsSync(glbPath)) throw new Error(`Expected output not found: ${glbPath}`);
  return glbPath;
}

console.log("\n[combine-mixamo] Converting FBX → GLB...");
const glbPaths: Record<AnimName, string> = {
  idle: fbxToGlb(detected.idle!, "idle"),
  walk: fbxToGlb(detected.walk!, "walk"),
  run:  fbxToGlb(detected.run!,  "run"),
  jump: fbxToGlb(detected.jump!, "jump"),
};

// ── Merge GLBs using @gltf-transform ─────────────────────────────────────────

console.log("\n[combine-mixamo] Merging animations...");

const io = new NodeIO();

// Load all 4 documents
const docs: Record<AnimName, Document> = {
  idle: await io.read(glbPaths.idle),
  walk: await io.read(glbPaths.walk),
  run:  await io.read(glbPaths.run),
  jump: await io.read(glbPaths.jump),
};

// Use idle as the base document (has the mesh + skeleton)
const baseDoc = docs.idle;

// Build name→Node map for the base document
const nodeMap = new Map<string, GNode>();
baseDoc.getRoot().listNodes().forEach((n) => nodeMap.set(n.getName(), n));

// Copy the first animation from a source document into baseDoc
function copyAnimation(srcDoc: Document, animName: string): void {
  const srcAnims = srcDoc.getRoot().listAnimations();
  if (srcAnims.length === 0) {
    console.warn(`  Warning: no animation found in ${animName} GLB — skipping`);
    return;
  }
  const srcAnim = srcAnims[0];
  const dstAnim = baseDoc.createAnimation(animName);

  for (const channel of srcAnim.listChannels()) {
    const srcNode = channel.getTargetNode();
    if (!srcNode) continue;
    const dstNode = nodeMap.get(srcNode.getName());
    if (!dstNode) {
      // Try stripping Mixamo armature prefix (e.g. "Armature|mixamorigHips" → "mixamorigHips")
      const stripped = srcNode.getName().replace(/^[^|]+\|/, "");
      const fallback = nodeMap.get(stripped);
      if (!fallback) continue;
    }
    const resolvedDst = nodeMap.get(srcNode.getName())
      ?? nodeMap.get(srcNode.getName().replace(/^[^|]+\|/, ""));
    if (!resolvedDst) continue;

    const srcSampler = channel.getSampler();
    if (!srcSampler) continue;
    const srcInput  = srcSampler.getInput();
    const srcOutput = srcSampler.getOutput();
    if (!srcInput || !srcOutput) continue;

    const dstInput = baseDoc.createAccessor()
      .setType(srcInput.getType())
      .setArray(srcInput.getArray()!.slice());

    const dstOutput = baseDoc.createAccessor()
      .setType(srcOutput.getType())
      .setArray(srcOutput.getArray()!.slice());

    const dstSampler = baseDoc.createAnimationSampler()
      .setInput(dstInput)
      .setOutput(dstOutput)
      .setInterpolation(srcSampler.getInterpolation());

    const dstChannel = baseDoc.createAnimationChannel()
      .setTargetNode(resolvedDst)
      .setTargetPath(channel.getTargetPath()!)
      .setSampler(dstSampler);

    dstAnim.addChannel(dstChannel).addSampler(dstSampler);
  }

  console.log(`  ✓ ${animName} (${dstAnim.listChannels().length} channels)`);
}

// Rename existing idle animation (first anim in base doc)
const existingAnims = baseDoc.getRoot().listAnimations();
if (existingAnims.length > 0) {
  existingAnims[0].setName("idle");
  console.log(`  ✓ idle (renamed existing)`);
}

// Copy walk, run, jump from their source documents
copyAnimation(docs.walk, "walk");
copyAnimation(docs.run,  "run");
copyAnimation(docs.jump, "jump");

// ── Strip Hips root-motion position tracks (Mixamo bakes position into Hips) ──

for (const anim of baseDoc.getRoot().listAnimations()) {
  for (const channel of anim.listChannels()) {
    const node = channel.getTargetNode();
    if (!node) continue;
    const nodeName = node.getName().toLowerCase();
    if (nodeName.includes("hips") && channel.getTargetPath() === "translation") {
      channel.dispose();
    }
  }
}

// ── Strip Mixamo armature prefix from node names ──────────────────────────────

for (const node of baseDoc.getRoot().listNodes()) {
  const cleaned = node.getName().replace(/^[^|]+\|/, "");
  node.setName(cleaned);
}

// ── Write combined GLB ────────────────────────────────────────────────────────

const outDir = `public/characters/${slug}`;
fs.mkdirSync(outDir, { recursive: true });
const outGlb = path.join(outDir, "character.glb");

await io.write(outGlb, baseDoc);
const sizeMb = (fs.statSync(outGlb).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ Wrote ${outGlb} (${sizeMb} MB)`);

// ── Detect final animation clip names ────────────────────────────────────────

const finalAnims = baseDoc.getRoot().listAnimations();
const clipNames  = Object.fromEntries(finalAnims.map((a) => [a.getName() as AnimName, a.getName()])) as Record<AnimName, string>;

// ── Write meta.json ───────────────────────────────────────────────────────────

const meta = {
  name: name ?? slug,
  slug,
  scale: 1.0,  // fbx2gltf converts Mixamo cm → meters automatically
  animations: {
    idle: clipNames["idle"] ?? "idle",
    walk: clipNames["walk"] ?? "walk",
    run:  clipNames["run"]  ?? "run",
    jump: clipNames["jump"] ?? "jump",
  },
};
fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));
console.log(`✓ Wrote ${outDir}/meta.json`);

// ── Cleanup temp files ────────────────────────────────────────────────────────

try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

// ── Rebuild character manifest ────────────────────────────────────────────────

const manifestSlugs = fs.readdirSync("public/characters").filter((d) =>
  fs.statSync(`public/characters/${d}`).isDirectory() &&
  fs.existsSync(`public/characters/${d}/meta.json`)
);
fs.writeFileSync("public/characters/manifest.json", JSON.stringify(manifestSlugs, null, 2));
console.log(`✓ Updated public/characters/manifest.json: [${manifestSlugs.join(", ")}]`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n[combine-mixamo] Done!\n`);
console.log(`Character "${name}" is ready at public/characters/${slug}/`);
console.log(`\nAnimation clips in the GLB:`);
for (const [state, clipName] of Object.entries(meta.animations)) {
  console.log(`  ${state.padEnd(6)} → "${clipName}"`);
}
console.log(`\nTo add a thumbnail, place a 256×256 PNG at:`);
console.log(`  public/characters/${slug}/thumbnail.png`);
console.log(`\nThen set in marble.config.ts:`);
console.log(`  defaultCharacter: "${slug}"`);
