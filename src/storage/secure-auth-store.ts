import { safeStorage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { authFilePath } from './paths';
import type { AuthState } from '../types';
import { logger } from '../utils/logger';

/**
 * Persists bearer token using OS-backed encryption when available (Electron safeStorage).
 * Falls back to plain JSON only if encryption is unavailable (rare on modern Windows/macOS).
 */
export class SecureAuthStore {
  load(): AuthState | null {
    const p = authFilePath();
    if (!fs.existsSync(p)) return null;
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw) as { enc?: string; plain?: AuthState };
      if (parsed.enc && safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(parsed.enc, 'base64');
        const dec = safeStorage.decryptString(buf);
        return JSON.parse(dec) as AuthState;
      }
      if (parsed.plain) return parsed.plain;
    } catch (e) {
      logger.warn('Failed to read auth store', e);
    }
    return null;
  }

  save(state: AuthState): void {
    const p = authFilePath();
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    if (safeStorage.isEncryptionAvailable()) {
      const enc = safeStorage.encryptString(JSON.stringify(state));
      fs.writeFileSync(p, JSON.stringify({ enc: Buffer.from(enc).toString('base64') }), 'utf8');
    } else {
      logger.warn('safeStorage unavailable; writing plain auth file (not recommended)');
      fs.writeFileSync(p, JSON.stringify({ plain: state }), 'utf8');
    }
  }

  clear(): void {
    const p = authFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
