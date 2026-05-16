import * as fs from 'node:fs';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import * as tls from 'node:tls';
import { logger } from './logger';

const HERD_CA_CANDIDATES = [
  () => process.env.HERD_CA_PATH,
  () => process.env.NODE_EXTRA_CA_CERTS,
  () =>
    path.join(
      os.homedir(),
      'Library/Application Support/Herd/config/valet/CA/LaravelValetCASelfSigned.pem',
    ),
  () => path.join(os.homedir(), 'Library/Application Support/Herd/config/php/cacert.pem'),
];

export function isLocalDevApiHost(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.test') ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/** Eerste bestaande Herd/Valet CA PEM op macOS (of expliciet pad in .env). */
export function resolveHerdCaPath(): string | null {
  for (const pick of HERD_CA_CANDIDATES) {
    const p = pick()?.trim();
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Axios httpsAgent voor lokale Herd HTTPS (*.test).
 * NODE_EXTRA_CA_CERTS alleen is onbetrouwbaar in Electron — we voegen de CA expliciet toe.
 */
export function createApiHttpsAgent(baseUrl: string): https.Agent | undefined {
  if (!isLocalDevApiHost(baseUrl)) return undefined;

  const herdCaPath = resolveHerdCaPath();
  if (!herdCaPath) {
    logger.warn(
      'Lokale HTTPS (*.test) maar geen Herd CA gevonden. Zet HERD_CA_PATH in .env of herinstalleer Herd Secure.',
    );
    return undefined;
  }

  const extraPem = fs.readFileSync(herdCaPath, 'utf8');
  const ca = [...tls.rootCertificates, extraPem];

  logger.info(`TLS: Herd CA geladen voor lokale API (${herdCaPath})`);

  return new https.Agent({ ca, keepAlive: true });
}
