import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { env } from '../utils/env';
import { domainFromUrl } from '../utils/domain';
import type { BrowserEventDto } from '../types';
import { BrowserStateService } from './browser-state';
import { logger } from '../utils/logger';

/**
 * Minimal localhost HTTP server for MV3 extension → Electron IPC substitute.
 * CORS enabled for chrome-extension:// origins only in spirit of least privilege
 * (browser still must be installed by user and pointed at this port).
 */
export class LocalBrowserServer {
  private server: http.Server | null = null;

  constructor(private browserState: BrowserStateService) {}

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.onRequest(req, res));
      this.server.on('error', reject);
      this.server.listen(env.localBrowserApiPort, '127.0.0.1', () => {
        const addr = this.server!.address() as AddressInfo;
        logger.info(`Local browser API listening on http://127.0.0.1:${addr.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server = null;
    });
  }

  private onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'POST' || req.url !== '/browser-event') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
      return;
    }
    this.readBody(req)
      .then((body) => this.handleBrowserEvent(body))
      .then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      })
      .catch((e) => {
        logger.warn('browser-event invalid', e);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'bad_request' }));
      });
  }

  private setCors(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  private readBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  private handleBrowserEvent(body: unknown): void {
    const o = body as Record<string, unknown>;
    const url = String(o['url'] || '');
    const title = String(o['title'] || '');
    const is_incognito = Boolean(o['is_incognito']);
    const observed_at = String(o['observed_at'] || new Date().toISOString());
    if (!url) throw new Error('missing url');
    const domain = (o['domain'] as string) || domainFromUrl(url);
    const dto: BrowserEventDto = {
      url,
      title,
      domain,
      is_incognito,
      observed_at,
    };
    this.browserState.ingest(dto);
  }
}
