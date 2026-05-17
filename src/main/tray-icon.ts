import { app, nativeImage, type NativeImage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../utils/logger';

/** Embedded 1×1 PNG fallback als er geen assets-icoon is. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Nieuwste logo eerst; icon.png is kopie voor builds (npm run icons). */
const CANDIDATE_FILES = ['Tracker Icons.png', 'icon.png', 'tracker-icon.png'];

function assetDirs(): string[] {
  const dirs: string[] = [];
  const dev = path.join(__dirname, '../../assets');
  if (fs.existsSync(dev)) dirs.push(dev);
  const packaged = path.join(app.getAppPath(), 'assets');
  if (fs.existsSync(packaged) && !dirs.includes(packaged)) dirs.push(packaged);
  return dirs;
}

function findIconPath(): string | null {
  for (const dir of assetDirs()) {
    for (const file of CANDIDATE_FILES) {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function loadRawIcon(): NativeImage | null {
  const p = findIconPath();
  if (!p) return null;
  const img = nativeImage.createFromPath(p);
  if (img.isEmpty()) {
    logger.warn(`App-icoon leeg of onleesbaar: ${p}`);
    return null;
  }
  logger.info(`App-icoon geladen: ${p} (${img.getSize().width}×${img.getSize().height})`);
  return img;
}

/** Menubalk: 22pt + Retina 44pt; gekleurd logo (rood) blijft zichtbaar. */
function scaleForTray(img: NativeImage): NativeImage {
  const size = 22;
  const out = img.resize({ width: size, height: size, quality: 'best' });
  const retina = img.resize({ width: size * 2, height: size * 2, quality: 'best' });
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
  const img = loadRawIcon();
  if (img) return scaleForTray(img);
  logger.warn('Geen logo in assets/ — plaats Tracker Icons.png of icon.png');
  return nativeImage.createFromBuffer(PNG_1PX);
}

/** Dock en vensters: scherper op Retina-schermen. */
export function loadDockIcon(): NativeImage | null {
  const img = loadRawIcon();
  if (!img) return null;
  return img.resize({ width: 128, height: 128, quality: 'best' });
}

/** @deprecated Gebruik loadTrayIcon() */
export function createTrayImage(): NativeImage {
  return loadTrayIcon();
}
