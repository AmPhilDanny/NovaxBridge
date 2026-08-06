#!/usr/bin/env node
/**
 * Downloads the mediasoup prebuilt worker binary from GitHub releases.
 * This avoids the C++ compilation step that requires 6-8GB RAM.
 *
 * Asset naming convention (mediasoup >=3.x):
 *   mediasoup-worker-{version}-{platform}-{arch}-kernel{N}.tgz  (Linux)
 *   mediasoup-worker-{version}-{platform}-{arch}.tgz             (macOS/Windows)
 *
 * Run via: node scripts/download-mediasoup-worker.mjs
 */

import { createWriteStream, existsSync, mkdirSync, chmodSync, readFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.join(__dirname, '..');

// Read mediasoup version from its package.json
const mediasoupPkgPath = path.join(serverRoot, 'node_modules', 'mediasoup', 'package.json');

if (!existsSync(mediasoupPkgPath)) {
  console.log('[mediasoup-worker] mediasoup not installed yet — skipping worker download.');
  process.exit(0);
}

const mediasoupPkg = JSON.parse(readFileSync(mediasoupPkgPath, 'utf8'));
const version = mediasoupPkg.version;
console.log(`[mediasoup-worker] Package version: ${version}`);

// Determine platform/arch and asset name
const platform = process.platform; // 'linux', 'darwin', 'win32'
const arch = process.arch;          // 'x64', 'arm64'

function getAssetName(version, platform, arch) {
  if (platform === 'linux') {
    // Try kernel6 first (most common), fall back to kernel7
    return `mediasoup-worker-${version}-linux-${arch}-kernel6.tgz`;
  } else if (platform === 'darwin') {
    return `mediasoup-worker-${version}-darwin-${arch}.tgz`;
  } else if (platform === 'win32') {
    return `mediasoup-worker-${version}-win32-x64.tgz`;
  }
  return null;
}

const assetName = getAssetName(version, platform, arch);
if (!assetName) {
  console.log(`[mediasoup-worker] No prebuilt for ${platform}-${arch} — skipping.`);
  process.exit(0);
}

// Where mediasoup expects its worker binary
const workerDir = path.join(serverRoot, 'node_modules', 'mediasoup', 'worker', 'out', 'Release');
const workerBin = path.join(workerDir, platform === 'win32' ? 'mediasoup-worker.exe' : 'mediasoup-worker');

if (existsSync(workerBin)) {
  console.log(`[mediasoup-worker] Worker binary already present — skipping download.`);
  process.exit(0);
}

mkdirSync(workerDir, { recursive: true });

const downloadUrl = `https://github.com/versatica/mediasoup/releases/download/${version}/${assetName}`;
const tgzPath = path.join(workerDir, assetName);

console.log(`[mediasoup-worker] Downloading: ${downloadUrl}`);

try {
  // Download the .tgz
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    // Try kernel7 as fallback for Linux
    if (platform === 'linux') {
      const fallbackAsset = `mediasoup-worker-${version}-linux-${arch}-kernel7.tgz`;
      const fallbackUrl = `https://github.com/versatica/mediasoup/releases/download/${version}/${fallbackAsset}`;
      console.log(`[mediasoup-worker] kernel6 not found, trying kernel7: ${fallbackUrl}`);
      const resp2 = await fetch(fallbackUrl);
      if (!resp2.ok) {
        throw new Error(`HTTP ${resp2.status} on both kernel6 and kernel7 assets`);
      }
      const fileStream = createWriteStream(tgzPath);
      await pipeline(resp2.body, fileStream);
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } else {
    const fileStream = createWriteStream(tgzPath);
    await pipeline(response.body, fileStream);
  }

  console.log(`[mediasoup-worker] Download complete. Extracting...`);

  // Extract using system tar (available on Linux/macOS, and Node.js environments)
  await execAsync(`tar -xzf "${tgzPath}" -C "${workerDir}"`);

  // The binary inside the tgz may be at different paths — find it
  const { stdout } = await execAsync(`tar -tzf "${tgzPath}"`).catch(() => ({ stdout: '' }));
  console.log(`[mediasoup-worker] Archive contents:\n${stdout}`);

  // Make binary executable
  if (existsSync(workerBin)) {
    chmodSync(workerBin, 0o755);
    console.log(`[mediasoup-worker] ✅ Worker ready at: ${workerBin}`);
  } else {
    // The binary might be named differently inside the archive — list and find it
    console.log(`[mediasoup-worker] Worker not at expected path. Listing Release dir...`);
    const { stdout: ls } = await execAsync(`ls -la "${workerDir}"`);
    console.log(ls);
  }

  // Cleanup tgz
  await execAsync(`rm -f "${tgzPath}"`).catch(() => {});

} catch (err) {
  console.error(`[mediasoup-worker] ⚠ Failed to download/extract prebuilt worker: ${err.message}`);
  console.log(`[mediasoup-worker] mediasoup will attempt to compile at runtime if needed.`);
  // Do NOT exit with non-zero — let the build continue
}
