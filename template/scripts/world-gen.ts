#!/usr/bin/env node
// npm run world:gen "<prompt>" [--slug my-slug] [--name "My World"] [--model marble-1.0-draft] [--seed 42]
//
// Generates a new Marble world from a text prompt via the API, polls until done,
// downloads assets, and prints a config snippet to add to marble.config.ts.

import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const API_BASE = "https://api.worldlabs.ai/marble/v1";
const API_KEY  = process.env.WLT_API_KEY;

const args   = process.argv.slice(2);
const prompt = args.find((a) => !a.startsWith("--"));

if (!prompt) {
  console.error(`Usage: npm run world:gen "<prompt>" [--slug my-slug] [--name "My World"] [--model marble-1.0-draft] [--seed 42]`);
  console.error(`\nExample: npm run world:gen "A misty Japanese temple at dawn"`);
  process.exit(1);
}

if (!API_KEY) {
  console.error(
    "✗ WLT_API_KEY is not set.\n" +
    "  Add it to .env: WLT_API_KEY=your_key_here\n" +
    "  Get a key at: https://platform.worldlabs.ai/api-keys"
  );
  process.exit(1);
}

const argGet  = (flag: string) => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const model   = argGet("--model") ?? "marble-1.1-plus";
const argName = argGet("--name");
const argSlug = argGet("--slug");
const argSeed = argGet("--seed");

async function apiFetch(endpoint: string, method = "GET", body?: object): Promise<any> {
  const url  = endpoint.startsWith("http") ? endpoint : `${API_BASE}/${endpoint}`;
  const opts: RequestInit = {
    method,
    headers: { "WLT-Api-Key": API_KEY!, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${endpoint}: HTTP ${res.status} — ${text}`);
  return JSON.parse(text);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (!url) throw new Error(`No URL for ${destPath}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  process.stdout.write(`  Downloading → ${destPath} `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  console.log(`(${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const displayName = argName ?? `Generated World`;
  console.log(`\n[world:gen] Prompt: "${prompt}"`);
  console.log(`[world:gen] Model:  ${model}`);
  console.log(`[world:gen] This may take 3–10 minutes for marble-1.1-plus…\n`);

  const genBody: Record<string, any> = {
    world_prompt: { type: "text", text_prompt: prompt },
    model,
    display_name: displayName,
  };
  if (argSeed) genBody.seed = parseInt(argSeed, 10);

  const op    = await apiFetch("worlds:generate", "POST", genBody);
  const opId  = op.operation_id;
  if (!opId) throw new Error(`No operation_id in response: ${JSON.stringify(op)}`);
  console.log(`[world:gen] Operation: ${opId}`);

  let world: any;
  const start = Date.now();
  const TIMEOUT_MS = 15 * 60 * 1000;

  while (true) {
    await new Promise((r) => setTimeout(r, 10_000));
    const status = await apiFetch(`operations/${opId}`);
    if (status.error) throw new Error(`Generation failed: ${JSON.stringify(status.error)}`);

    const elapsed = Math.floor((Date.now() - start) / 1000);
    const pct     = status.metadata?.progress_percent ?? 0;
    process.stdout.write(`\r[world:gen] ${pct.toFixed(0)}% (${elapsed}s elapsed)   `);

    if (status.done) {
      console.log("\n[world:gen] Generation complete!");
      const worldId = status.response?.world_id;
      if (!worldId) throw new Error(`No world_id in response: ${JSON.stringify(status)}`);
      world = await apiFetch(`worlds/${worldId}`);
      break;
    }

    if (Date.now() - start > TIMEOUT_MS) throw new Error("Timed out waiting for world generation (15 min).");
  }

  const assets    = world.assets;
  const spzUrl    = assets?.splats?.spz_urls?.full_res;
  const collUrl   = assets?.mesh?.collider_mesh_url;
  const worldName = world.display_name ?? displayName;
  const groundOff = assets?.splats?.semantics_metadata?.ground_plane_offset ?? 0;
  const slug      = argSlug ?? worldName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!spzUrl) throw new Error("✗ No SPZ URL in generated world assets.");

  await downloadFile(spzUrl, `public/worlds/${slug}/splat.spz`);
  if (collUrl) await downloadFile(collUrl, `public/worlds/${slug}/collider.glb`);

  const meta = {
    name: worldName, slug, worldId: world.world_id,
    caption: assets?.caption,
    groundPlaneOffset: groundOff,
    metricScaleFactor: assets?.splats?.semantics_metadata?.metric_scale_factor ?? 1,
    generatedPrompt: prompt,
    model,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(`public/worlds/${slug}/meta.json`, JSON.stringify(meta, null, 2));

  console.log(`\n✓ Downloaded splat to    public/worlds/${slug}/splat.spz`);
  if (collUrl) console.log(`✓ Downloaded collider to public/worlds/${slug}/collider.glb`);
  console.log(`✓ Wrote                  public/worlds/${slug}/meta.json`);
  console.log(`\n✓ Add this to marble.config.ts:\n`);
  console.log(`  worlds: [`);
  console.log(`    {`);
  console.log(`      slug: "${slug}",`);
  console.log(`      name: "${worldName}",`);
  console.log(`      local: true,`);
  console.log(`      spawn: { x: 0, y: ${(1.6 + groundOff).toFixed(2)}, z: 0, yaw: Math.PI },`);
  console.log(`    },`);
  console.log(`  ],`);
}

main().catch((e: Error) => { console.error(`\n✗ world:gen failed: ${e.message}`); process.exit(1); });
