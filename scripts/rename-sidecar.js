#!/usr/bin/env node
/**
 * Renames a sidecar binary with the Tauri-required target triple suffix.
 * Usage: node scripts/rename-sidecar.js <source-binary>
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ext = process.platform === "win32" ? ".exe" : "";
const targetTriple = execSync("rustc --print host-tuple").toString().trim();

if (!targetTriple) {
  console.error("Failed to determine platform target triple");
  process.exit(1);
}

const binariesDir = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "src-tauri",
  "binaries"
);

const src = path.join(binariesDir, `hermes-sidecar${ext}`);
const dest = path.join(binariesDir, `hermes-sidecar-${targetTriple}${ext}`);

if (fs.existsSync(src)) {
  fs.renameSync(src, dest);
  console.log(`Renamed: ${src} -> ${dest}`);
} else {
  console.log(`Source not found: ${src}`);
  console.log(`Looking for existing sidecar with target triple...`);
  if (fs.existsSync(dest)) {
    console.log(`Found: ${dest}`);
  } else {
    console.error("No sidecar binary found. Run build-sidecar.py first.");
    process.exit(1);
  }
}
