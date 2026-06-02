import activeWin from 'active-win';
import { isMacAccessibilityTrusted } from '../utils/mac-accessibility';

export interface NormalizedForeground {
  /** Executable or bundle name, e.g. Code.exe, Chrome */
  app_name: string;
  window_title: string;
}

/**
 * Reads the OS-reported foreground window. Uses active-win (native bindings).
 * No content capture — only title and owning app metadata exposed by the OS.
 */
export async function readForegroundWindow(): Promise<NormalizedForeground | null> {
  // Zonder toestemming active-win niet aanroepen — elke poll triggert anders opnieuw het macOS-dialoog.
  if (process.platform === 'darwin' && !isMacAccessibilityTrusted()) {
    return null;
  }

  try {
    const r = await activeWin({ screenRecordingPermission: false });
    if (!r) return null;
    const owner = r.owner?.name?.trim() || '';
    const title = (r.title || '').trim();
    const app_name = owner || 'unknown';
    return { app_name, window_title: title };
  } catch {
    return null;
  }
}
