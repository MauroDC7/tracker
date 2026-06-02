#!/usr/bin/env node
/**
 * Kopieert .env.production → .env.release voor electron-builder (resources/.env).
 * Voorkomt per ongeluk bouwen met lokale *.test URLs.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, '.env.production');
const dest = path.join(root, '.env.release');
const example = path.join(root, '.env.production.example');

if (!fs.existsSync(src)) {
  console.error('[release] Ontbreekt: .env.production');
  console.error('[release] Maak aan: cp .env.production.example .env.production');
  console.error('[release] Pas REMOTE_API_BASE_URL aan naar je live Combell/Laravel-domein.');
  process.exit(1);
}

const raw = fs.readFileSync(src, 'utf8');
const urlMatch = raw.match(/^REMOTE_API_BASE_URL=(.+)$/m);
const apiUrl = urlMatch?.[1]?.trim().replace(/^["']|["']$/g, '');

if (!apiUrl) {
  console.error('[release] REMOTE_API_BASE_URL ontbreekt in .env.production');
  process.exit(1);
}

if (
  apiUrl.includes('jouw-domein') ||
  apiUrl.includes('voorbeeld') ||
  apiUrl.includes('example.com')
) {
  console.error('[release] Vervang de placeholder-URL in .env.production:', apiUrl);
  process.exit(1);
}

let host = '';
try {
  host = new URL(apiUrl).hostname;
} catch {
  console.error('[release] Ongeldige REMOTE_API_BASE_URL:', apiUrl);
  process.exit(1);
}

if (
  host === 'localhost' ||
  host === '127.0.0.1' ||
  host.endsWith('.test') ||
  host.endsWith('.local')
) {
  console.error('[release] Productie-build mag geen lokale URL gebruiken:', apiUrl);
  console.error('[release] Zet je live domein (Combell) in .env.production.');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`[release] .env.production → .env.release (API: ${apiUrl})`);
