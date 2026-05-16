import { app } from 'electron';
import * as path from 'node:path';

export function queueFilePath(): string {
  return path.join(app.getPath('userData'), 'activity-queue.json');
}

export function authFilePath(): string {
  return path.join(app.getPath('userData'), 'auth.enc.json');
}

export function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'tracker-settings.json');
}
