import type { Result } from 'active-win';
import { isMacAccessibilityTrusted } from '../utils/mac-accessibility';
import { readActiveWindowMac } from './active-win-macos';
import { logger } from '../utils/logger';

export interface NormalizedForeground {
  /** Executable or bundle name, e.g. Code.exe, Chrome */
  app_name: string;
  window_title: string;
}

type ActiveWindowFn = (options?: import('active-win').Options) => Promise<Result | undefined>;

let activeWindowFn: ActiveWindowFn | null = null;
let loggedImportError = false;

/** Windows/Linux: dynamic import blijft ESM (werkt in Electron main). */
async function getActiveWindowNonMac(): Promise<ActiveWindowFn> {
  if (activeWindowFn) return activeWindowFn;
  const mod = await import('active-win');
  activeWindowFn = mod.activeWindow;
  return activeWindowFn;
}

/**
 * Leest het actieve venster.
 * macOS: execFile naar active-win/main (active-win@9 is ESM-only → require() in CJS faalt).
 */
export async function readForegroundWindow(): Promise<NormalizedForeground | null> {
  if (process.platform === 'darwin' && !isMacAccessibilityTrusted()) {
    return null;
  }

  try {
    let r: Result | undefined;

    if (process.platform === 'darwin') {
      r = await readActiveWindowMac();
    } else {
      const activeWindow = await getActiveWindowNonMac();
      r = await activeWindow();
    }

    if (!r) return null;
    const owner = r.owner?.name?.trim() || '';
    const title = (r.title || '').trim();
    const app_name = owner || 'unknown';
    return { app_name, window_title: title };
  } catch (err) {
    if (!loggedImportError) {
      loggedImportError = true;
      logger.error('readForegroundWindow mislukt', err);
    }
    return null;
  }
}
