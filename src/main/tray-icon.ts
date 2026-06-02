import { app, nativeImage, type NativeImage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../utils/logger';

/** Embedded 1×1 PNG fallback als er geen assets-icoon is. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Gegenereerd door npm run icons; bron: Logo.png / logoTransparent.png */
const TRAY_FILES = ['tray-icon.png', 'icon.png', 'Logo.png', 'logoTransparent.png'];
const DOCK_FILES = ['icon.png', 'Logo.png', 'logoTransparent.png'];

/** macOS menubalk: 16pt logisch, 32px @2x (Apple HIG). */
const TRAY_LOGICAL_PX = 16;

function assetDirs(): string[] {
  const dirs: string[] = [];
  const dev = path.join(__dirname, '../../assets');
  if (fs.existsSync(dev)) dirs.push(dev);
  const packaged = path.join(app.getAppPath(), 'assets');
  if (fs.existsSync(packaged) && !dirs.includes(packaged)) dirs.push(packaged);
  return dirs;
}

function findAsset(candidates: string[]): string | null {
  for (const dir of assetDirs()) {
    for (const file of candidates) {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function loadFromPath(p: string): NativeImage | null {
  const img = nativeImage.createFromPath(p);
  if (img.isEmpty()) {
    logger.warn(`App-icoon leeg of onleesbaar: ${p}`);
    return null;
  }
  logger.info(`App-icoon geladen: ${p} (${img.getSize().width}×${img.getSize().height})`);
  return img;
}

/** Menubalk: 16×16 logisch + 32×32 @2x (tray-icon.png is al 32px bron). */
function scaleForTray(img: NativeImage): NativeImage {
  const size = TRAY_LOGICAL_PX;
  const { width } = img.getSize();
  const retina =
    width === size * 2
      ? img
      : img.resize({ width: size * 2, height: size * 2, quality: 'best' });
  const out = img.resize({ width: size, height: size, quality: 'best' });
  out.addRepresentation({
    scaleFactor: 2,
    width: size * 2,
    height: size * 2,
    buffer: retina.toPNG(),
  });
  out.setTemplateImage(false);
  return out;
}

export function loadTrayIcon(): NativeImage {
  const p = findAsset(TRAY_FILES);
  if (p) {
    const img = loadFromPath(p);
    if (img) return scaleForTray(img);
  }
  logger.warn('Geen tray-icoon — run npm run icons (Logo.png in assets/)');
  return nativeImage.createFromBuffer(PNG_1PX);
}

/** Dock en vensters: 128×128 vanuit 512px build-icoon. */
export function loadDockIcon(): NativeImage | null {
  const p = findAsset(DOCK_FILES);
  if (!p) return null;
  const img = loadFromPath(p);
  if (!img) return null;
  const { width, height } = img.getSize();
  if (width <= 128 && height <= 128) return img;
  return img.resize({ width: 128, height: 128, quality: 'best' });
}

/** @deprecated Gebruik loadTrayIcon() */
export function createTrayImage(): NativeImage {
  return loadTrayIcon();
}
