import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Result } from 'active-win';
import { app } from 'electron';
import { isMacAccessibilityTrusted } from '../utils/mac-accessibility';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

let loggedBinaryPath: string | null = null;
let loggedReadError = false;

/** Pad naar active-win Swift-binary (dev + .app met asarUnpack). */
export function resolveActiveWinMainBinary(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/active-win/main'),
    path.join(app.getAppPath(), 'node_modules/active-win/main'),
    path.join(process.cwd(), 'node_modules/active-win/main'),
    path.join(__dirname, '../../node_modules/active-win/main'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function activeWinCliArgs(): string[] {
  const args = ['--no-accessibility-permission'];
  // Geen --no-screen-recording-permission: venstertitel wanneer macOS dat toelaat.
  return args;
}

/**
 * Roept active-win `main` direct aan (CommonJS-safe; geen ESM-import van active-win@9).
 */
export async function readActiveWindowMac(): Promise<Result | undefined> {
  if (!isMacAccessibilityTrusted()) return undefined;

  const binary = resolveActiveWinMainBinary();
  if (!binary) {
    if (!loggedReadError) {
      loggedReadError = true;
      logger.error('active-win/main niet gevonden — venster-tracking uitgeschakeld');
    }
    return undefined;
  }

  if (loggedBinaryPath !== binary) {
    loggedBinaryPath = binary;
    logger.info('active-win binary:', binary);
  }

  try {
    const { stdout } = await execFileAsync(binary, activeWinCliArgs(), {
      maxBuffer: 1024 * 1024,
    });
    if (!stdout?.trim()) return undefined;
    return JSON.parse(stdout) as Result;
  } catch (err) {
    if (!loggedReadError) {
      loggedReadError = true;
      logger.error('active-win/main mislukt', err);
    }
    return undefined;
  }
}
