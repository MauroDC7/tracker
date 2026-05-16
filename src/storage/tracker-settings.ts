import * as fs from 'node:fs';
import * as path from 'node:path';
import { settingsFilePath } from './paths';

export interface TrackerSettings {
  /** When false, poller does not emit new segments (queue still flushes). */
  trackingEnabled: boolean;
  openAtLogin: boolean;
}

const defaultSettings: TrackerSettings = {
  trackingEnabled: true,
  openAtLogin: true,
};

export function loadSettings(): TrackerSettings {
  try {
    const p = settingsFilePath();
    if (!fs.existsSync(p)) return { ...defaultSettings };
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw) as Partial<TrackerSettings>;
    return { ...defaultSettings, ...j };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(s: TrackerSettings): void {
  const p = settingsFilePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2), 'utf8');
}
