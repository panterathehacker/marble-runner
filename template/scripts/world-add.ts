#!/usr/bin/env node
// npm run world:add <marble-url-or-world-id> [--slug my-slug] [--name "My World"]
//
// Downloads splat.spz + collider.glb from a Marble world URL or world_id.
// Prints a config snippet to add to marble.config.ts.

import fs from "fs";
import path from "path";
import { config } from "dotenv";
config();

const API_BASE = "https://api.worldlabs.ai/marble/v1";
const API_KEY  = process.env.WLT_API_KEY;

// ── CLI args ──────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const input  = args.find((a) => !a.startsWith("--"));
const argSlug = args.includes("--slug") ? args[args.indexOf("--slug") + 1] : null;
const argName = args.includes("--name") ? args[args.indexOf("--name") + 1] : null;

if (!input) {
  console.error("Usage: npm run world:add <marble-url-or-world-id> [--slug my-slug] [--name \"My World\"]");
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

// ── Parse world_id from URL or bare ID ───────────────────────────────────────

function parseWorldId(input: string): string {
  if (input.includes("marble.worldlabs.ai")) {
    const match = input.match(/\/world\/([a-zA-Z0-9_-]+)/);
    if (!match) throw new Error(`Cannot parse world_id from URL: ${input}`);
    return match[1];
  }
  return input.trim();
}

async function apiFetch(path: string): Promise<any> {
  const url  = path.startsWith("http") ? path : `${API_BASE}/${path}`;
  const res  = await fetch(url, { headers: { "WLT-Api-Key": API_KEY! } });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status} — ${text}`);
  return JSON.parse(text);
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  if (!url) throw new Error(`No URL provided for ${destPath}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1024) {
    const mb = (fs.statSync(destPath).size / 1024 / 1024).toFixed(1);
    console.log(`  Already exists: ${destPath} (${mb} MB)`);
    return;
  }

  process.stdout.write(`  Downloading → ${destPath} `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for asset URL`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  console.log(`(${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  const worldId = parseWorldId(input!);
  console.log(`\n[world:add] Fetching world ${worldId}…`);

  const world  = await apiFetch(`worlds/${worldId}`);
  const assets = world.assets;

  if (!assets) throw new Error(`No assets in API response. Response: ${JSON.stringify(world).slice(0, 200)}`);

  const spzUrl      = assets.splats?.spz_urls?.full_res;
  const colliderUrl = assets.mesh?.collider_mesh_url;
  const worldName   = argName ?? world.display_name ?? `World ${worldId.slice(0, 8)}`;
  const slug        = argSlug ?? worldName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const groundOff   = assets.splats?.semantics_metadata?.ground_plane_offset ?? 0;

  console.log(`  Name:  ${worldName}`);
  console.log(`  Slug:  ${slug}`);

  if (!spzUrl)      throw new Error("✗ No SPZ URL in world assets.");
  if (!colliderUrl) console.warn("  Warning: no collider URL — physics will use fallback ground plane.");

  await downloadFile(spzUrl,      `public/worlds/${slug}/splat.spz`);
  if (colliderUrl) await downloadFile(colliderUrl, `public/worlds/${slug}/collider.glb`);

  // Write meta.json
  const meta = {
    name: worldName, slug, worldId,
    source: typeof input === "string" && input.includes("marble.worldlabs.ai") ? input : undefined,
    caption: assets.caption,
    groundPlaneOffset: groundOff,
    metricScaleFactor: assets.splats?.semantics_metadata?.metric_scale_factor ?? 1,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(`public/worlds/${slug}/meta.json`, JSON.stringify(meta, null, 2));

  console.log(`\n✓ Downloaded splat to    public/worlds/${slug}/splat.spz`);
  if (colliderUrl) console.log(`✓ Downloaded collider to public/worlds/${slug}/collider.glb`);
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

main().catch((e: Error) => { console.error(`\n✗ world:add failed: ${e.message}`); process.exit(1); });
