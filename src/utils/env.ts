import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Loads optional `.env` from the app root (development) or resources (packaged).
 * Production installers should prefer OS env or documented config file.
 *
 * Note: we tikken bewust niet `app.isPackaged` aan: in recente Electron-versies
 * is `app` op module-load nog niet geïnitialiseerd, wat de hele main crasht.
 * `process.resourcesPath` is altijd beschikbaar binnen Electron en wijst voor
 * een geïnstalleerde build naar de juiste map.
 */
function loadDotEnvFile(): void {
  const resourcesEnv =
    typeof process.resourcesPath === 'string' && process.resourcesPath
      ? path.join(process.resourcesPath, '.env')
      : '';
  const candidates = [path.join(process.cwd(), '.env'), resourcesEnv].filter(Boolean);

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
    break;
  }
}

loadDotEnvFile();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  remoteApiBaseUrl:
    process.env.REMOTE_API_BASE_URL?.replace(/\/$/, '') ||
    'https://timetraq.be',
  remoteActivityPath: process.env.REMOTE_ACTIVITY_PATH || '/api/activity',
  remoteLoginPath: process.env.REMOTE_LOGIN_PATH || '/api/login',
  activeWindowPollMs: num('ACTIVE_WINDOW_POLL_MS', 5000),
  syncIntervalMs: num('SYNC_INTERVAL_MS', 60_000),
  syncBatchSize: num('SYNC_BATCH_SIZE', 50),
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
};
