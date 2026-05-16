/**
 * Centraal verzamelpunt voor alle "werkt het?"-status:
 * - login + email
 * - laatste actieve venster
 * - laatste browser-tab event (van extensie)
 * - queue-grootte
 * - laatste sync (success / error)
 *
 * Zowel tray-menu als diagnostics-venster lezen hier uit.
 */

import { EventEmitter } from 'node:events';

export interface DiagnosticsSnapshot {
  authenticated: boolean;
  email: string | null;
  apiBaseUrl: string;
  loginPath: string;
  activityPath: string;
  localPort: number;

  lastWindowAppName: string | null;
  lastWindowTitle: string | null;
  lastWindowAt: string | null;

  lastBrowserUrl: string | null;
  lastBrowserTabTitle: string | null;
  lastBrowserDomain: string | null;
  lastBrowserAt: string | null;

  queueSize: number;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncError: string | null;
  lastSyncCount: number;

  trackingEnabled: boolean;
}

export class DiagnosticsService extends EventEmitter {
  private snap: DiagnosticsSnapshot;

  constructor(initial: Pick<DiagnosticsSnapshot, 'apiBaseUrl' | 'loginPath' | 'activityPath' | 'localPort'>) {
    super();
    this.snap = {
      authenticated: false,
      email: null,
      apiBaseUrl: initial.apiBaseUrl,
      loginPath: initial.loginPath,
      activityPath: initial.activityPath,
      localPort: initial.localPort,

      lastWindowAppName: null,
      lastWindowTitle: null,
      lastWindowAt: null,

      lastBrowserUrl: null,
      lastBrowserTabTitle: null,
      lastBrowserDomain: null,
      lastBrowserAt: null,

      queueSize: 0,
      lastSyncAt: null,
      lastSyncOk: null,
      lastSyncError: null,
      lastSyncCount: 0,

      trackingEnabled: true,
    };
  }

  get(): DiagnosticsSnapshot {
    return { ...this.snap };
  }

  private update(partial: Partial<DiagnosticsSnapshot>): void {
    this.snap = { ...this.snap, ...partial };
    this.emit('change', this.snap);
  }

  setAuth(authenticated: boolean, email: string | null): void {
    this.update({ authenticated, email });
  }

  setWindow(app_name: string, window_title: string): void {
    this.update({
      lastWindowAppName: app_name,
      lastWindowTitle: window_title,
      lastWindowAt: new Date().toISOString(),
    });
  }

  setBrowser(url: string, title: string, domain: string): void {
    this.update({
      lastBrowserUrl: url,
      lastBrowserTabTitle: title,
      lastBrowserDomain: domain,
      lastBrowserAt: new Date().toISOString(),
    });
  }

  setQueueSize(n: number): void {
    if (n !== this.snap.queueSize) this.update({ queueSize: n });
  }

  setSyncSuccess(count: number): void {
    this.update({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: true,
      lastSyncError: null,
      lastSyncCount: count,
    });
  }

  setSyncError(error: string): void {
    this.update({
      lastSyncAt: new Date().toISOString(),
      lastSyncOk: false,
      lastSyncError: error,
    });
  }

  setTracking(enabled: boolean): void {
    this.update({ trackingEnabled: enabled });
  }
}
