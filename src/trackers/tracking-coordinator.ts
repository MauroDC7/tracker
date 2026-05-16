import type { ActivityPayload } from '../types';
import { ActivityQueue } from '../storage/activity-queue';
import { BrowserStateService } from '../services/browser-state';
import type { DiagnosticsService } from '../services/diagnostics-service';
import { readForegroundWindow } from './active-window-reader';
import { isLikelyBrowserProcess } from './browser-process';
import { logger } from '../utils/logger';

interface OpenSegment {
  started_at: Date;
  app_name: string;
  window_title: string;
  browser_url: string | null;
  browser_domain: string | null;
  browser_tab_title: string | null;
}

/**
 * Polls foreground window on an interval. When the composite "fingerprint" changes,
 * the previous open segment is finalized into the durable queue.
 *
 * Fingerprint = app + window title + (optional) browser URL/title when the foreground
 * app is a browser and the extension has recently reported the active tab.
 */
export class TrackingCoordinator {
  private timer: NodeJS.Timeout | null = null;
  private open: OpenSegment | null = null;
  private lastKey: string | null = null;

  constructor(
    private queue: ActivityQueue,
    private browserState: BrowserStateService,
    private pollMs: number,
    private getUserId: () => number | undefined,
    private isEnabled: () => boolean,
    private diagnostics: DiagnosticsService | null = null,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick().catch((e) => logger.error('tick', e)), this.pollMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Flush in-memory segment on shutdown */
  flushOpenSegment(): void {
    if (!this.open) return;
    const ended = new Date();
    const payload = this.toPayload(this.open, ended);
    if (payload.duration_seconds > 0) this.queue.enqueue(payload);
    this.open = null;
    this.lastKey = null;
  }

  private async tick(): Promise<void> {
    if (!this.isEnabled()) return;
    const now = new Date();
    const raw = await readForegroundWindow();
    if (!raw) return;

    const fg = normalizeForeground(raw);
    if (!fg) return;

    this.diagnostics?.setWindow(fg.app_name, fg.window_title);
    this.diagnostics?.setQueueSize(this.queue.size());

    const browserFresh = isLikelyBrowserProcess(fg.app_name)
      ? this.browserState.getFresh(now, 20_000)
      : null;

    const browser_url = browserFresh?.url ?? null;
    const browser_domain = browserFresh?.domain ?? null;
    const browser_tab_title = browserFresh?.title ?? null;

    const key = [
      fg.app_name,
      fg.window_title,
      browser_url || '',
      browser_tab_title || '',
    ].join('\u0001');

    if (this.lastKey === null) {
      this.open = this.startSegment(now, fg, browser_url, browser_domain, browser_tab_title);
      this.lastKey = key;
      return;
    }

    if (key === this.lastKey) return;

    if (this.open) {
      const payload = this.toPayload(this.open, now);
      if (payload.duration_seconds > 0) this.queue.enqueue(payload);
    }

    this.open = this.startSegment(now, fg, browser_url, browser_domain, browser_tab_title);
    this.lastKey = key;
  }

  private startSegment(
    started: Date,
    fg: { app_name: string; window_title: string },
    browser_url: string | null,
    browser_domain: string | null,
    browser_tab_title: string | null,
  ): OpenSegment {
    return {
      started_at: started,
      app_name: fg.app_name,
      window_title: fg.window_title,
      browser_url,
      browser_domain,
      browser_tab_title,
    };
  }

  private toPayload(seg: OpenSegment, ended: Date): ActivityPayload {
    const durationMs = ended.getTime() - seg.started_at.getTime();
    const duration_seconds = Math.max(0, Math.round(durationMs / 1000));
    return {
      user_id: this.getUserId(),
      app_name: seg.app_name,
      window_title: seg.window_title,
      browser_url: seg.browser_url,
      browser_domain: seg.browser_domain,
      browser_tab_title: seg.browser_tab_title,
      started_at: seg.started_at.toISOString(),
      ended_at: ended.toISOString(),
      duration_seconds,
    };
  }
}

/**
 * Garandeer dat een segment de server-validatie haalt:
 * - app_name moet niet leeg/'unknown' zijn (anders heeft het segment geen zin)
 * - window_title valt terug op app_name als macOS geen titel geeft (bv. Finder bureaublad)
 * - max-lengtes worden client-side al afgekapt
 */
function normalizeForeground(
  fg: { app_name: string; window_title: string },
): { app_name: string; window_title: string } | null {
  const app_name = (fg.app_name || '').trim();
  if (!app_name || app_name === 'unknown') return null;

  let window_title = (fg.window_title || '').trim();
  if (!window_title) window_title = app_name;

  return {
    app_name: clamp(app_name, 255),
    window_title: clamp(window_title, 2000),
  };
}

function clamp(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
