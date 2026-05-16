import type { BrowserEventDto } from '../types';
import type { DiagnosticsService } from './diagnostics-service';

/**
 * Holds the latest browser metadata pushed by the Chrome extension over localhost.
 * Only merged into activity rows when the foreground desktop process is a known browser.
 */
export class BrowserStateService {
  private latest: BrowserEventDto | null = null;
  private diagnostics: DiagnosticsService | null = null;

  attachDiagnostics(d: DiagnosticsService): void {
    this.diagnostics = d;
  }

  ingest(event: BrowserEventDto): void {
    if (event.is_incognito) return;
    this.latest = event;
    this.diagnostics?.setBrowser(event.url, event.title, event.domain);
  }

  /**
   * Returns recent browser metadata if the last observation is within `maxAgeMs`.
   */
  getFresh(now: Date, maxAgeMs: number): BrowserEventDto | null {
    if (!this.latest) return null;
    const t = Date.parse(this.latest.observed_at);
    if (!Number.isFinite(t)) return null;
    if (now.getTime() - t > maxAgeMs) return null;
    return this.latest;
  }

  clear(): void {
    this.latest = null;
  }
}
