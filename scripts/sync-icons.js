#!/usr/bin/env node
/**
 * Kopieert het bronlogo naar assets/icon.png voor tray, dock en electron-builder.
 * Bron: Tracker Icons.png (of icon.png als die nieuwer is).
 */
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'assets');
const sources = ['Tracker Icons.png', 'icon.png'];
const dest = path.join(assets, 'icon.png');

let srcPath = null;
for (const name of sources) {
  const p = path.join(assets, name);
  if (fs.existsSync(p)) {
    srcPath = p;
    break;
  }
}

if (!srcPath) {
  console.warn('[icons] Geen Tracker Icons.png of icon.png in assets/ — overgeslagen');
  process.exit(0);
}

if (path.resolve(srcPath) === path.resolve(dest)) {
  process.exit(0);
}

fs.copyFileSync(srcPath, dest);
console.log(`[icons] ${path.basename(srcPath)} → icon.png`);
