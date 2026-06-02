#!/usr/bin/env node
/**
 * Genereert alle app-iconen vanuit het OfficeMate-logo in assets/.
 * Past iOS-achtige afgeronde hoeken toe (squircle ~22%).
 *
 * Bron (eerste die bestaat): Logo.png → logoTransparent.png
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
const staticDir = path.join(root, 'static');

const LOGO_CANDIDATES = ['Logo.png', 'logoTransparent.png'];
/** Proportie zoals macOS/iOS app-iconen. */
const CORNER_RADIUS_RATIO = 0.2237;

function resolveLogoSrc() {
  for (const name of LOGO_CANDIDATES) {
    const p = path.join(assets, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function roundMaskSvg(size) {
  const r = Math.round(size * CORNER_RADIUS_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/>
    </svg>`,
  );
}

/** Vierkant canvas met logo gecentreerd (~88% vulling). */
function logoOnCanvas(sharp, logo, canvasSize) {
  const inner = Math.round(canvasSize * 0.88);
  const pad = Math.floor((canvasSize - inner) / 2);
  return logo
    .clone()
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top: pad,
      bottom: canvasSize - inner - pad,
      left: pad,
      right: canvasSize - inner - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
}

/** Maskeert naar afgeronde hoeken (transparant buiten de radius). */
function applyRoundedCorners(pipeline, size) {
  return pipeline
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: roundMaskSvg(size), blend: 'dest-in' }]);
}

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('[icons] Installeer sharp: npm install');
    process.exit(1);
  }

  const logoSrc = resolveLogoSrc();
  if (!logoSrc) {
    console.warn('[icons] Geen Logo.png of logoTransparent.png in assets/');
    process.exit(0);
  }

  const logo = sharp(logoSrc).ensureAlpha();
  const baseName = path.basename(logoSrc);

  const traySize = 32;
  await applyRoundedCorners(logoOnCanvas(sharp, logo, traySize), traySize)
    .png()
    .toFile(path.join(assets, 'tray-icon.png'));

  await applyRoundedCorners(logoOnCanvas(sharp, logo, 512), 512)
    .png()
    .toFile(path.join(assets, 'icon.png'));

  const trayBuf = await applyRoundedCorners(logoOnCanvas(sharp, logo, traySize), traySize)
    .png()
    .toBuffer();
  await sharp(trayBuf)
    .resize(64, 64, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(assets, 'tray-icon@2x.png'));

  await applyRoundedCorners(
    sharp(logoSrc).resize(160, 160, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    }),
    160,
  )
    .png()
    .toFile(path.join(staticDir, 'logo.png'));

  console.log(`[icons] ${baseName} → afgeronde tray-icon.png, icon.png (512), static/logo.png`);
}

main().catch((err) => {
  console.error('[icons]', err);
  process.exit(1);
});
